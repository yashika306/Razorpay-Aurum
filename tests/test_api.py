import pytest
from fastapi.testclient import TestClient
from server import app
from core.models import TransactionStatus, TransactionType

client = TestClient(app)

def test_api_get_metrics():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "total_at_risk" in data
    assert "total_recovered" in data
    assert "recovery_rate" in data

def test_api_get_cases():
    response = client.get("/api/cases")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_api_webhook_simulation():
    import random
    rand_id = f"pay_test_{random.randint(100000, 999999)}"
    webhook_payload = {
        "event": "payment.failed",
        "payload": {
            "id": rand_id,
            "customer_id": f"cust_test_{random.randint(10000, 99999)}",
            "customer_name": "Test Webhook Customer",
            "customer_email": "test@webhook.com",
            "customer_phone": "+91 99999 88888",
            "amount": 25000.00,
            "failure_code": "insufficient_funds",
            "retry_count": 0
        }
    }
    response = client.post("/api/webhooks/razorpay", json=webhook_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processed"
    assert data["txn_id"] == rand_id
    assert "recovery_status" in data

def test_api_sandbox_trigger():
    import random
    rand_id = f"sandbox_test_{random.randint(100000, 999999)}"
    txn_payload = {
        "txn_id": rand_id,
        "customer_id": f"cust_sandbox_{random.randint(10000, 99999)}",
        "customer_name": "Sandbox Test Name",
        "customer_email": "sandbox@test.com",
        "customer_phone": "+91 98765 43210",
        "type": "payment",
        "amount": 10000.00,
        "failure_code": "bank_server_downtime",
        "retry_count": 0,
        "status": "failed",
        "timestamp": "2026-08-26T12:00:00"
    }
    response = client.post("/api/sandbox/trigger", json=txn_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transaction"]["txn_id"] == rand_id
    assert "current_status" in data

def test_api_cache_stats():
    response = client.get("/api/cache/stats")
    assert response.status_code == 200
    data = response.json()
    assert "hit_ratio_percent" in data
    assert "tokens_saved" in data
