import pytest
from datetime import datetime
from core.models import Transaction, TransactionType, TransactionStatus, RecoveryState
from core.pipeline import run_recovery_pipeline

def test_pipeline_execution_payment_failure():
    # Setup a mock transient payment failure transaction
    txn = Transaction(
        txn_id="test_txn_999",
        type=TransactionType.PAYMENT,
        status=TransactionStatus.FAILED,
        amount=5000.0,
        failure_code="bank_server_downtime",
        customer_id="cust_test_999",
        customer_name="Test Customer",
        customer_email="test@customer.com",
        customer_phone="+919999999999",
        timestamp=datetime.now(),
        retry_count=0
    )
    
    # Run through pipeline
    result = run_recovery_pipeline(txn)
    
    # Verify result properties
    assert isinstance(result, RecoveryState)
    assert result.transaction.txn_id == "test_txn_999"
    assert len(result.diagnoses) > 0
    assert len(result.decisions) > 0
    assert len(result.executions) > 0
    assert len(result.audit_trail) >= 5 # Flagged, Diagnosed, Decided, Executed, Logged
    
    # Verify diagnosis category is parsed
    assert result.diagnoses[-1].category.value in ["system_side", "customer_side_temporary", "customer_side_permanent"]

def test_pipeline_execution_checkout_abandonment():
    # Setup a mock checkout abandonment transaction
    txn = Transaction(
        txn_id="test_checkout_888",
        type=TransactionType.CHECKOUT,
        status=TransactionStatus.ABANDONED,
        amount=1500.0,
        failure_code="cart_abandoned",
        customer_id="cust_test_888",
        customer_name="Test Buyer",
        customer_email="buyer@test.com",
        customer_phone="+918888888888",
        timestamp=datetime.now(),
        retry_count=0
    )
    
    result = run_recovery_pipeline(txn)
    
    assert result.transaction.txn_id == "test_checkout_888"
    assert len(result.decisions) > 0
    # Decided action for checkout abandonment should be a message reminder
    assert result.decisions[-1].action_type.value == "message"
