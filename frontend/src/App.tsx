import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ActiveTransactionsTable } from './components/ActiveTransactionsTable';
import { CaseAuditorDrawer } from './components/CaseAuditorDrawer';
import { RulesOverride } from './components/RulesOverride';
import { SandboxModal } from './components/SandboxModal';
import type { Transaction, Metrics, CacheStats, CaseDetailState } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'policies'>('dashboard');
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cases, setCases] = useState<Transaction[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetailState | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Guardrail Policy settings
  const [tempMax] = useState(2);
  const [sysMax] = useState(3);
  const [subMax] = useState(2);

  // Batch actions loading
  const [batchSize, setBatchSize] = useState(25);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsMessage, setActionsMessage] = useState('');

  // Sandbox Form
  const [sandboxScenario, setSandboxScenario] = useState('insufficient_funds');
  const [sandboxName, setSandboxName] = useState('Amit Patel');
  const [sandboxAmount, setSandboxAmount] = useState(12500);
  const [sandboxType, setSandboxType] = useState('payment');
  const [sandboxCode, setSandboxCode] = useState('insufficient_funds');
  const [sandboxRetries, setSandboxRetries] = useState(0);

  // Sandbox Simulation execution states
  const [simRunning, setSimRunning] = useState(false);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simOutput, setSimOutput] = useState<CaseDetailState | null>(null);

  // Promise Form state
  const [promiseDate, setPromiseDate] = useState('');
  const [showPromiseInput, setShowPromiseInput] = useState(false);

  // Customer Reply Simulator state
  const [customerReplyMsg, setCustomerReplyMsg] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Outreach Template Preview
  const [templateHinglish, setTemplateHinglish] = useState(true);
  const [templatePreview, setTemplatePreview] = useState<{ channel: string; message: string } | null>(null);

  // Merchant Custom Policies
  const [merchantRules, setMerchantRules] = useState<any[]>([]);
  const [newRuleField, setNewRuleField] = useState('amount');
  const [newRuleOp, setNewRuleOp] = useState('gt');
  const [newRuleVal, setNewRuleVal] = useState('100000');
  const [newRuleAction, setNewRuleAction] = useState('escalate');
  const [newRuleName, setNewRuleName] = useState('High Value Guard');
  const [newRuleDesc, setNewRuleDesc] = useState('Automatically escalate high-value payments to customer success agent queue.');
  const [genBatchReset, setGenBatchReset] = useState(false);

  useEffect(() => {
    fetchData();
    fetchPolicies();

    // Setup WebSockets Connection
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/ws`);

    ws.onopen = () => {
      console.log("WebSocket stream connected successfully.");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "pipeline_started") {
          setSimLog([`📥 Webhook Event Ingested: Txn ${msg.txn_id} (${msg.type.toUpperCase()}) for ${msg.customer_name} (₹${msg.amount.toLocaleString('en-IN')})`]);
          setSimRunning(true);
        } else if (msg.event === "node_processed") {
          setSimLog(prev => [...prev, `⚙️ Node [${msg.step_name}]: ${msg.action_details}`]);
        } else if (msg.event === "pipeline_finished") {
          setSimRunning(false);
          fetchData();
        } else if (msg.event === "promise_logged") {
          fetchData();
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const fetchData = async () => {
    try {
      const resMet = await fetch('/api/metrics');
      const dataMet = await resMet.json();
      setMetrics(dataMet);

      const resCases = await fetch('/api/cases');
      const dataCases = await resCases.json();
      setCases(dataCases);

      const resCache = await fetch('/api/cache/stats');
      const dataCache = await resCache.json();
      setCacheStats(dataCache);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/policies');
      const data = await res.json();
      setMerchantRules(data);
    } catch (err) {
      console.error(err);
    }
  };

  const inspectCase = async (txn_id: string) => {
    try {
      const res = await fetch(`/api/cases/${txn_id}`);
      const data = await res.json();
      setSelectedCase(data);
      setDetailOpen(true);
      setShowPromiseInput(false);
      setPromiseDate('');
    } catch (err) {
      console.error("Error inspecting case:", err);
    }
  };

  const submitPromise = async (txn_id: string) => {
    if (!promiseDate) return;
    try {
      await fetch(`/api/cases/${txn_id}/promise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promise_date: promiseDate })
      });
      await inspectCase(txn_id);
      await fetchData();
      setShowPromiseInput(false);
    } catch (err) {
      console.error(err);
    }
  };

  const sendCustomerReply = async () => {
    if (!selectedCase || !customerReplyMsg.trim()) return;
    setReplyLoading(true);
    try {
      const res = await fetch('/api/webhooks/customer-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_id: selectedCase.transaction.txn_id,
          message: customerReplyMsg
        })
      });
      const data = await res.json();
      alert(`AI P2P Tracker: ${data.reasoning}`);
      setCustomerReplyMsg('');
      await inspectCase(selectedCase.transaction.txn_id);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setReplyLoading(false);
    }
  };

  const [pipelineRunning, setPipelineRunning] = useState(false);

  const handleRunCasePipeline = async () => {
    if (!selectedCase) return;
    setPipelineRunning(true);
    try {
      await fetch('/api/cases/run-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn_id: selectedCase.transaction.txn_id })
      });
      await inspectCase(selectedCase.transaction.txn_id);
      await fetchData();
    } catch (err) {
      console.error("Failed to run case pipeline:", err);
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleQuickRunPipeline = async (txnId: string) => {
    try {
      await fetch('/api/cases/run-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn_id: txnId })
      });
      if (selectedCase && selectedCase.transaction.txn_id === txnId) {
        await inspectCase(txnId);
      }
      await fetchData();
    } catch (err) {
      console.error("Failed to run quick case pipeline:", err);
    }
  };

  const handleScenarioChange = (val: string) => {
    setSandboxScenario(val);
    setSandboxName("Amit Patel");
    setSandboxAmount(12500);
    setSandboxType("payment");
    setSandboxCode("insufficient_funds");
    setSandboxRetries(0);

    if (val.includes("Expired Card")) {
      setSandboxCode("card_expired");
      setSandboxAmount(8999);
    } else if (val.includes("Bank Server Downtime")) {
      setSandboxCode("bank_server_downtime");
      setSandboxAmount(15000);
    } else if (val.includes("Incorrect OTP")) {
      setSandboxCode("incorrect_otp");
      setSandboxAmount(4500);
    } else if (val.includes("Fraud")) {
      setSandboxCode("fraud_suspicion");
      setSandboxAmount(35000);
    } else if (val.includes("B2B Invoice - 5 Days")) {
      setSandboxName("Acme Corp (Finance)");
      setSandboxCode("invoice_unpaid");
      setSandboxType("invoice");
      setSandboxAmount(125000);
    } else if (val.includes("B2B Invoice - 14 Days")) {
      setSandboxName("Zenith Tech");
      setSandboxCode("invoice_unpaid");
      setSandboxType("invoice");
      setSandboxAmount(250000);
    } else if (val.includes("Subscription Mandate")) {
      setSandboxCode("mandate_failed");
      setSandboxType("subscription");
      setSandboxAmount(1999);
    } else if (val.includes("Custom")) {
      setSandboxCode("Gateway decline code: 3D_SECURE_AUTH_FAILED");
    }
  };

  const handleTriggerSandbox = async () => {
    setSimRunning(true);
    setSimLog([]);
    setSimOutput(null);

    const txnPayload = {
      txn_id: `sandbox_txn_${Math.floor(Math.random() * 900000) + 100000}`,
      customer_id: `cust_${Math.floor(Math.random() * 90000) + 10000}`,
      customer_name: sandboxName,
      customer_email: "sandbox@example.com",
      customer_phone: "+91 98765 43210",
      type: sandboxType,
      amount: sandboxAmount,
      failure_code: sandboxCode,
      retry_count: sandboxRetries,
      status: sandboxType === 'payment' ? 'failed' : (sandboxType === 'checkout' ? 'abandoned' : 'overdue'),
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/sandbox/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txnPayload)
      });
      const data: CaseDetailState = await res.json();
      setSimOutput(data);

      if (data.executions.length > 0) {
        const previewRes = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: sandboxType,
            customer_name: sandboxName,
            amount: sandboxAmount,
            failure_code: sandboxCode,
            use_hinglish: templateHinglish,
            tone: sandboxScenario.includes("14 Days") ? "firm" : (sandboxScenario.includes("Escalation") ? "escalate" : "gentle")
          })
        });
        const previewData = await previewRes.json();
        setTemplatePreview(previewData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimRunning(false);
      await fetchData();
    }
  };

  const handleClearCache = async () => {
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
      alert("LLM Cache stats cleared successfully.");
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenBatch = async () => {
    setActionsLoading(true);
    setActionsMessage('Generating synthetic payment failures...');
    try {
      const res = await fetch(`/api/cases/generate?count=${batchSize}&reset=${genBatchReset}`, {
        method: 'POST'
      });
      const data = await res.json();
      setActionsMessage(data.message);
      await fetchData();
    } catch (err) {
      console.error(err);
      setActionsMessage('Generation failed.');
    } finally {
      setActionsLoading(false);
    }
  };

  const handleResetDb = async () => {
    if (!confirm("Are you sure you want to wipe all transaction history?")) return;
    setActionsLoading(true);
    setActionsMessage('Wiping mock database case logs...');
    try {
      const res = await fetch('/api/database/reset', { method: 'POST' });
      const data = await res.json();
      setActionsMessage(data.message);
      setSelectedCase(null);
      setDetailOpen(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setActionsMessage('Reset failed.');
    } finally {
      setActionsLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleName.trim() || !newRuleVal.trim()) {
      alert("Provide a rule name and compare value.");
      return;
    }
    const valParsed = isNaN(Number(newRuleVal)) ? newRuleVal : Number(newRuleVal);
    const newRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName,
      condition_field: newRuleField,
      operator: newRuleOp,
      condition_value: valParsed,
      action: newRuleAction,
      description: newRuleDesc
    };

    const updatedRules = [...merchantRules, newRule];
    try {
      await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRules)
      });
      setNewRuleName('');
      setNewRuleDesc('');
      await fetchPolicies();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const updated = merchantRules.filter(r => r.id !== id);
    try {
      await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      await fetchPolicies();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        setSandboxOpen={setSandboxOpen} 
      />

      <div className="main-content">
        {currentTab === 'dashboard' ? (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">AURUM — Revenue Operations Console</h1>
                <p className="page-subtitle">AI-powered payment failure recovery, automated dunning, and revenue intelligence.</p>
              </div>
            </div>

            <MetricsDashboard 
              metrics={metrics} 
              onFilterStatus={setStatusFilter}
              onFilterType={setTypeFilter}
            />
            
            <ActiveTransactionsTable 
              cases={cases}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              onSelectCase={inspectCase}
              onRunPipeline={handleQuickRunPipeline}
            />
          </>
        ) : (
          <RulesOverride 
            merchantRules={merchantRules}
            handleDeleteRule={handleDeleteRule}
            newRuleName={newRuleName}
            setNewRuleName={setNewRuleName}
            newRuleAction={newRuleAction}
            setNewRuleAction={setNewRuleAction}
            newRuleField={newRuleField}
            setNewRuleField={setNewRuleField}
            newRuleOp={newRuleOp}
            setNewRuleOp={setNewRuleOp}
            newRuleVal={newRuleVal}
            setNewRuleVal={setNewRuleVal}
            newRuleDesc={newRuleDesc}
            setNewRuleDesc={setNewRuleDesc}
            handleAddRule={handleAddRule}
          />
        )}
      </div>

      {detailOpen && selectedCase && (
        <CaseAuditorDrawer 
          selectedCase={selectedCase}
          showPromiseInput={showPromiseInput}
          setShowPromiseInput={setShowPromiseInput}
          promiseDate={promiseDate}
          setPromiseDate={setPromiseDate}
          submitPromise={submitPromise}
          customerReplyMsg={customerReplyMsg}
          setCustomerReplyMsg={setCustomerReplyMsg}
          sendCustomerReply={sendCustomerReply}
          replyLoading={replyLoading}
          pipelineRunning={pipelineRunning}
          handleRunCasePipeline={handleRunCasePipeline}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {sandboxOpen && (
        <SandboxModal 
          onClose={() => setSandboxOpen(false)}
          sandboxScenario={sandboxScenario}
          handleScenarioChange={handleScenarioChange}
          sandboxName={sandboxName}
          setSandboxName={setSandboxName}
          sandboxAmount={sandboxAmount}
          setSandboxAmount={setSandboxAmount}
          sandboxType={sandboxType}
          setSandboxType={setSandboxType}
          sandboxRetries={sandboxRetries}
          setSandboxRetries={setSandboxRetries}
          sandboxCode={sandboxCode}
          setSandboxCode={setSandboxCode}
          templateHinglish={templateHinglish}
          setTemplateHinglish={setTemplateHinglish}
          handleTriggerSandbox={handleTriggerSandbox}
          simRunning={simRunning}
          cacheStats={cacheStats}
          handleClearCache={handleClearCache}
          simLog={simLog}
          simOutput={simOutput}
          templatePreview={templatePreview}
          batchSize={batchSize}

          setBatchSize={setBatchSize}
          genBatchReset={genBatchReset}
          setGenBatchReset={setGenBatchReset}
          handleGenBatch={handleGenBatch}
          handleResetDb={handleResetDb}
          actionsLoading={actionsLoading}
          actionsMessage={actionsMessage}
          tempMax={tempMax}
          sysMax={sysMax}
          subMax={subMax}
        />
      )}
    </div>
  );
}
