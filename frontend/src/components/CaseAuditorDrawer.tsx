import React from 'react';
import { X } from 'lucide-react';
import type { CaseDetailState } from '../types';

interface CaseAuditorDrawerProps {
  selectedCase: CaseDetailState | null;
  showPromiseInput: boolean;
  setShowPromiseInput: (val: boolean) => void;
  promiseDate: string;
  setPromiseDate: (val: string) => void;
  submitPromise: (txn_id: string) => void;
  customerReplyMsg: string;
  setCustomerReplyMsg: (val: string) => void;
  sendCustomerReply: () => void;
  replyLoading: boolean;
  pipelineRunning: boolean;
  handleRunCasePipeline: () => void;
  onClose: () => void;
}

export const CaseAuditorDrawer: React.FC<CaseAuditorDrawerProps> = ({
  selectedCase,
  showPromiseInput,
  setShowPromiseInput,
  promiseDate,
  setPromiseDate,
  submitPromise,
  customerReplyMsg,
  setCustomerReplyMsg,
  sendCustomerReply,
  replyLoading,
  pipelineRunning,
  handleRunCasePipeline,
  onClose
}) => {
  if (!selectedCase) return null;

  const isCardIssue = ['card_expired', 'card_invalid', 'fraud_suspicion'].includes(selectedCase.transaction.failure_code);

  // Map raw channel types to friendly user labels
  const getFriendlyChannel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'payment': return 'Payment Decline Auto-Retry';
      case 'checkout': return 'Checkout Cart Recovery';
      case 'subscription': return 'Failed Recurring Subscription';
      case 'invoice': return 'Overdue B2B Receivables';
      default: return type.toUpperCase();
    }
  };

  // Map raw error categories to friendly user labels
  const getFriendlyCategory = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'customer_side_temporary': return 'Temporary Customer Issue (e.g., Insufficient funds, Timeout)';
      case 'customer_side_permanent': return 'Permanent Account Issue (e.g., Expired card, Suspended account)';
      case 'system_side': return 'Payment Network Downtime (e.g., Bank server timeout)';
      default: return cat.toUpperCase();
    }
  };

  // Map raw dunning action types to merchant labels
  const getFriendlyAction = (action: string) => {
    switch (action.toLowerCase()) {
      case 'retry': return 'Automated Payment Gateway Retry';
      case 'message': return 'Digital Reminder Dispatched (SMS / WhatsApp)';
      case 'call': return 'Hinglish IVR Voice Outreach Call';
      case 'escalate': return 'Forwarded to Billing Support Desk (Human CS)';
      default: return action.toUpperCase();
    }
  };

  // Map LangGraph node names to human friendly titles
  const getFriendlyNodeName = (name: string) => {
    switch (name.toUpperCase()) {
      case 'DETECT': return '🔍 System Ingested Decline';
      case 'DIAGNOSE': return '🧠 AI Failure Analysis';
      case 'DECIDE': return '⚖️ Routing Rule Applied';
      case 'EXECUTE': return '✉️ Outreach Notification Sent';
      case 'LOG': return '📝 Audit Log Registered';
      case 'P2P_PARSER': return '🗓️ AI Promise Date Detected';
      case 'PROMISE_TRACKER': return '🗓️ Customer Promise Registered';
      case 'RECOVERY_PIPELINE': return '⚡ Auto-Retry Completed';
      case 'SAFETY_GUARDRAIL': return '🛡️ Safety Gate Escalated';
      default: return name;
    }
  };

  // Stepper calculations for 2-second visual scan
  const auditSteps = selectedCase.audit_trail.map(a => a.step_name.toUpperCase());
  const hasDetect = auditSteps.includes('DETECT') || auditSteps.includes('RECOVERY_PIPELINE');
  const hasDiagnose = auditSteps.includes('DIAGNOSE');
  const hasDecide = auditSteps.includes('DECIDE');
  const hasExecute = auditSteps.includes('EXECUTE') || selectedCase.executions.length > 0;
  const isSettled = selectedCase.current_status === 'success';
  const isEscalated = selectedCase.current_status === 'escalated';
  const isPromised = selectedCase.current_status === 'promised';
  const hasSettledNode = isSettled || isEscalated || isPromised || auditSteps.includes('P2P_PARSER') || auditSteps.includes('PROMISE_TRACKER');

  return (
    <div style={{ 
      position: 'fixed', 
      right: 0, 
      top: 0, 
      height: '100vh', 
      width: '540px', 
      backgroundColor: 'var(--bg-dark-surface)', 
      borderLeft: '1px solid var(--border-subtle)', 
      boxShadow: '-15px 0 40px rgba(0,0,0,0.7)',
      padding: '32px',
      overflowY: 'auto',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--accent-purple)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>⚡ AURUM</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Recovery Audit — <code style={{ color: 'var(--accent-purple)' }}>#{selectedCase.transaction.txn_id}</code>
          </h3>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      {/* 2-Second Scannability Visual Pipeline Stepper */}
      <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
        <span className="kpi-title" style={{ display: 'block', marginBottom: '16px' }}>Recovery Pipeline Tracker</span>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 10px', marginBottom: '8px' }}>
          {/* Background Line */}
          <div style={{
            position: 'absolute',
            left: '30px',
            right: '30px',
            top: '12px',
            height: '2px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            zIndex: 1
          }} />
          
          {/* Active Line */}
          <div style={{
            position: 'absolute',
            left: '30px',
            top: '12px',
            height: '2px',
            width: `${
              hasSettledNode ? 100 : (hasExecute ? 75 : (hasDecide ? 50 : (hasDiagnose ? 25 : 0)))
            }%`,
            background: 'linear-gradient(90deg, var(--accent-emerald) 0%, var(--accent-purple) 100%)',
            boxShadow: '0 0 8px var(--accent-purple)',
            zIndex: 2,
            transition: 'width 0.4s ease'
          }} />

          {/* Stepper nodes */}
          {[
            { label: 'Ingested', active: hasDetect, color: 'var(--accent-emerald)' },
            { label: 'Diagnosed', active: hasDiagnose, color: 'var(--accent-purple)' },
            { label: 'Routed', active: hasDecide, color: 'var(--accent-purple)' },
            { label: 'Dispatched', active: hasExecute, color: 'var(--accent-blue)' },
            { 
              label: isSettled ? 'Settled' : (isEscalated ? 'Escalated' : (isPromised ? 'Promised' : 'Settled')), 
              active: hasSettledNode, 
              color: isSettled ? 'var(--accent-emerald)' : (isEscalated ? 'var(--accent-rose)' : (isPromised ? 'var(--accent-blue)' : 'var(--text-sub)')) 
            }
          ].map((st, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 3, width: '60px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: st.active ? st.color : '#13151b',
                border: `2px solid ${st.active ? st.color : 'rgba(255,255,255,0.08)'}`,
                boxShadow: st.active ? `0 0 10px ${st.color}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                color: st.active ? '#000' : 'var(--text-sub)',
                transition: 'all 0.3s ease'
              }}>
                {st.active ? '✓' : i + 1}
              </div>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: st.active ? 'bold' : 'normal', 
                color: st.active ? 'var(--text-main)' : 'var(--text-sub)',
                whiteSpace: 'nowrap',
                textAlign: 'center'
              }}>
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Details */}
      <div>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: '10px', letterSpacing: '1px' }}>Customer & Transaction Details</h4>
        <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div>Customer: <b>{selectedCase.transaction.customer_name}</b></div>
          <div>Mobile: <b>{selectedCase.transaction.customer_phone}</b></div>
          <div>Email: <b>{selectedCase.transaction.customer_email}</b></div>
          <div>Channel: <b>{getFriendlyChannel(selectedCase.transaction.type)}</b></div>
          <div>Amount Due: <b>₹{selectedCase.transaction.amount.toLocaleString('en-IN')}</b></div>
          <div>Recovery Status: <span className={`badge badge-${selectedCase.current_status}`}>{selectedCase.current_status}</span></div>
        </div>
      </div>

      {/* Run Recovery Pipeline Trigger (only for unprocessed cases) */}
      {selectedCase.diagnoses.length === 0 && (
        <div style={{ padding: '16px', border: '1px solid var(--accent-purple)', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>⚡ Start AI Dunning Assist</div>
          <p style={{ fontSize: '11px', color: 'var(--text-sub)', lineHeight: '1.4', margin: 0 }}>
            This case is currently waiting in the queue. Run the recovery sequence to analyze the decline reason and start automated customer outreach.
          </p>
          <button 
            className="btn" 
            onClick={handleRunCasePipeline} 
            disabled={pipelineRunning}
            style={{ width: '100%', padding: '10px', fontSize: '12px' }}
          >
            {pipelineRunning ? '⚙️ Initializing Recovery Agent...' : '🚀 Execute Recovery Sequence'}
          </button>
        </div>
      )}

      {/* Action Tools based on status, channel type, and failure eligibility */}
      {['failed', 'abandoned', 'overdue'].includes(selectedCase.current_status) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* CHECKOUT ABANDONMENT — No debt exists. Send cart recovery link only. */}
          {selectedCase.transaction.type === 'checkout' ? (
            <div style={{ padding: '16px', border: '1px dashed var(--accent-emerald)', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 'bold', marginBottom: '6px' }}>🛒 Cart Recovery Action</div>
              <p style={{ fontSize: '11px', color: 'var(--text-sub)', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                The customer left their cart without completing checkout. No payment obligation exists — Promise-to-Pay is not applicable here.
                Send a secure cart recovery link to bring them back.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => alert("Cart recovery link with pre-filled checkout sent to customer's WhatsApp and email.")}
                style={{ width: '100%', fontSize: '12px' }}
              >
                🔗 Resend Cart Recovery Link
              </button>
            </div>

          ) : isCardIssue ? (
            /* EXPIRED / INVALID CARD — Send billing form, not P2P */
            <div style={{ padding: '16px', border: '1px dashed var(--accent-amber)', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.02)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-amber)', fontWeight: 'bold', marginBottom: '6px' }}>💳 Replace Payment Method</div>
              <p style={{ fontSize: '11px', color: 'var(--text-sub)', marginBottom: '12px', lineHeight: '1.4', margin: 0 }}>
                This card has expired or is invalid. Promise-to-Pay calendar is locked since a new payment method is required. Click below to send a secure billing form to the customer.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => alert("Secure billing update link dispatched to customer's contact points.")}
                style={{ width: '100%', fontSize: '12px', marginTop: '10px' }}
              >
                🔗 Send Billing Update Form Link
              </button>
            </div>

          ) : (
            /* PAYMENT / INVOICE / SUBSCRIPTION — Real obligation, P2P is valid */
            <>
              <div style={{ padding: '16px', border: '1px dashed var(--accent-blue)', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.02)' }}>
                {!showPromiseInput ? (
                  <button className="btn btn-secondary" onClick={() => setShowPromiseInput(true)} style={{ width: '100%', fontSize: '13px' }}>
                    🗓️ Record Promised Pay Date
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 'bold' }}>Set Promised Date</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="date" className="form-control" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                      <button className="btn" onClick={() => submitPromise(selectedCase.transaction.txn_id)}>Save</button>
                      <button className="btn btn-secondary" onClick={() => setShowPromiseInput(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* 💬 Customer Reply Simulator (Promise-to-Pay AI Parser) */}
              {selectedCase.diagnoses.length > 0 && (
                <div style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    💬 Simulate Customer SMS Response (Promise Parsing)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={customerReplyMsg}
                      onChange={(e) => setCustomerReplyMsg(e.target.value)}
                      placeholder="e.g., Will complete payment by next Friday"
                    />
                    <button className="btn" onClick={sendCustomerReply} disabled={replyLoading} style={{ padding: '8px', fontSize: '12px' }}>
                      {replyLoading ? 'Analyzing Response...' : 'Submit Message'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Diagnosis Summary */}
      <div>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: '10px', letterSpacing: '1px' }}>AI Reason Analysis</h4>
        {selectedCase.diagnoses.length > 0 ? (
          <div style={{ padding: '16px', backgroundColor: 'rgba(139, 92, 246, 0.03)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '8px', fontSize: '13px' }}>
            <div>Root Cause: <b>{selectedCase.diagnoses[0].root_cause}</b></div>
            <div style={{ marginTop: '6px', color: 'var(--text-sub)' }}>Classification: <b>{getFriendlyCategory(selectedCase.diagnoses[0].category)}</b></div>
            <div style={{ 
              marginTop: '12px', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(0,0,0,0.15)', 
              borderRadius: '6px', 
              fontStyle: 'italic', 
              lineHeight: '1.5',
              borderLeft: '3px solid var(--accent-purple)',
              color: 'var(--text-main)' 
            }}>
              "{selectedCase.diagnoses[0].reasoning}"
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px', border: '1px dashed rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-sub)', fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            🔍 Transaction queued for automated analysis.
          </div>
        )}
      </div>

      {/* Intervention Logs */}
      <div>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: '10px', letterSpacing: '1px' }}>Dunning & Recovery Timeline</h4>
        {selectedCase.executions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedCase.executions.map((exe, idx) => {
              const dec = selectedCase.decisions[idx];
              return (
                <div key={idx} style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{getFriendlyAction(dec?.action_type || '')}</span>
                    <span className={`badge badge-${exe.status.toLowerCase()}`}>
                      {exe.status === 'success' ? 'COMPLETED' : exe.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                    Rule Triggered: <i>{dec?.policy_applied}</i>
                  </div>
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '12px 14px', 
                    backgroundColor: 'rgba(0, 0, 0, 0.15)', 
                    borderRadius: '6px', 
                    fontSize: '12px', 
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {exe.logs}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '14px', border: '1px dashed rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-sub)', fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            📥 No recovery outreach actions triggered yet.
          </div>
        )}
      </div>

      {/* Outbound Call Mockup Dialer */}
      {selectedCase.decisions.some(d => d.action_type === 'call') && (
        <div className="phone-mockup" style={{ width: '100%' }}>
          <div className="phone-header">
            <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', animation: 'pulse 1s infinite' }} />
              IVR Voice Dial Assist
            </span>
            <span>Calling... 📞</span>
          </div>
          <div className="phone-body" style={{ backgroundColor: '#131920', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Conversational Speech Script (Hinglish):</span>
            <p style={{ fontStyle: 'italic', lineHeight: '1.4', fontSize: '12px', color: 'var(--text-main)' }}>
              "Namaste {selectedCase.transaction.customer_name}! Main Sageant Autonomous Voice Assist se bol rahi hoon. Aapka payment fail ho gaya tha. Aapki Rs {selectedCase.transaction.amount.toLocaleString('en-IN')} ki billing hum complete nahi kar paye. Please direct link check karein jo humne WhatsApp par bheji hai. Dhanyawaad!"
            </p>
          </div>
        </div>
      )}

      {/* Collapsed Developer Accordion for Node Trace */}
      {selectedCase.audit_trail.length > 0 && (
        <details style={{ 
          marginTop: '16px', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: '8px', 
          padding: '12px', 
          backgroundColor: 'rgba(0,0,0,0.1)' 
        }}>
          <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-sub)', fontWeight: 'bold', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🛠️ Developer Trace Logs (LangGraph Node Execution)</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>[Click to Expand]</span>
          </summary>
          <div style={{ marginTop: '16px' }}>
            <div className="timeline">
              {selectedCase.audit_trail.map((entry, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-header">{getFriendlyNodeName(entry.step_name)}</div>
                  <div className="timeline-details">{entry.action_details}</div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};
