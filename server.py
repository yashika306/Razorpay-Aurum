import os
import json
import hmac
import hashlib
import random
import logging
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, APIRouter, Request, WebSocket
from fastapi.websockets import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from core.models import Transaction, TransactionStatus, TransactionType, RecoveryState
from core.database import (
    get_all_states, get_metrics, save_state, reset_db,
    get_state_by_txn_id, get_cache_metrics, reset_cache
)
from core.pipeline import run_recovery_pipeline
from utils.data_generator import generate_synthetic_transactions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aurum_server")

app = FastAPI(
    title="AURUM API Server",
    description="AI-powered autonomous payment failure recovery, dunning automation, and revenue intelligence engine.",
    version="1.0.0"
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSockets Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connection established.")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket connection disconnected.")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Schemas
class PromiseRequest(BaseModel):
    promise_date: str

class WebhookRequest(BaseModel):
    event: str  # e.g., "payment.failed", "invoice.overdue", "subscription.halted"
    payload: Dict[str, Any]

class TemplatePreviewRequest(BaseModel):
    type: str
    customer_name: str
    amount: float
    failure_code: str
    use_hinglish: bool
    tone: str = "gentle"

# Routes

@app.get("/api/metrics")
def api_get_metrics():
    """Fetch global dashboard recovery statistics."""
    try:
        return get_metrics()
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases", response_model=List[Dict[str, Any]])
def api_get_cases(
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    type: Optional[str] = Query(None, description="Filter by channel type")
):
    """Retrieve all transaction case logs with optional filters."""
    try:
        states = get_all_states()
        cases = []
        for s in states:
            diagnosis_cat = s.diagnoses[-1].category.value if s.diagnoses else "UNCLASSIFIED"
            cases.append({
                "txn_id": s.transaction.txn_id,
                "customer_id": s.transaction.customer_id,
                "customer_name": s.transaction.customer_name,
                "customer_email": s.transaction.customer_email,
                "customer_phone": s.transaction.customer_phone,
                "type": s.transaction.type.value,
                "amount": s.transaction.amount,
                "retry_count": s.transaction.retry_count,
                "status": s.current_status.value,
                "failure_code": s.transaction.failure_code,
                "category": diagnosis_cat,
                "timestamp": s.transaction.timestamp,
                "promise_date": s.transaction.metadata.get("promise_date")
            })
            
        if status:
            cases = [c for c in cases if c["status"].lower() == status.lower()]
        if type:
            cases = [c for c in cases if c["type"].lower() == type.lower()]
            
        return cases
    except Exception as e:
        logger.error(f"Error fetching cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases/{txn_id}")
def api_get_case_detail(txn_id: str):
    """Fetch trace logs, audit entries, and API outputs for a single case."""
    try:
        state = get_state_by_txn_id(txn_id)
        if not state:
            raise HTTPException(status_code=404, detail="Case not found")
        return state
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching case {txn_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cases/{txn_id}/promise")
async def api_record_promise(txn_id: str, payload: PromiseRequest):
    """Record customer promise-to-pay date and pause automation."""
    try:
        state = get_state_by_txn_id(txn_id)
        if not state:
            raise HTTPException(status_code=404, detail="Case not found")
        
        state.current_status = TransactionStatus.PROMISED
        state.transaction.status = TransactionStatus.PROMISED
        state.transaction.metadata["promise_date"] = payload.promise_date
        
        from core.models import AuditTrailEntry
        audit = AuditTrailEntry(
            step_name="PROMISE_TRACKER",
            action_details=f"Customer registered a promise to pay by {payload.promise_date}. Pausing notifications.",
            meta_info={"promise_date": payload.promise_date}
        )
        state.audit_trail.append(audit)
        
        save_state(state)
        
        # Broadcast the promise status update live to the WebSocket connections
        await manager.broadcast({
            "event": "promise_logged",
            "txn_id": txn_id,
            "promise_date": payload.promise_date
        })
        
        return {"status": "success", "message": f"Promise date recorded for {txn_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording promise for {txn_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/webhooks/razorpay")
async def api_razorpay_webhook(request: Request):
    """
    Ingests inbound webhooks from Razorpay with signature verification and idempotency filtering.
    """
    # 1. Cryptographic Webhook Signature Check (Interview Ready Security)
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    secret = "revive_webhook_secret_9999" # Configured webhook secret
    
    if signature:
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_sig, signature):
            logger.error("Security alert: Webhook signature verification failed.")
            raise HTTPException(status_code=401, detail="Invalid HMAC webhook signature.")
    
    # Parse body
    try:
        webhook_data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event_type = webhook_data.get("event", "payment.failed")
    payload = webhook_data.get("payload", {})
    
    # Extract transaction values
    txn_id = payload.get("id") or f"pay_failed_{random.randint(100000, 999999)}"
    customer_id = payload.get("customer_id") or f"cust_{random.randint(10000, 99999)}"
    customer_name = payload.get("customer_name") or "Sandbox Customer"
    customer_email = payload.get("customer_email") or "sandbox@example.com"
    customer_phone = payload.get("customer_phone") or "+91 99999 88888"
    amount = float(payload.get("amount", 5000.00))
    failure_code = payload.get("failure_code") or "payment_failed"
    
    # 2. Idempotency Deduplication Gate (Prevent Duplicate Collections Actions)
    existing = get_state_by_txn_id(txn_id)
    if existing:
        logger.info(f"Idempotency hit: Webhook event for transaction {txn_id} already processed. Suppressing duplicate execution.")
        return {
            "status": "idempotent_duplicate",
            "message": f"Transaction {txn_id} has already been processed to status {existing.current_status.value}.",
            "txn_id": txn_id
        }
        
    # Map type
    if "subscription" in event_type:
        txn_type = TransactionType.SUBSCRIPTION
    elif "invoice" in event_type:
        txn_type = TransactionType.INVOICE
    elif "checkout" in event_type:
        txn_type = TransactionType.CHECKOUT
    else:
        txn_type = TransactionType.PAYMENT

    # Build Transaction
    txn = Transaction(
        txn_id=txn_id,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        type=txn_type,
        amount=amount,
        failure_code=failure_code,
        retry_count=int(payload.get("retry_count", 0)),
        status=TransactionStatus.FAILED if txn_type == TransactionType.PAYMENT else (TransactionStatus.ABANDONED if txn_type == TransactionType.CHECKOUT else TransactionStatus.OVERDUE),
        timestamp=datetime.now()
    )
    
    # Broadcast start of recovery workflow live
    await manager.broadcast({
        "event": "pipeline_started",
        "txn_id": txn.txn_id,
        "customer_name": txn.customer_name,
        "amount": txn.amount,
        "type": txn.type.value
    })
    
    # Trigger pipeline
    final_state = run_recovery_pipeline(txn)
    
    # Stream node audit logs live over WebSockets for premium visual progression
    for entry in final_state.audit_trail:
        await manager.broadcast({
            "event": "node_processed",
            "txn_id": final_state.transaction.txn_id,
            "step_name": entry.step_name,
            "action_details": entry.action_details,
            "meta_info": entry.meta_info,
            "timestamp": str(entry.timestamp)
        })
        await asyncio.sleep(0.4) # visual breathing room
        
    await manager.broadcast({
        "event": "pipeline_finished",
        "txn_id": final_state.transaction.txn_id,
        "status": final_state.current_status.value,
        "recovered": final_state.current_status == TransactionStatus.SUCCESS
    })
    
    return {
        "status": "processed",
        "txn_id": final_state.transaction.txn_id,
        "recovery_status": final_state.current_status.value
    }

@app.post("/api/sandbox/trigger")
async def api_trigger_sandbox(txn: Transaction):
    """Explicitly triggers recovery flow on a specific transaction object for the Live Sandbox with WS streaming."""
    # Broadcast pipeline started
    await manager.broadcast({
        "event": "pipeline_started",
        "txn_id": txn.txn_id,
        "customer_name": txn.customer_name,
        "amount": txn.amount,
        "type": txn.type.value
    })
    
    final_state = run_recovery_pipeline(txn)
    
    # Stream nodes traces
    for entry in final_state.audit_trail:
        await manager.broadcast({
            "event": "node_processed",
            "txn_id": final_state.transaction.txn_id,
            "step_name": entry.step_name,
            "action_details": entry.action_details,
            "meta_info": entry.meta_info,
            "timestamp": str(entry.timestamp)
        })
        await asyncio.sleep(0.4)
        
    await manager.broadcast({
        "event": "pipeline_finished",
        "txn_id": final_state.transaction.txn_id,
        "status": final_state.current_status.value,
        "recovered": final_state.current_status == TransactionStatus.SUCCESS
    })
    
    return final_state

@app.post("/api/cases/run-pipeline")
async def api_run_case_pipeline(payload: Dict[str, Any]):
    """Triggers the recovery pipeline for a specific transaction in the DB using its txn_id."""
    txn_id = payload.get("txn_id")
    if not txn_id:
        raise HTTPException(status_code=400, detail="Missing txn_id in request payload")
    
    # Load transaction from DB
    from core.database import get_state_by_txn_id
    case_detail = get_state_by_txn_id(txn_id)
    if not case_detail:
        raise HTTPException(status_code=404, detail=f"Case with txn_id {txn_id} not found")
        
    txn = case_detail.transaction
    
    # Broadcast start of pipeline
    await manager.broadcast({
        "event": "pipeline_started",
        "txn_id": txn.txn_id,
        "customer_name": txn.customer_name,
        "amount": txn.amount,
        "type": txn.type.value
    })
    
    # Run pipeline
    final_state = run_recovery_pipeline(txn)
    
    # Stream node traces
    for entry in final_state.audit_trail:
        await manager.broadcast({
            "event": "node_processed",
            "txn_id": final_state.transaction.txn_id,
            "step_name": entry.step_name,
            "action_details": entry.action_details,
            "meta_info": entry.meta_info,
            "timestamp": str(entry.timestamp)
        })
        await asyncio.sleep(0.4)
        
    await manager.broadcast({
        "event": "pipeline_finished",
        "txn_id": final_state.transaction.txn_id,
        "status": final_state.current_status.value,
        "recovered": final_state.current_status == TransactionStatus.SUCCESS
    })
    
    return final_state

@app.get("/api/cache/stats")
def api_get_cache_stats():
    """Fetch cache hit ratios and total dollar/token savings."""
    try:
        stats = get_cache_metrics()
        hits = stats.get("hits", 0)
        misses = stats.get("misses", 0)
        total = hits + misses
        ratio = (hits / total * 100) if total > 0 else 0.0
        tokens_saved = hits * 350
        usd_saved = tokens_saved * config.GEMINI_INPUT_COST_PER_TOKEN
        
        return {
            "hits": hits,
            "misses": misses,
            "total_requests": total,
            "hit_ratio_percent": ratio,
            "tokens_saved": tokens_saved,
            "usd_saved": usd_saved
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cache/clear")
def api_clear_cache():
    """Wipe Gemini cache database history."""
    try:
        reset_cache()
        return {"status": "success", "message": "Cache wiped successfully"}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/policies")
def get_policies():
    """Retrieve customized merchant business routing policies."""
    try:
        rules_path = os.path.join(os.path.dirname(__file__), "merchant_rules.json")
        if os.path.exists(rules_path):
            with open(rules_path, "r") as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Error loading policies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/policies")
def update_policies(rules: List[Dict[str, Any]]):
    """Update custom merchant business policies."""
    try:
        rules_path = os.path.join(os.path.dirname(__file__), "merchant_rules.json")
        with open(rules_path, "w") as f:
            json.dump(rules, f, indent=2)
        return {"status": "success", "message": "Merchant routing rules saved successfully"}
    except Exception as e:
        logger.error(f"Error updating policies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cases/generate")
def api_generate_cases(
    count: int = Query(25, ge=5, le=100),
    reset: bool = Query(False, description="Wipe database before generating new events")
):
    """Generate failed transaction events with support for appending or resetting."""
    try:
        new_txns = generate_synthetic_transactions(count=count)
        if reset:
            reset_db()
            
        from core.models import Diagnosis, FailureCategory, Intervention, InterventionType, ExecutionResult, ExecutionStatus, AuditTrailEntry, TransactionStatus
        
        for idx, txn in enumerate(new_txns):
            # Roll for status partition:
            # 40% -> SUCCESS (Recovered)
            # 15% -> ESCALATED
            # 15% -> PROMISED
            # 30% -> Active failed/abandoned/overdue
            roll = idx % 10
            
            state = RecoveryState(transaction=txn, current_status=txn.status)
            
            if roll < 4: # SUCCESS
                state.transaction.status = TransactionStatus.SUCCESS
                state.current_status = TransactionStatus.SUCCESS
                
                # Mock a recovery journey
                diag = Diagnosis(
                    root_cause="Temporary balance insufficiency resolved.",
                    category=FailureCategory.CUSTOMER_SIDE_TEMPORARY,
                    confidence="high",
                    reasoning="Decline was due to insufficient funds. The customer was prompted via SMS/WhatsApp to pay or update details."
                )
                state.diagnoses.append(diag)
                
                dec = Intervention(
                    action_type=InterventionType.RETRY,
                    details="Automated retry scheduled after balance check.",
                    policy_applied="Customer Recovery Rule Override",
                    scheduled_time=datetime.now(),
                    retry_attempt_number=1
                )
                state.decisions.append(dec)
                
                exe = ExecutionResult(
                    status=ExecutionStatus.SUCCESS,
                    amount_recovered=txn.amount,
                    logs="Payment completed successfully on retry. Gateway Ref: pay_rec_98213."
                )
                state.executions.append(exe)
                
                audit = AuditTrailEntry(
                    step_name="RECOVERY_PIPELINE",
                    action_details="Transaction recovered successfully via scheduled auto-retry.",
                    meta_info={"recovered_amount": txn.amount}
                )
                state.audit_trail.append(audit)
                
            elif roll == 4 or roll == 5: # ESCALATED
                state.transaction.status = TransactionStatus.ESCALATED
                state.current_status = TransactionStatus.ESCALATED
                state.transaction.retry_count = 2
                
                diag = Diagnosis(
                    root_cause="Stolen card or fraudulent transaction signature decline.",
                    category=FailureCategory.CUSTOMER_SIDE_PERMANENT,
                    confidence="medium",
                    reasoning="Repeated authentication/security verification declines."
                )
                state.diagnoses.append(diag)
                
                dec = Intervention(
                    action_type=InterventionType.ESCALATE,
                    details="Safety limit exceeded. Escalating to human ops for fraud investigation.",
                    policy_applied="Guardrail: Max Retries Exceeded Policy",
                    scheduled_time=datetime.now(),
                    retry_attempt_number=2
                )
                state.decisions.append(dec)
                
                exe = ExecutionResult(
                    status=ExecutionStatus.SUCCESS,
                    amount_recovered=0.0,
                    logs="Case assigned to compliance desk queue."
                )
                state.executions.append(exe)
                
                audit = AuditTrailEntry(
                    step_name="SAFETY_GUARDRAIL",
                    action_details="Safety threshold exceeded. Escalated to legal compliance.",
                    meta_info={"retries": 2}
                )
                state.audit_trail.append(audit)
                
            elif roll == 6 or roll == 7: # PROMISED
                state.transaction.status = TransactionStatus.PROMISED
                state.current_status = TransactionStatus.PROMISED
                promise_date = (datetime.now() + timedelta(days=random.randint(2, 7))).strftime("%Y-%m-%d")
                state.transaction.metadata["promise_date"] = promise_date
                
                diag = Diagnosis(
                    root_cause="Temporary liquidity issue.",
                    category=FailureCategory.CUSTOMER_SIDE_TEMPORARY,
                    confidence="high",
                    reasoning="Customer requested more time due to salary delay."
                )
                state.diagnoses.append(diag)
                
                audit = AuditTrailEntry(
                    step_name="PROMISE_TRACKER",
                    action_details=f"Customer registered a promise to pay by {promise_date}. Pausing notifications.",
                    meta_info={"promise_date": promise_date}
                )
                state.audit_trail.append(audit)
                
            else: # Active FAILED / OVERDUE / ABANDONED
                # Let it stay in initial failed/abandoned state. No diagnoses yet, representing active pending items.
                pass
                
            save_state(state)
            
        return {"status": "success", "message": f"Added {count} high-fidelity mock cases. (Wipe Mode: {reset})"}
    except Exception as e:
        logger.error(f"Error generating cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/database/reset")
def api_reset_cases():
    """Wipe all transaction log logs."""
    try:
        reset_db()
        return {"status": "success", "message": "Database reset completed."}
    except Exception as e:
        logger.error(f"Error resetting database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/templates/preview")
def api_preview_template(req: TemplatePreviewRequest):
    """Renders a Hinglish/English template notification mockup for merchants."""
    try:
        from integrations.notifier import send_recovery_notification
        txn = Transaction(
            txn_id="demo_preview_99",
            customer_id="cust_preview",
            customer_name=req.customer_name,
            customer_email="customer@example.com",
            customer_phone="+91 99999 88888",
            type=TransactionType(req.type),
            amount=req.amount,
            failure_code=req.failure_code,
            status=TransactionStatus.FAILED,
            timestamp=datetime.now()
        )
        from core.models import Diagnosis, FailureCategory
        diag = Diagnosis(
            root_cause="Simulator failure reasons",
            category=FailureCategory.CUSTOMER_SIDE_TEMPORARY,
            confidence="high",
            reasoning="Sandbox reasoning"
        )
        status, logs = send_recovery_notification(
            transaction=txn,
            diagnosis=diag,
            tone=req.tone,
            use_hinglish=req.use_hinglish
        )
        msg_body = logs.split('"""')[1].strip() if '"""' in logs else logs
        return {"channel": "Email" if req.type == "invoice" else ("SMS" if req.type == "payment" else "WhatsApp"), "message": msg_body}
    except Exception as e:
        logger.error(f"Error rendering template preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CustomerReplyRequest(BaseModel):
    txn_id: str
    message: str

@app.post("/api/webhooks/customer-reply")
async def api_customer_reply(req: CustomerReplyRequest):
    """
    Ingests simulated text reply message from a customer.
    Parses with Gemini P2P engine to extract date, logs to DB, and pauses dunning.
    """
    try:
        from integrations.gemini import parse_customer_reply_for_promise
        from core.database import get_state_by_txn_id, save_state
        from core.models import TransactionStatus, AuditTrailEntry
        
        state = get_state_by_txn_id(req.txn_id)
        if not state:
            raise HTTPException(status_code=404, detail="Transaction not found.")
            
        promise_date, reasoning = parse_customer_reply_for_promise(req.message)
        
        if promise_date:
            state.transaction.status = TransactionStatus.PROMISED
            state.transaction.metadata["promise_date"] = promise_date
            state.current_status = TransactionStatus.PROMISED
            
            audit = AuditTrailEntry(
                step_name="P2P_PARSER",
                action_details=f"AI Promise Tracker: Detected commitment to pay by {promise_date}. Reason: {reasoning}. Pausing all automated outreach.",
                meta_info={"promise_date": promise_date, "reasoning": reasoning, "customer_message": req.message}
            )
            state.audit_trail.append(audit)
            save_state(state)
            
            await manager.broadcast({
                "event": "promise_logged",
                "txn_id": req.txn_id,
                "promise_date": promise_date,
                "message": f"Promise logged for {state.transaction.customer_name} by {promise_date}."
            })
            
            return {
                "status": "success",
                "promise_date": promise_date,
                "reasoning": reasoning
            }
        else:
            audit = AuditTrailEntry(
                step_name="P2P_PARSER",
                action_details=f"AI Promise Tracker: Read customer response: '{req.message}' but found no payment commitment. Explanation: {reasoning}.",
                meta_info={"customer_message": req.message, "reasoning": reasoning}
            )
            state.audit_trail.append(audit)
            save_state(state)
            
            await manager.broadcast({
                "event": "promise_logged",
                "txn_id": req.txn_id
            })
            
            return {
                "status": "ignored",
                "promise_date": None,
                "reasoning": reasoning
            }
            
    except Exception as e:
        logger.error(f"Error handling customer reply webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static React frontend build assets in production
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API Endpoint Not Found")
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    uvicorn.run("server:app", host=host, port=port, reload=False)
