import React from 'react';
import type { CacheStats, CaseDetailState } from '../types';

interface SandboxModalProps {
  onClose: () => void;
  sandboxScenario: string;
  handleScenarioChange: (val: string) => void;
  sandboxName: string;
  setSandboxName: (val: string) => void;
  sandboxAmount: number;
  setSandboxAmount: (val: number) => void;
  sandboxType: string;
  setSandboxType: (val: string) => void;
  sandboxRetries: number;
  setSandboxRetries: (val: number) => void;
  sandboxCode: string;
  setSandboxCode: (val: string) => void;
  templateHinglish: boolean;
  setTemplateHinglish: (val: boolean) => void;
  handleTriggerSandbox: () => void;
  simRunning: boolean;
  cacheStats: CacheStats | null;
  handleClearCache: () => void;
  simLog: string[];
  simOutput: CaseDetailState | null;
  templatePreview: { channel: string; message: string } | null;
  batchSize: number;
  setBatchSize: (val: number) => void;
  genBatchReset: boolean;
  setGenBatchReset: (val: boolean) => void;
  handleGenBatch: () => void;
  handleResetDb: () => void;
  actionsLoading: boolean;
  actionsMessage: string;
  tempMax: number;
  sysMax: number;
  subMax: number;
}

export const SandboxModal: React.FC<SandboxModalProps> = ({
  onClose,
  sandboxScenario,
  handleScenarioChange,
  sandboxName,
  setSandboxName,
  sandboxAmount,
  setSandboxAmount,
  sandboxType,
  setSandboxType,
  sandboxRetries,
  setSandboxRetries,
  sandboxCode,
  setSandboxCode,
  templateHinglish,
  setTemplateHinglish,
  handleTriggerSandbox,
  simRunning,
  cacheStats,
  handleClearCache,
  simLog,
  simOutput,
  templatePreview,
  batchSize,
  setBatchSize,
  genBatchReset,
  setGenBatchReset,
  handleGenBatch,
  handleResetDb,
  actionsLoading,
  actionsMessage,
  tempMax,
  sysMax,
  subMax
}) => {
  // Mapping of category channels to failure codes
  const failureOptionsMap: Record<string, { code: string; label: string }[]> = {
    payment: [
      { code: 'insufficient_funds', label: 'Insufficient Funds (Standard Payment Decline)' },
      { code: 'card_expired', label: 'Expired Card (Expired instrument)' },
      { code: 'incorrect_otp', label: 'Incorrect OTP Entry (Verification Timeout)' },
      { code: 'otp_timeout', label: 'OTP Code Timeout' },
      { code: 'card_blocked', label: 'Card Blocked / Flagged' },
      { code: 'incorrect_cvv', label: 'Incorrect CVV Security Code' },
      { code: 'incorrect_pin', label: 'Incorrect PIN Entry' },
      { code: 'limit_exceeded', label: 'Daily Transaction Limit Exceeded' },
      { code: 'fraud_suspicion', label: 'Stolen Card / Fraud Risk (Immediate Escalation)' },
      { code: 'issuer_unavailable', label: 'Card Issuing Bank Offline' },
      { code: 'bank_server_downtime', label: 'Bank Server Downtime (Network failure)' }
    ],
    checkout: [
      { code: 'user_dropped_out', label: 'User Exited Payment Page (Dropped out)' },
      { code: 'cart_abandoned', label: 'Cart Abandoned (Form loaded but not submitted)' },
      { code: 'payment_page_closed', label: 'Payment Tab Closed mid-process' }
    ],
    subscription: [
      { code: 'mandate_failed', label: 'Mandate Registration Failed (E-Mandate error)' },
      { code: 'recurring_limit_exceeded', label: 'Subscription Cap Limit Exceeded' },
      { code: 'account_closed', label: 'Underlying Bank Account Closed' }
    ],
    invoice: [
      { code: 'invoice_unpaid', label: 'Invoice Unpaid (Pending manual credit transfer)' },
      { code: 'payment_overdue', label: 'Payment Overdue (Past net credit days limit)' }
    ]
  };

  const options = failureOptionsMap[sandboxType] || [];
  const isCustomCodeSelected = sandboxScenario.includes("Custom") || !options.some(opt => opt.code === sandboxCode);
  const selectedDropdownValue = isCustomCodeSelected ? 'custom' : sandboxCode;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px'
    }}>
      <div className="bento-card" style={{
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(139, 92, 246, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚙️ AURUM Developer Sandbox
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', margin: '4px 0 0 0' }}>Trigger simulated webhooks, verify LLM Cache stats, and generate/reset transaction batches.</p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            [✕]
          </button>
        </div>

        <div className="bento-grid">
          {/* Webhook Sandbox */}
          <div className="bento-card bento-col-8">
            <span className="kpi-title" style={{ display: 'block', marginBottom: '16px' }}>Ingest Simulated Webhook decliner</span>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '16px' }}>
              <div className="form-group">
                <label>Quick Scenario Presets</label>
                <select className="form-control" value={sandboxScenario} onChange={(e) => handleScenarioChange(e.target.value)}>
                  <option value="insufficient_funds">Insufficient Funds (Standard Payment Decline)</option>
                  <option value="card_expired">Expired Card (Requires replacement card details)</option>
                  <option value="bank_server_downtime">Bank Server Downtime (System Timeout retry spacing)</option>
                  <option value="incorrect_otp">Incorrect OTP / Verification Timeout (Temporary)</option>
                  <option value="fraud_suspicion">Stolen Card / Fraud Risk (Immediate Escalation)</option>
                  <option value="B2B Invoice - 5 Days Overdue">B2B Invoice - 5 Days Overdue (Email followups)</option>
                  <option value="B2B Invoice - 14 Days Overdue">B2B Invoice - 14 Days Overdue (Escalation queue)</option>
                  <option value="Subscription Mandate Failure">Subscription Mandate Failure (Subscription retry spacing)</option>
                  <option value="Custom Gateway String">Custom Failure Decline Code (Write your own)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Customer Name</label>
                <input type="text" className="form-control" value={sandboxName} onChange={(e) => setSandboxName(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
              <div className="form-group">
                <label>Amount (INR)</label>
                <input type="number" className="form-control" value={sandboxAmount} onChange={(e) => setSandboxAmount(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Channel Type</label>
                <select className="form-control" value={sandboxType} onChange={(e) => {
                  const newType = e.target.value;
                  setSandboxType(newType);
                  // Prefill default code for new type
                  if (failureOptionsMap[newType]) {
                    setSandboxCode(failureOptionsMap[newType][0].code);
                  }
                }}>
                  <option value="payment">PAYMENT</option>
                  <option value="checkout">CHECKOUT</option>
                  <option value="subscription">SUBSCRIPTION</option>
                  <option value="invoice">INVOICE</option>
                </select>
              </div>
              <div className="form-group">
                <label>Existing Retry Count</label>
                <select className="form-control" value={sandboxRetries} onChange={(e) => setSandboxRetries(Number(e.target.value))}>
                  <option value={0}>0 Attempts</option>
                  <option value={1}>1 Attempt</option>
                  <option value={2}>2 Attempts</option>
                  <option value={3}>3 Attempts</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Decline Reason / Failure Code</label>
                <select 
                  className="form-control" 
                  value={selectedDropdownValue} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      handleScenarioChange('Custom Gateway String');
                      setSandboxCode('custom_gateway_code');
                    } else {
                      setSandboxCode(val);
                    }
                  }}
                >
                  {options.map((opt) => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                  <option value="custom">Other (Specify Custom Gateway Code...)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Raw Gateway Decline String</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={sandboxCode} 
                  onChange={(e) => setSandboxCode(e.target.value)} 
                  disabled={!isCustomCodeSelected} 
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={templateHinglish} onChange={(e) => setTemplateHinglish(e.target.checked)} />
                Use Conversational Hinglish Copy (WhatsApp/SMS)
              </label>
            </div>

            <button className="btn" onClick={handleTriggerSandbox} disabled={simRunning}>
              🔥 Trigger Webhook Ingestion
            </button>
          </div>

          {/* Cache cost analytics */}
          <div className="bento-card bento-col-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span className="kpi-title">LLM Cache Analytics</span>
            {cacheStats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cache Hits:</span> <b>{cacheStats.hits}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>LLM Calls:</span> <b>{cacheStats.misses}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hit Ratio:</span> <b>{cacheStats.hit_ratio_percent.toFixed(1)}%</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-emerald)' }}>
                  <span>Tokens Saved:</span> <b>{cacheStats.tokens_saved}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-purple)' }}>
                  <span>Cost Saved:</span> <b>${cacheStats.usd_saved.toFixed(5)}</b>
                </div>
                <button className="btn btn-secondary" onClick={handleClearCache} style={{ width: '100%', padding: '8px', fontSize: '12px', marginTop: '10px' }}>
                  🧹 Clear Cache Register
                </button>
              </div>
            )}
          </div>

          {/* Ingress logs terminal */}
          <div className="bento-card bento-col-12" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="kpi-title">Real-Time Ingestion Logs (WebSocket Stream)</span>
            <div style={{ 
              backgroundColor: '#050608', 
              borderRadius: '10px', 
              padding: '16px', 
              minHeight: '200px', 
              fontFamily: 'monospace', 
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8)'
            }}>
              {simLog.map((log, idx) => (
                <div key={idx} style={{ color: log.includes('Node') ? 'var(--text-secondary)' : 'var(--text-main)' }}>
                  {log}
                </div>
              ))}
              {simRunning && <div style={{ color: 'var(--accent-purple)', animation: 'pulse 1s infinite' }}>⚡ Streaming node updates...</div>}
              {simLog.length === 0 && <div style={{ color: 'var(--text-sub)' }}>Simulate webhook event to stream live traces.</div>}
            </div>
          </div>

          {/* Smartphone Mockup */}
          {simOutput && templatePreview && (
            <div className="bento-card bento-col-12" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="kpi-title" style={{ marginBottom: '16px' }}>Outbound Dispatch preview</span>
              
              {templatePreview.channel === 'WhatsApp' && (
                <div className="phone-mockup">
                  <div className="phone-header">
                    <span>💬 Sageant WhatsApp Bot</span>
                    <span>Verified ✓</span>
                  </div>
                  <div className="phone-body">
                    {templatePreview.message}
                  </div>
                </div>
              )}

              {templatePreview.channel === 'SMS' && (
                <div className="phone-mockup" style={{ backgroundColor: '#111' }}>
                  <div className="phone-header" style={{ color: 'var(--accent-blue)' }}>
                    <span>💬 Carrier SMS Network</span>
                    <span>Sent</span>
                  </div>
                  <div className="phone-body" style={{ backgroundColor: 'var(--accent-blue)', borderRadius: '12px' }}>
                    {templatePreview.message}
                  </div>
                </div>
              )}

              {templatePreview.channel === 'Email' && (
                <div style={{ 
                  backgroundColor: '#1b1d24', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  color: 'var(--text-main)',
                  width: '100%',
                  maxWidth: '600px'
                }}>
                  <div style={{ 
                    borderBottom: '1px solid var(--border-subtle)', 
                    paddingBottom: '8px', 
                    marginBottom: '12px', 
                    fontSize: '13px', 
                    fontWeight: 'bold', 
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>📧 Outgoing SMTP Corporate Email</span>
                    <span>Delivered</span>
                  </div>
                  <div style={{ padding: '14px', fontSize: '13px', lineHeight: '1.6', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{templatePreview.message}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batch configuration controls */}
          <div className="bento-card bento-col-12">
            <span className="kpi-title" style={{ display: 'block', marginBottom: '16px' }}>Developer Database Resets</span>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Generate batch counts</label>
                <input type="number" className="form-control" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Dunning Config retries max limit</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', marginTop: '10px' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>Customer Failures: <b>{tempMax}</b></div>
                  <div style={{ whiteSpace: 'nowrap' }}>System Errors: <b>{sysMax}</b></div>
                  <div style={{ whiteSpace: 'nowrap' }}>Subscriptions: <b>{subMax}</b></div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-sub)' }}>
                <input type="checkbox" checked={genBatchReset} onChange={(e) => setGenBatchReset(e.target.checked)} />
                Wipe Database before generating new synthetic events
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={handleGenBatch} disabled={actionsLoading}>
                🔄 Generate Batch
              </button>
              <button className="btn btn-danger" onClick={handleResetDb} disabled={actionsLoading}>
                🗑️ Wipe Case Log History
                  </button>
                </div>
                {actionsMessage && (
                  <div style={{ color: 'var(--accent-amber)', fontSize: '13px', marginTop: '12px' }}>{actionsMessage}</div>
                )}
              </div>
            </div>
          </div>
        </div>
  );
};
