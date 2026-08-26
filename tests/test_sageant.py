import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from server import app
from core.models import Transaction, TransactionType, TransactionStatus, FailureCategory, InterventionType, Diagnosis
from core.pipeline import decide_node, PipelineState
from core.database import get_state_by_txn_id, save_state, RecoveryState
from integrations.notifier import send_ivr_voice_call
from integrations.gemini import parse_customer_reply_for_promise

client = TestClient(app)

def test_npci_mandate_retry_sequencer():
    # 1. First attempt -> Should schedule retry with NPCI 3-business-day spacing
    txn1 = Transaction(
        txn_id="sub_test_001",
        customer_id="cust_sub_001",
        customer_name="Test Subscription User",
        customer_email="sub@test.com",
        customer_phone="+91 99999 88888",
        type=TransactionType.SUBSCRIPTION,
        amount=5000.0,
        failure_code="mandate_debit_failed",
        retry_count=0,
        status=TransactionStatus.FAILED,
        timestamp=datetime.now()
    )
    
    state1: PipelineState = {
        "transaction": txn1,
        "diagnoses": [Diagnosis(root_cause="Mandate failed", category=FailureCategory.CUSTOMER_SIDE_TEMPORARY, confidence="high", reasoning="Test")],
        "decisions": [],
        "executions": [],
        "audit_trail": [],
        "current_status": TransactionStatus.IN_PROGRESS,
        "total_tokens_used": 0,
        "total_cost_usd": 0.0
    }
    
    res_state = decide_node(state1)
    decision = res_state["decisions"][-1]
    assert decision.action_type == InterventionType.RETRY
    assert "clearing day" in decision.details
    assert "NPCI Compliance" in decision.policy_applied
    
    # 2. After 2 retries -> Should plan a CALL instead of another gateway retry
    txn2 = Transaction(
        txn_id="sub_test_002",
        customer_id="cust_sub_002",
        customer_name="Test Subscription User",
        customer_email="sub@test.com",
        customer_phone="+91 99999 88888",
        type=TransactionType.SUBSCRIPTION,
        amount=5000.0,
        failure_code="mandate_debit_failed",
        retry_count=2,
        status=TransactionStatus.FAILED,
        timestamp=datetime.now()
    )
    
    state2: PipelineState = {
        "transaction": txn2,
        "diagnoses": [Diagnosis(root_cause="Mandate failed", category=FailureCategory.CUSTOMER_SIDE_TEMPORARY, confidence="high", reasoning="Test")],
        "decisions": [],
        "executions": [],
        "audit_trail": [],
        "current_status": TransactionStatus.IN_PROGRESS,
        "total_tokens_used": 0,
        "total_cost_usd": 0.0
    }
    
    res_state2 = decide_node(state2)
    decision2 = res_state2["decisions"][-1]
    assert decision2.action_type == InterventionType.CALL
    assert "exhausted" in decision2.details


def test_ivr_hinglish_voice_script():
    txn = Transaction(
        txn_id="call_test_001",
        customer_id="cust_call_001",
        customer_name="Ramesh Kumar",
        customer_email="ramesh@test.com",
        customer_phone="+91 98765 43210",
        type=TransactionType.PAYMENT,
        amount=15000.0,
        failure_code="insufficient_funds",
        retry_count=2,
        status=TransactionStatus.FAILED,
        timestamp=datetime.now()
    )
    
    diag = Diagnosis(
        root_cause="Insufficient account balance",
        category=FailureCategory.CUSTOMER_SIDE_TEMPORARY,
        confidence="high",
        reasoning="Test reasoning for IVR"
    )
    
    status, logs = send_ivr_voice_call(txn, diag)
    assert status == "success"
    assert "Nameste" in logs or "Namaste" in logs
    assert "Exotel" in logs
    assert "TTS Hinglish script" in logs


def test_autonomous_p2p_parser():
    # Setup a dummy transaction in DB
    txn = Transaction(
        txn_id="p2p_test_999",
        customer_id="cust_p2p_999",
        customer_name="Sanjay Sharma",
        customer_email="sanjay@test.com",
        customer_phone="+91 99999 77777",
        type=TransactionType.PAYMENT,
        amount=25000.0,
        failure_code="insufficient_funds",
        retry_count=0,
        status=TransactionStatus.FAILED,
        timestamp=datetime.now()
    )
    db_state = RecoveryState(transaction=txn)
    save_state(db_state)
    
    # 1. Simulate customer text reply indicating a promise to pay next Tuesday
    payload = {
        "txn_id": "p2p_test_999",
        "message": "Agle hafte Tuesday ko payment clear kar dunga"
    }
    
    response = client.post("/api/webhooks/customer-reply", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["promise_date"] is not None
    
    # Verify DB state has updated to PROMISED and contains metadata date
    updated_state = get_state_by_txn_id("p2p_test_999")
    assert updated_state.current_status == TransactionStatus.PROMISED
    assert updated_state.transaction.metadata.get("promise_date") == data["promise_date"]
