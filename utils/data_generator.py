import random
from datetime import datetime, timedelta
from typing import List
from core.models import Transaction, TransactionType, TransactionStatus

# Lists of realistic Indian customer profiles
INDIAN_NAMES = [
    "Aarav Patel", "Priya Sharma", "Rohan Verma", "Neha Iyer", "Aditya Gupta",
    "Anjali Reddy", "Vikram Singh", "Divya Nair", "Amit Sen", "Sneha Joshi",
    "Rajesh Rao", "Kavita Deshmukh", "Siddharth Malhotra", "Pooja Hegde", "Sandeep Kumar",
    "Meera Nair", "Rahul Bose", "Deepa Pillai", "Karan Johar", "Shalini Bhatia",
    "Gaurav Chawla", "Preeti Shenoy", "Suresh Raina", "Sunita Williams", "Manish Pandey"
]

DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "corp.in", "acme.co.in", "techstart.io"]

PAYMENT_FAILURE_CODES = [
    "insufficient_funds", "bank_server_downtime", "otp_timeout", 
    "card_expired", "gateway_timeout", "network_connection_lost"
]

CHECKOUT_FAILURE_CODES = [
    "user_dropped_out", "cart_abandoned", "payment_page_closed"
]

SUBSCRIPTION_FAILURE_CODES = [
    "insufficient_funds", "invalid_account_details", "gateway_timeout", "bank_server_downtime"
]

INVOICE_FAILURE_CODES = [
    "invoice_unpaid", "payment_pending"
]

def generate_synthetic_transactions(count: int = 50, seed: int = None) -> List[Transaction]:
    """
    Generates a list of realistic synthetic failed or pending transactions 
    representing B2C and B2B checkout flows.
    """
    if seed is not None:
        random.seed(seed)
        
    transactions = []
    now = datetime.now()
    
    for i in range(count):
        txn_id = f"pay_failed_{100000 + i}"
        customer_name = random.choice(INDIAN_NAMES)
        first_name = customer_name.split()[0].lower()
        last_name = customer_name.split()[1].lower()
        customer_email = f"{first_name}.{last_name}@{random.choice(DOMAINS)}"
        customer_phone = f"+91987{random.randint(10, 99)}5{random.randint(100, 999)}"
        
        # Decide transaction type
        txn_type = random.choices(
            [TransactionType.PAYMENT, TransactionType.CHECKOUT, TransactionType.SUBSCRIPTION, TransactionType.INVOICE],
            weights=[0.35, 0.35, 0.15, 0.15],
            k=1
        )[0]
        
        # Setup specific details based on type
        if txn_type == TransactionType.PAYMENT:
            amount = round(random.uniform(500, 15000), 2)
            status = TransactionStatus.FAILED
            failure_code = random.choice(PAYMENT_FAILURE_CODES)
            # Timestamp scattered in the last 24 hours
            hours_ago = random.randint(1, 24)
            timestamp = now - timedelta(hours=hours_ago)
            
        elif txn_type == TransactionType.CHECKOUT:
            amount = round(random.uniform(300, 8000), 2)
            status = TransactionStatus.ABANDONED
            failure_code = random.choice(CHECKOUT_FAILURE_CODES)
            # Timestamp scattered in the last 12 hours
            hours_ago = random.randint(1, 12)
            timestamp = now - timedelta(hours=hours_ago)
            
        elif txn_type == TransactionType.SUBSCRIPTION:
            amount = round(random.uniform(299, 4999), 2)
            status = TransactionStatus.FAILED
            failure_code = random.choice(SUBSCRIPTION_FAILURE_CODES)
            # Timestamp scattered in the last 48 hours
            hours_ago = random.randint(1, 48)
            timestamp = now - timedelta(hours=hours_ago)
            
        else: # B2B Invoice
            amount = round(random.uniform(25000, 150000), 2)
            status = TransactionStatus.OVERDUE
            failure_code = random.choice(INVOICE_FAILURE_CODES)
            
            # Aging of invoice determines retry/escalation state
            # Day 1: 1 day ago, Day 7: 7 days ago, Day 14: 14 days ago
            days_ago = random.choice([1, 7, 14])
            timestamp = now - timedelta(days=days_ago)
            
        # Pydantic validates and instantiates the Transaction object
        txn = Transaction(
            txn_id=txn_id,
            type=txn_type,
            status=status,
            amount=amount,
            failure_code=failure_code,
            customer_id=f"cust_{1000 + i}",
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            timestamp=timestamp,
            retry_count=0,
            metadata={"source": "generator_v1"}
        )
        transactions.append(txn)
        
    # Sort transactions by timestamp (oldest first)
    transactions.sort(key=lambda x: x.timestamp)
    return transactions
