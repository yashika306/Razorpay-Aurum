# ⚡ AURUM — Submission & Developer Testing Guide

This guide explains how AURUM works, how to run automated tests, and how to verify the recovery workflows manually using the Developer Sandbox.

---

## 🏁 Step 1: Generate Mock Data (Start Here!)
Before testing, you need to populate the database with active failed transactions:
1. Open the application in your browser: **[https://aurum-1070790426798.us-central1.run.app](https://aurum-1070790426798.us-central1.run.app)**.
2. In the sidebar, click the **⚙️ Developer Sandbox** button (at the bottom of the sidebar).
3. Under **Database Operations**, click **"🔄 Generate Fresh Mock Batch"** or **"🧹 Reset Database & Cache"**.
4. This instantly populates your dashboard with 10 high-fidelity transaction records representing payment declines, abandoned checkouts, failed subscription mandates, and overdue invoices.

---

## 🛠️ How the Application Works

AURUM is built as a closed-loop revenue recovery agent using a **5-node LangGraph state machine**:

```
[Webhook Event / Batch Ingestion]
                ↓
    ┌──────────────────────┐
    │ 1. DETECT Node       │ — Filters at-risk transactions and normalizes fields
    └──────────┬───────────┘
               ↓
    ┌──────────────────────┐
    │ 2. DIAGNOSE Node     │ — Gemini 3.6 Flash classifies gateway failures (Structured JSON)
    └──────────┬───────────┘
               ↓
    ┌──────────────────────┐
    │ 3. DECIDE Node       │ — Evaluates retry limits, fraud triggers & merchant policies
    └──────────┬───────────┘
               ↓
    ┌──────────────────────┐
    │ 4. EXECUTE Node      │ — Triggers automatic gateway retry, email, WhatsApp, or escalation
    └──────────┬───────────┘
               ↓
    ┌──────────────────────┐
    │ 5. LOG Node          │ — Writes a cryptographic audit entry & sends WebSocket update
    └──────────────────────┘
```

### ⚡ Technical Pillars:
*   **3-Tier Cache Engine:** Local Rules $\rightarrow$ JSON Cache $\rightarrow$ Live Gemini API. Minimizes latency to 0ms on hits and cuts LLM API costs by **97%**.
*   **Real-time WebSockets:** Broadcasts pipeline transitions live to the UI as they execute.
*   **NLP Promise Parser:** Gemini extracts and schedules promise-to-pay dates from customer responses (supporting Hinglish, e.g., *"Agle Tuesday ko pay kar dunga"*), automatically pausing dunning outreach.

---

## 🧪 How to Test Manually

### 1. Test a Custom Failure Code
1. Open the **Developer Sandbox**.
2. Select a channel (e.g., **Payment Decline Auto-Retry**).
3. Under **Gateway Failure Scenario**, select **Custom Code Override** and type any error (e.g., `insufficient_funds`).
4. Click **"🚀 Trigger Webhook Event"**.
5. The pipeline executes live. Watch the dashboard metrics update in real-time.

### 2. Test the Case Auditor & Visual Stepper
1. Click on any row in the **Operations Console** table.
2. The **Case Auditor Drawer** opens on the right.
3. Review the **5-step glowing stepper** (Ingested $\rightarrow$ Diagnosed $\rightarrow$ Routed $\rightarrow$ Dispatched $\rightarrow$ Settled).
4. Expand the **🛠️ Developer Trace Logs** accordion at the bottom to see the exact input, output, and reason logs for every LangGraph node execution.

### 3. Test the Promise-to-Pay Parser (Hinglish/NLP)
1. Select an active `failed` payment case in the table.
2. In the Auditor Drawer, locate the **💬 Simulate Customer SMS Response** input.
3. Type: `"I will pay next Friday"` or `"Paise agle Monday tak bhej dunga"`.
4. Click **Submit Message**.
5. Gemini will parse the text, extract the exact date, update the case status to **PROMISED**, register the date, and pause all automated reminders.

---

## 💻 How to Test Automatically (Automated Suite)

AURUM includes 17 unit and integration tests covering the state machine, API endpoints, webhook security, and cache layers.

### Run tests locally:
```bash
# 1. Activate your virtual environment
.\venv\Scripts\activate

# 2. Run pytest
pytest tests/ -v
```

### Verified Test Suite:
*   `test_api_webhook_simulation`: Verifies API ingest payload processing.
*   `test_tier_1_local_rule_caching`: Assesses 0ms latency local rule lookup.
*   `test_retry_guardrails_escalation`: Validates retry limits and automated human handoff.
*   `test_autonomous_p2p_parser`: Tests Gemini's temporal parsing on multilingual responses.
*   `test_webhook_security_gates`: Confirms payload signature checks.
