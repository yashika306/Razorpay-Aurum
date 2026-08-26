import pytest
from datetime import datetime, timedelta
import config
from core.models import Transaction, TransactionType, TransactionStatus, FailureCategory, InterventionType
from core.pipeline import run_recovery_pipeline

def test_retry_guardrails_escalation():
    # Set maximum retries to a small number (e.g. 1) to test guardrail activation
    config.POLICY_MAX_RETRIES["customer_side_temporary"] = 1
    
    # Create a transaction where retry_count is already 1 (limit reached)
    txn = Transaction(
        txn_id="test_txn_guardrail",
        type=TransactionType.PAYMENT,
        status=TransactionStatus.FAILED,
        amount=2500.0,
        failure_code="insufficient_funds", # Category: customer_side_temporary
        customer_id="cust_test_777",
        customer_name="Guardrail Test Customer",
        customer_email="guardrail@test.com",
        customer_phone="+917777777777",
        timestamp=datetime.now(),
        retry_count=1  # Has already been retried once
    )
    
    result = run_recovery_pipeline(txn)
    
    # Verify that the decision was forced to ESCALATE
    assert len(result.decisions) > 0
    decision = result.decisions[-1]
    assert decision.action_type == InterventionType.ESCALATE
    assert "limit" in decision.details.lower() or "max retries" in decision.details.lower() or "guardrail" in decision.details.lower()
    
    # Verify final transaction status is set to ESCALATED
    assert result.current_status == TransactionStatus.ESCALATED
    assert result.transaction.status == TransactionStatus.ESCALATED

def test_b2b_invoice_aging_escalation():
    # A B2B invoice overdue by more than 10 days should escalate directly to human ops
    fifteen_days_ago = datetime.now() - timedelta(days=15)
    
    txn = Transaction(
        txn_id="test_b2b_overdue_15_days",
        type=TransactionType.INVOICE,
        status=TransactionStatus.OVERDUE,
        amount=85000.0,
        failure_code="invoice_unpaid",
        customer_id="cust_test_company",
        customer_name="Acme Corp",
        customer_email="billing@acme.corp",
        customer_phone="+916666666666",
        timestamp=fifteen_days_ago,
        retry_count=0
    )
    
    result = run_recovery_pipeline(txn)
    
    assert len(result.decisions) > 0
    decision = result.decisions[-1]
    assert decision.action_type == InterventionType.ESCALATE
    assert result.current_status == TransactionStatus.ESCALATED
