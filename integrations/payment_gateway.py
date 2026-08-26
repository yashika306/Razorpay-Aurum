import time
import random
import logging
from typing import Tuple
from core.models import Transaction, ExecutionStatus

logger = logging.getLogger(__name__)

def retry_payment(transaction: Transaction, attempt_num: int) -> Tuple[ExecutionStatus, float, str]:
    """
    Simulates a payment retry call to Razorpay APIs.
    Determines success dynamically based on the failure code, category, and retry attempt count.
    
    Returns:
        Tuple[ExecutionStatus, amount_recovered, logs]
    """
    logger.info(f"Simulating Razorpay Payment Retry for Txn: {transaction.txn_id}, Attempt: {attempt_num}")
    
    # Introduce small latency to simulate API call overhead
    time.sleep(0.3)
    
    logs = f"[{transaction.timestamp.isoformat()}] Initiating API request POST /v1/payments/{transaction.txn_id}/retry. "
    logs += f"Attempt number: {attempt_num}. "
    
    # Logic for simulation
    code = transaction.failure_code or ""
    
    if code in ["card_expired", "invalid_account_details", "customer_blacklisted"]:
        # Permanent failure - 0% recovery chance
        logs += "API Response 400 Bad Request: Payment method is permanently invalid. Rejecting retry."
        return ExecutionStatus.FAILED, 0.0, logs
        
    elif code in ["bank_server_downtime", "gateway_timeout", "network_connection_lost"]:
        # Transient system issue - High probability of success on retry (e.g., 85%)
        success_chance = 0.85
        if random.random() < success_chance:
            logs += "API Response 200 OK: Payment processed successfully after gateway connection reset."
            return ExecutionStatus.SUCCESS, transaction.amount, logs
        else:
            logs += "API Response 502 Bad Gateway: Bank server is still unreachable."
            return ExecutionStatus.FAILED, 0.0, logs
            
    elif code in ["insufficient_funds"]:
        # Customer temporary issue - Immediate retries usually fail. Spaced retries (representing 24h spacing) succeed more often.
        # If retry_count is 0, it means it's the first retry (simulated spaced out).
        # We assume our scheduler spaced it, so we give it a 60% chance.
        success_chance = 0.60
        if random.random() < success_chance:
            logs += "API Response 200 OK: Payment succeeded. Customer account balance verified."
            return ExecutionStatus.SUCCESS, transaction.amount, logs
        else:
            logs += "API Response 400 Bad Request: Insufficient balance still detected in customer account."
            return ExecutionStatus.FAILED, 0.0, logs
            
    elif code in ["otp_timeout", "payment_page_closed"]:
        # User temporary checkout failure - Retrying the card directly might work if user authorization is still valid,
        # but typically fails without a new OTP. Let's say 25% chance of success (auto-retry mechanism)
        success_chance = 0.25
        if random.random() < success_chance:
            logs += "API Response 200 OK: Payment processed using fallback cached pre-auth token."
            return ExecutionStatus.SUCCESS, transaction.amount, logs
        else:
            logs += "API Response 401 Unauthorized: Customer authentication required. OTP expired."
            return ExecutionStatus.FAILED, 0.0, logs

    # Default fallback fallback
    if random.random() < 0.5:
        logs += "API Response 200 OK: Payment retry successful (default fallback)."
        return ExecutionStatus.SUCCESS, transaction.amount, logs
    else:
        logs += "API Response 400 Bad Request: General transaction decline."
        return ExecutionStatus.FAILED, 0.0, logs
