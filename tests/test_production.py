import os
import json
import hmac
import hashlib
import pytest
from fastapi.testclient import TestClient
from server import app
from core.models import Transaction, TransactionStatus, TransactionType

client = TestClient(app)

# Helper to generate HMAC signature
def make_signature(body: bytes, secret: str = "revive_webhook_secret_9999") -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

def test_webhook_security_gates():
    import random
    rand_id = f"secure_txn_{random.randint(100000, 999999)}"
    payload = {
        "event": "payment.failed",
        "payload": {
            "id": rand_id,
            "customer_id": f"cust_sec_{random.randint(10000, 99999)}",
            "amount": 2500.0,
            "failure_code": "insufficient_funds"
        }
    }
    
    # Send request with INCORRECT signature header -> Assert 401 Unauthorized
    response = client.post(
        "/api/webhooks/razorpay", 
        json=payload, 
        headers={"X-Razorpay-Signature": "invalid_signature_hash"}
    )
    assert response.status_code == 401
    assert "Invalid HMAC webhook signature" in response.json()["detail"]

    # Send request with CORRECT signature header -> Assert 200 OK Processed
    body_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    valid_sig = make_signature(body_bytes)
    
    # fastapi TestClient handles json serialization differently, so let's send raw content
    response = client.post(
        "/api/webhooks/razorpay",
        content=body_bytes,
        headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processed"

def test_webhook_idempotency():
    import random
    rand_id = f"idempotent_txn_{random.randint(100000, 999999)}"
    # Trigger first transaction
    payload = {
        "event": "payment.failed",
        "payload": {
            "id": rand_id,
            "customer_id": f"cust_idemp_{random.randint(10000, 99999)}",
            "amount": 1000.0,
            "failure_code": "insufficient_funds"
        }
    }
    
    body_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    valid_sig = make_signature(body_bytes)
    
    # Process First time -> Expect processed
    res1 = client.post(
        "/api/webhooks/razorpay",
        content=body_bytes,
        headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"
    
    # Process Second time -> Expect duplicate warning dropped silently
    res2 = client.post(
        "/api/webhooks/razorpay",
        content=body_bytes,
        headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "idempotent_duplicate"
    assert "already been processed" in res2.json()["message"]

def test_merchant_policy_rules_override():
    # 1. Fetch current rules
    res_get = client.get("/api/policies")
    assert res_get.status_code == 200
    original_policies = res_get.json()
    
    # 2. Inject test rule: If amount > 50000 -> ESCALATE immediately
    test_rules = [
        {
            "id": "test_rule_limit",
            "name": "Heavy Limit Override",
            "condition_field": "amount",
            "operator": "gt",
            "condition_value": 50000.0,
            "action": "escalate",
            "description": "Bypass for massive ticket amounts."
        }
    ]
    res_post = client.post("/api/policies", json=test_rules)
    assert res_post.status_code == 200
    
    try:
        # Trigger sandbox flow with amount exceeding rule (amount=75,000)
        txn_payload = {
            "txn_id": "rule_test_txn_303",
            "customer_id": "cust_rule_303",
            "customer_name": "High Value User",
            "customer_email": "rule@test.com",
            "customer_phone": "+91 99999 88888",
            "type": "payment",
            "amount": 75000.0,
            "failure_code": "insufficient_funds",
            "retry_count": 0,
            "status": "failed",
            "timestamp": "2026-08-26T12:00:00"
        }
        res_trigger = client.post("/api/sandbox/trigger", json=txn_payload)
        assert res_trigger.status_code == 200
        
        final_state = res_trigger.json()
        dec = final_state["decisions"][-1]
        
        # Verify custom override triggered instead of category retries
        assert dec["action_type"] == "escalate"
        assert "Heavy Limit Override" in dec["policy_applied"]
        
    finally:
        # Restore original rules so we do not break persistent config
        client.post("/api/policies", json=original_policies)
