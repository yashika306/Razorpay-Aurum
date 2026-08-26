import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# LLM Pricing Constants (Gemini 1.5 Flash pricing in USD)
GEMINI_INPUT_COST_PER_TOKEN = 0.075 / 1_000_000
GEMINI_OUTPUT_COST_PER_TOKEN = 0.30 / 1_000_000

# Guardrail & Retry Policies (Max attempts)
POLICY_MAX_RETRIES = {
    "customer_side_temporary": 2,  # e.g., insufficient funds, timeout
    "customer_side_permanent": 0,  # e.g., expired card, closed account
    "system_side": 3,              # e.g., bank server downtime, network error
    "subscription_failed": 2,      # e.g., recurring mandate execution error
}

# Simulated Time Intervals (in seconds, representing real-world windows)
POLICY_RETRY_INTERVALS = {
    "customer_side_temporary": 10,  # Representing 24 hours
    "system_side": 2,              # Representing 1 hour
    "subscription_failed": 15,      # Representing 48 hours
}

# B2B Invoice Escalation Rules
# Representing reminders sent on Day 1 (Gentle), Day 7 (Firm), Day 14 (Escalate to human)
B2B_REMINDER_POLICY = {
    1: {"tone": "gentle", "action": "message"},
    2: {"tone": "firm", "action": "message"},
    3: {"tone": "final_notice", "action": "escalate"}
}

# App Persistence Settings
DB_FILE_PATH = os.path.join(os.path.dirname(__file__), "recovery_database.json")
