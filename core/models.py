from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class TransactionStatus(str, Enum):
    FAILED = "failed"
    ABANDONED = "abandoned"
    OVERDUE = "overdue"
    SUCCESS = "success"
    ESCALATED = "escalated"
    IN_PROGRESS = "in_progress"
    PROMISED = "promised"

class TransactionType(str, Enum):
    PAYMENT = "payment"
    CHECKOUT = "checkout"
    SUBSCRIPTION = "subscription"
    INVOICE = "invoice"

class Transaction(BaseModel):
    txn_id: str
    type: TransactionType
    status: TransactionStatus
    amount: float
    failure_code: Optional[str] = None  # e.g., "insufficient_funds", "otp_timeout", etc.
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    timestamp: datetime
    retry_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)

class FailureCategory(str, Enum):
    CUSTOMER_SIDE_TEMPORARY = "customer_side_temporary"
    CUSTOMER_SIDE_PERMANENT = "customer_side_permanent"
    SYSTEM_SIDE = "system_side"

class Diagnosis(BaseModel):
    root_cause: str
    category: FailureCategory
    confidence: str  # "high", "medium", "low"
    reasoning: str
    diagnosed_at: datetime = Field(default_factory=datetime.now)

class InterventionType(str, Enum):
    RETRY = "retry"
    MESSAGE = "message"
    ESCALATE = "escalate"
    CALL = "call"

class Intervention(BaseModel):
    action_type: InterventionType
    details: str
    scheduled_time: datetime
    retry_attempt_number: int
    policy_applied: str
    created_at: datetime = Field(default_factory=datetime.now)

class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"

class ExecutionResult(BaseModel):
    status: ExecutionStatus
    amount_recovered: float
    logs: str
    token_usage: Dict[str, int] = Field(default_factory=dict)
    cost_usd: float = 0.0
    executed_at: datetime = Field(default_factory=datetime.now)

class AuditTrailEntry(BaseModel):
    step_name: str
    timestamp: datetime = Field(default_factory=datetime.now)
    action_details: str
    meta_info: Dict[str, Any] = Field(default_factory=dict)

class RecoveryState(BaseModel):
    transaction: Transaction
    diagnoses: List[Diagnosis] = Field(default_factory=list)
    decisions: List[Intervention] = Field(default_factory=list)
    executions: List[ExecutionResult] = Field(default_factory=list)
    audit_trail: List[AuditTrailEntry] = Field(default_factory=list)
    current_status: TransactionStatus = TransactionStatus.IN_PROGRESS
    total_tokens_used: int = 0
    total_cost_usd: float = 0.0
