import logging
from datetime import datetime, timedelta
import random
from typing import TypedDict, List, Dict, Any, Annotated
import operator

from langgraph.graph import StateGraph, END

import config
from core.models import (
    Transaction, Diagnosis, Intervention, ExecutionResult, AuditTrailEntry,
    TransactionStatus, FailureCategory, InterventionType, ExecutionStatus,
    RecoveryState
)
from core.database import save_state
from integrations.gemini import call_gemini_diagnose
from integrations.payment_gateway import retry_payment
from integrations.notifier import send_recovery_notification

logger = logging.getLogger(__name__)

# State definition for the LangGraph pipeline
class PipelineState(TypedDict):
    transaction: Transaction
    diagnoses: List[Diagnosis]
    decisions: List[Intervention]
    executions: List[ExecutionResult]
    audit_trail: List[AuditTrailEntry]
    current_status: TransactionStatus
    total_tokens_used: int
    total_cost_usd: float

# Nodes implementation

def detect_node(state: PipelineState) -> PipelineState:
    """Detects if transaction is at risk and logs the entry."""
    txn = state["transaction"]
    
    audit_entry = AuditTrailEntry(
        step_name="DETECT",
        action_details=f"Flagged transaction {txn.txn_id} (Type: {txn.type.value}) at risk. Initial Status: {txn.status.value}.",
        meta_info={"amount": txn.amount, "failure_code": txn.failure_code}
    )
    
    state["audit_trail"].append(audit_entry)
    state["current_status"] = TransactionStatus.IN_PROGRESS
    
    return state

def diagnose_node(state: PipelineState) -> PipelineState:
    """Uses Gemini API to analyze failure logs and classify root cause."""
    txn = state["transaction"]
    
    # Call Gemini to diagnose
    diagnosis, token_usage, cost = call_gemini_diagnose(
        txn_type=txn.type.value,
        failure_code=txn.failure_code or "unknown_failure",
        amount=txn.amount,
        customer_name=txn.customer_name
    )
    
    # Update state
    state["diagnoses"].append(diagnosis)
    state["total_tokens_used"] += token_usage.get("total_tokens", 0)
    state["total_cost_usd"] += cost
    
    audit_entry = AuditTrailEntry(
        step_name="DIAGNOSE",
        action_details=(
            f"Diagnosed failure: '{diagnosis.root_cause}' "
            f"(Category: {diagnosis.category.value}, Confidence: {diagnosis.confidence})."
        ),
        meta_info={
            "reasoning": diagnosis.reasoning,
            "tokens": token_usage,
            "cost_usd": cost
        }
    )
    state["audit_trail"].append(audit_entry)
    
    return state

def decide_node(state: PipelineState) -> PipelineState:
    """Evaluates guardrails and policy rules to determine the best recovery action."""
    txn = state["transaction"]
    diagnosis = state["diagnoses"][-1]
    
    action_type = InterventionType.RETRY
    details = ""
    policy_applied = ""
    scheduled_time = datetime.now()
    
    # 1. Guardrail Check: Check if maximum retry limit has been exceeded (Global Safety Gate)
    max_retry_limit = config.POLICY_MAX_RETRIES.get(diagnosis.category.value, 0)
    
    if txn.type.value == "subscription" and txn.retry_count >= 2:
        action_type = InterventionType.CALL
        details = f"Retries ({txn.retry_count}) exhausted for subscription mandate. Triggering outbound voice call."
        policy_applied = "NPCI Compliance: E-Mandate Spacing"
    elif txn.retry_count >= max_retry_limit and txn.type.value != "subscription":
        action_type = InterventionType.ESCALATE
        details = f"Retry limit ({max_retry_limit}) reached for category '{diagnosis.category.value}'. Handing over to human ops."
        policy_applied = "Guardrail: Max Retries Exceeded Policy"
        
    # 2. Merchant Policy Rules Engine Override
    else:
        import json
        import os
        rules = []
        rules_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "merchant_rules.json")
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r") as f:
                    rules = json.load(f)
            except Exception as e:
                logger.error(f"Error loading merchant rules: {e}")
                
        rule_override = None
        for rule in rules:
            field = rule.get("condition_field")
            op = rule.get("operator")
            val = rule.get("condition_value")
            
            field_val = None
            if hasattr(txn, field):
                field_val = getattr(txn, field)
            elif field == "status":
                field_val = state.get("current_status")
                if hasattr(field_val, "value"):
                    field_val = field_val.value
                    
            if field_val is not None:
                is_match = False
                if op == "eq" and str(field_val).lower() == str(val).lower():
                    is_match = True
                elif op == "gt":
                    try:
                        if float(field_val) > float(val):
                            is_match = True
                    except ValueError:
                        pass
                elif op == "lt":
                    try:
                        if float(field_val) < float(val):
                            is_match = True
                    except ValueError:
                        pass
                        
                if is_match:
                    rule_override = rule
                    break
                    
        if rule_override:
            policy_applied = f"Merchant Custom Rule: {rule_override['name']}"
            action_val = rule_override["action"]
            if action_val == "escalate":
                action_type = InterventionType.ESCALATE
                details = f"Override Action triggered: {rule_override['description']}"
            elif action_val == "message":
                action_type = InterventionType.MESSAGE
                details = f"Override Action triggered: {rule_override['description']}"
            elif action_val == "snooze":
                action_type = InterventionType.MESSAGE
                details = "Dunning alerts paused/snoozed by merchant rule configuration."
                scheduled_time = datetime.now() + timedelta(days=7)
        
        # 3. Standard Policy Rules (Default Layout)
        elif txn.type.value == "invoice":
            # Calculate aging of the invoice in days
            aging_days = (datetime.now() - txn.timestamp).days
            policy_applied = f"B2B Invoice Escalation Policy (Aging: {aging_days} days)"
            
            if aging_days <= 2:
                action_type = InterventionType.MESSAGE
                details = "Send first gentle email reminder."
                scheduled_time = datetime.now()
            elif aging_days <= 10:
                action_type = InterventionType.MESSAGE
                details = "Send second firm invoice payment reminder."
                scheduled_time = datetime.now()
            else:
                action_type = InterventionType.ESCALATE
                details = f"Invoice overdue by {aging_days} days. Escalate to collections team."
                
        elif txn.type.value == "subscription":
            policy_applied = "NPCI Compliance: E-Mandate Spacing"
            # Spacing guideline: space retries 3 clearing days later
            next_date = datetime.now() + timedelta(days=3)
            if next_date.weekday() == 6: # Sunday clearing is closed
                next_date += timedelta(days=1)
                
            if txn.retry_count >= 2:
                action_type = InterventionType.CALL
                details = f"Retries ({txn.retry_count}) exhausted for subscription mandate. Triggering outbound voice call."
                scheduled_time = datetime.now()
            else:
                action_type = InterventionType.RETRY
                scheduled_time = next_date
                details = f"Schedule compliance mandate retry on NPCI clearing day: {next_date.strftime('%A, %b %d')}."

        else:
            policy_applied = f"Category Routing Policy ({diagnosis.category.value})"
            
            if diagnosis.category == FailureCategory.CUSTOMER_SIDE_TEMPORARY:
                if txn.failure_code in ["user_dropped_out", "cart_abandoned", "payment_page_closed"]:
                    action_type = InterventionType.MESSAGE
                    details = "Send cart drop-off WhatsApp reminder."
                elif txn.retry_count >= 2:
                    action_type = InterventionType.CALL
                    details = "Initiating Hinglish IVR outreach after multiple failed digital retries."
                else:
                    action_type = InterventionType.RETRY
                    delay = config.POLICY_RETRY_INTERVALS.get("customer_side_temporary", 10)
                    scheduled_time = datetime.now() + timedelta(seconds=delay)
                    details = f"Schedule retry in {delay} seconds (representing 24 hours spacing)."
                    
            elif diagnosis.category == FailureCategory.CUSTOMER_SIDE_PERMANENT:
                action_type = InterventionType.MESSAGE
                details = "Request updated payment details."
                
            elif diagnosis.category == FailureCategory.SYSTEM_SIDE:
                action_type = InterventionType.RETRY
                delay = config.POLICY_RETRY_INTERVALS.get("system_side", 2)
                scheduled_time = datetime.now() + timedelta(seconds=delay)
                details = f"Schedule fast retry in {delay} seconds (representing 1 hour spacing)."
                
    decision = Intervention(
        action_type=action_type,
        details=details,
        scheduled_time=scheduled_time,
        retry_attempt_number=txn.retry_count + 1,
        policy_applied=policy_applied
    )
    
    state["decisions"].append(decision)
    
    audit_entry = AuditTrailEntry(
        step_name="DECIDE",
        action_details=f"Decided action: {action_type.value.upper()}. Reason: {details}",
        meta_info={"policy_applied": policy_applied, "retry_attempt": txn.retry_count}
    )
    state["audit_trail"].append(audit_entry)
    
    return state

def execute_node(state: PipelineState) -> PipelineState:
    """Executes the selected action (simulated gateway calls or customer notifications)."""
    txn = state["transaction"]
    decision = state["decisions"][-1]
    diagnosis = state["diagnoses"][-1]
    
    exec_status = ExecutionStatus.PENDING
    amount_recovered = 0.0
    execution_logs = ""
    
    if decision.action_type == InterventionType.RETRY:
        # Simulate payment gateway retry
        txn.retry_count += 1
        status, amount, logs = retry_payment(txn, txn.retry_count)
        
        exec_status = ExecutionStatus.SUCCESS if status == ExecutionStatus.SUCCESS else ExecutionStatus.FAILED
        amount_recovered = amount
        execution_logs = logs
        
        if exec_status == ExecutionStatus.SUCCESS:
            state["current_status"] = TransactionStatus.SUCCESS
        else:
            state["current_status"] = TransactionStatus.FAILED
            
    elif decision.action_type == InterventionType.MESSAGE:
        # Decide if we use Hinglish (High-conversion for Indian shoppers)
        # Hinglish is highly effective for checkout dropoffs and temporary failures
        use_hinglish = txn.type.value in ["checkout", "payment"] and random.choice([True, False])
        
        # Select tone based on decision details
        tone = "gentle"
        if "firm" in decision.details.lower():
            tone = "firm"
        elif "final" in decision.details.lower() or "urgent" in decision.details.lower():
            tone = "final_notice"
            
        status, logs = send_recovery_notification(
            transaction=txn,
            diagnosis=diagnosis,
            tone=tone,
            use_hinglish=use_hinglish
        )
        
        # Simulate customer checkout recovery response
        # 35% chance customer completes purchase after getting reminder message
        recovered = False
        if status == ExecutionStatus.SUCCESS:
            recovery_rate = 0.35
            if tone == "firm":
                recovery_rate = 0.25
            if random.random() < recovery_rate:
                recovered = True
                
        if recovered:
            exec_status = ExecutionStatus.SUCCESS
            amount_recovered = txn.amount
            state["current_status"] = TransactionStatus.SUCCESS
            execution_logs = logs + "\nCustomer clicked link and completed transaction successfully."
        else:
            exec_status = ExecutionStatus.FAILED
            state["current_status"] = TransactionStatus.FAILED
            execution_logs = logs + "\nCustomer received reminder but did not complete transaction."
            
    elif decision.action_type == InterventionType.CALL:
        from integrations.notifier import send_ivr_voice_call
        status, logs = send_ivr_voice_call(transaction=txn, diagnosis=diagnosis)
        
        # 40% success rate on IVR calls
        recovered = False
        if status == ExecutionStatus.SUCCESS:
            if random.random() < 0.40:
                recovered = True
                
        if recovered:
            exec_status = ExecutionStatus.SUCCESS
            amount_recovered = txn.amount
            state["current_status"] = TransactionStatus.SUCCESS
            execution_logs = logs + "\nCustomer confirmed payment intent during Hinglish IVR voice call. Account debited successfully."
        else:
            exec_status = ExecutionStatus.FAILED
            state["current_status"] = TransactionStatus.FAILED
            execution_logs = logs + "\nCustomer disconnected or did not complete payment during call."

    elif decision.action_type == InterventionType.ESCALATE:
        # Escalate to human recovery ops
        exec_status = ExecutionStatus.SUCCESS
        state["current_status"] = TransactionStatus.ESCALATED
        amount_recovered = 0.0
        execution_logs = (
            f"Escalation ticket generated automatically for transaction {txn.txn_id}.\n"
            f"Routing to Recovery Specialist queue.\n"
            f"Handover context: Failure: {diagnosis.root_cause} (Category: {diagnosis.category.value}). "
            f"Actions tried: {txn.retry_count} retries."
        )
        
    execution_res = ExecutionResult(
        status=exec_status,
        amount_recovered=amount_recovered,
        logs=execution_logs,
        token_usage={},
        cost_usd=0.0
    )
    state["executions"].append(execution_res)
    
    audit_entry = AuditTrailEntry(
        step_name="EXECUTE",
        action_details=f"Execution completed. Outcome: {exec_status.value.upper()}. Recovery: INR {amount_recovered:,.2f}",
        meta_info={"logs": execution_logs}
    )
    state["audit_trail"].append(audit_entry)
    
    return state

def log_node(state: PipelineState) -> PipelineState:
    """Logs the final status and compiles the persistent audit log."""
    txn = state["transaction"]
    
    # Save the updated transaction status
    txn.status = state["current_status"]
    
    # Instantiate recovery state object
    recovery_obj = RecoveryState(
        transaction=txn,
        diagnoses=state["diagnoses"],
        decisions=state["decisions"],
        executions=state["executions"],
        audit_trail=state["audit_trail"],
        current_status=state["current_status"],
        total_tokens_used=state["total_tokens_used"],
        total_cost_usd=state["total_cost_usd"]
    )
    
    # Save recovery state to JSON database
    save_state(recovery_obj)
    
    audit_entry = AuditTrailEntry(
        step_name="LOG",
        action_details=f"Recovery pipeline complete. Final Status: {state['current_status'].value.upper()}.",
        meta_info={"database_persisted": True}
    )
    state["audit_trail"].append(audit_entry)
    
    return state

# Setup LangGraph Pipeline

def build_recovery_pipeline():
    """Compiles the LangGraph StateGraph pipeline."""
    workflow = StateGraph(PipelineState)
    
    # Add nodes
    workflow.add_node("detect", detect_node)
    workflow.add_node("diagnose", diagnose_node)
    workflow.add_node("decide", decide_node)
    workflow.add_node("execute", execute_node)
    workflow.add_node("log", log_node)
    
    # Define execution graph edges
    workflow.set_entry_point("detect")
    workflow.add_edge("detect", "diagnose")
    workflow.add_edge("diagnose", "decide")
    workflow.add_edge("decide", "execute")
    workflow.add_edge("execute", "log")
    workflow.add_edge("log", END)
    
    return workflow.compile()

# Thread-safe pipeline execution wrapper
pipeline_app = build_recovery_pipeline()

def run_recovery_pipeline(transaction: Transaction) -> RecoveryState:
    """
    Runs the entire LangGraph recovery state machine pipeline for a single transaction.
    """
    initial_state = PipelineState(
        transaction=transaction,
        diagnoses=[],
        decisions=[],
        executions=[],
        audit_trail=[],
        current_status=TransactionStatus.IN_PROGRESS,
        total_tokens_used=0,
        total_cost_usd=0.0
    )
    
    # Run pipeline graph
    final_output = pipeline_app.invoke(initial_state)
    
    # Construct final RecoveryState object
    return RecoveryState(
        transaction=final_output["transaction"],
        diagnoses=final_output["diagnoses"],
        decisions=final_output["decisions"],
        executions=final_output["executions"],
        audit_trail=final_output["audit_trail"],
        current_status=final_output["current_status"],
        total_tokens_used=final_output["total_tokens_used"],
        total_cost_usd=final_output["total_cost_usd"]
    )
