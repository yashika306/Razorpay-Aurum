import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from config import DB_FILE_PATH
from core.models import RecoveryState, TransactionStatus, Diagnosis

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def load_db() -> Dict[str, Any]:
    if not os.path.exists(DB_FILE_PATH):
        return {"states": {}, "diagnosis_cache": {}, "cache_metrics": {"hits": 0, "misses": 0}}
    try:
        with open(DB_FILE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if "states" not in data:
                data["states"] = {}
            if "diagnosis_cache" not in data:
                data["diagnosis_cache"] = {}
            if "cache_metrics" not in data:
                data["cache_metrics"] = {"hits": 0, "misses": 0}
            return data
    except Exception:
        return {"states": {}, "diagnosis_cache": {}, "cache_metrics": {"hits": 0, "misses": 0}}

def save_db(data: Dict[str, Any]):
    with open(DB_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, cls=DateTimeEncoder, indent=2)

def get_all_states() -> List[RecoveryState]:
    db_data = load_db()
    states = []
    for state_dict in db_data.get("states", {}).values():
        try:
            states.append(RecoveryState.model_validate(state_dict))
        except Exception:
            # Fallback for structural changes or debug
            pass
    return states

def get_state_by_txn_id(txn_id: str) -> Optional[RecoveryState]:
    db_data = load_db()
    state_dict = db_data.get("states", {}).get(txn_id)
    if not state_dict:
        return None
    try:
        return RecoveryState.model_validate(state_dict)
    except Exception:
        return None

def save_state(state: RecoveryState):
    db_data = load_db()
    db_data["states"][state.transaction.txn_id] = json.loads(state.model_dump_json())
    save_db(db_data)

def reset_db():
    db_data = load_db()
    db_data["states"] = {}
    save_db(db_data)

def get_cached_diagnosis(key: str) -> Optional[Diagnosis]:
    db_data = load_db()
    cache = db_data.get("diagnosis_cache", {})
    diag_dict = cache.get(key)
    if not diag_dict:
        return None
    try:
        from core.models import FailureCategory
        return Diagnosis(
            root_cause=diag_dict.get("root_cause", "Unknown"),
            category=FailureCategory(diag_dict.get("category", "system_side")),
            confidence=diag_dict.get("confidence", "medium"),
            reasoning=diag_dict.get("reasoning", "Cached reasoning"),
            diagnosed_at=datetime.fromisoformat(diag_dict.get("diagnosed_at")) if diag_dict.get("diagnosed_at") else datetime.now()
        )
    except Exception:
        return None

def save_cached_diagnosis(key: str, diagnosis: Diagnosis):
    db_data = load_db()
    db_data["diagnosis_cache"][key] = json.loads(diagnosis.model_dump_json())
    save_db(db_data)

def increment_cache_metric(metric_type: str):
    db_data = load_db()
    db_data["cache_metrics"][metric_type] = db_data["cache_metrics"].get(metric_type, 0) + 1
    save_db(db_data)

def get_cache_metrics() -> Dict[str, int]:
    db_data = load_db()
    return db_data.get("cache_metrics", {"hits": 0, "misses": 0})

def reset_cache():
    db_data = load_db()
    db_data["diagnosis_cache"] = {}
    db_data["cache_metrics"] = {"hits": 0, "misses": 0}
    save_db(db_data)

def get_metrics() -> Dict[str, Any]:
    states = get_all_states()
    
    total_at_risk = 0.0
    total_recovered = 0.0
    active_escalations = 0
    total_cost = 0.0
    total_tokens = 0
    
    categories_breakdown = {}
    type_breakdown = {}
    status_breakdown = {}

    for state in states:
        txn = state.transaction
        total_at_risk += txn.amount
        total_cost += state.total_cost_usd
        total_tokens += state.total_tokens_used

        # Check latest status
        status = state.current_status
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        if status == TransactionStatus.SUCCESS:
            total_recovered += txn.amount
        elif status == TransactionStatus.ESCALATED:
            active_escalations += 1

        # Failure category breakdown (from latest diagnosis if available)
        if state.diagnoses:
            cat = state.diagnoses[-1].category.value
            categories_breakdown[cat] = categories_breakdown.get(cat, 0) + 1
        
        # Txn Type breakdown
        txn_type = txn.type.value
        type_breakdown[txn_type] = type_breakdown.get(txn_type, 0) + 1

    recovery_rate = (total_recovered / total_at_risk * 100) if total_at_risk > 0 else 0.0

    return {
        "total_at_risk": total_at_risk,
        "total_recovered": total_recovered,
        "recovery_rate": recovery_rate,
        "active_escalations": active_escalations,
        "total_cost_usd": total_cost,
        "total_tokens": total_tokens,
        "categories_breakdown": categories_breakdown,
        "type_breakdown": type_breakdown,
        "status_breakdown": status_breakdown,
        "total_count": len(states)
    }
