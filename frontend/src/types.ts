export interface Transaction {
  txn_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  type: string;
  amount: number;
  retry_count: number;
  status: string;
  failure_code: string;
  category: string;
  timestamp: string;
  promise_date?: string;
}

export interface Metrics {
  total_at_risk: number;
  total_recovered: number;
  recovery_rate: number;
  active_escalations: number;
  total_cost_usd: number;
  total_tokens: number;
  categories_breakdown: Record<string, number>;
  type_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  total_count: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  total_requests: number;
  hit_ratio_percent: number;
  tokens_saved: number;
  usd_saved: number;
}

export interface AuditEntry {
  step_name: string;
  action_details: string;
  meta_info: Record<string, any>;
  timestamp: string;
}

export interface Diagnosis {
  root_cause: string;
  category: string;
  confidence: string;
  reasoning: string;
  diagnosed_at: string;
}

export interface Intervention {
  action_type: string;
  details: string;
  scheduled_time: string;
  retry_attempt_number: number;
  policy_applied: string;
}

export interface ExecutionResult {
  status: string;
  amount_recovered: number;
  logs: string;
  executed_at: string;
}

export interface CaseDetailState {
  transaction: Transaction;
  diagnoses: Diagnosis[];
  decisions: Intervention[];
  executions: ExecutionResult[];
  audit_trail: AuditEntry[];
  current_status: string;
  total_tokens_used: number;
  total_cost_usd: number;
}
