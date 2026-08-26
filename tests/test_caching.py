import pytest
from datetime import datetime
from core.models import Transaction, TransactionType, TransactionStatus
from core.database import reset_cache, get_cache_metrics
from integrations.gemini import call_gemini_diagnose

def test_tier_1_local_rule_caching():
    # 1. Reset cache metrics
    reset_cache()
    metrics_before = get_cache_metrics()
    assert metrics_before["hits"] == 0
    
    # 2. Trigger diagnosis for standard decline code (insufficient_funds)
    # This matches STATIC_LOCAL_RULES (Tier 1)
    diag, tokens, cost = call_gemini_diagnose(
        txn_type="payment",
        failure_code="insufficient_funds",
        amount=1000.0,
        customer_name="Test User"
    )
    
    # 3. Verify it was solved via local rules, and hit metric is incremented
    assert "[Tier 1: Local Rule Match]" in diag.reasoning
    assert diag.confidence == "high"
    
    metrics_after = get_cache_metrics()
    assert metrics_after["hits"] == 1
    assert metrics_after["misses"] == 0
    assert tokens["total_tokens"] == 0

def test_tier_2_database_caching():
    # 1. Reset cache metrics
    reset_cache()
    
    # 2. Trigger first call for custom code not in static rules
    # This should be a cache miss
    diag1, tokens1, cost1 = call_gemini_diagnose(
        txn_type="payment",
        failure_code="custom_random_gateway_error_999",
        amount=2500.0,
        customer_name="Test User"
    )
    
    metrics_mid = get_cache_metrics()
    assert metrics_mid["misses"] == 1
    assert metrics_mid["hits"] == 0
    
    # 3. Trigger second call with exact same parameters
    # This should hit the database cache (Tier 2)
    diag2, tokens2, cost2 = call_gemini_diagnose(
        txn_type="payment",
        failure_code="custom_random_gateway_error_999",
        amount=2500.0,
        customer_name="Test User"
    )
    
    # 4. Verify it was solved via Cache Hit (Tier 2) and hit metric is incremented
    assert "[Tier 2: Cache Hit]" in diag2.reasoning
    assert tokens2["total_tokens"] == 0  # No LLM called
    
    metrics_final = get_cache_metrics()
    assert metrics_final["hits"] == 1
    assert metrics_final["misses"] == 1
