import React from 'react';

interface RulesOverrideProps {
  merchantRules: any[];
  handleDeleteRule: (id: string) => void;
  newRuleName: string;
  setNewRuleName: (val: string) => void;
  newRuleAction: string;
  setNewRuleAction: (val: string) => void;
  newRuleField: string;
  setNewRuleField: (val: string) => void;
  newRuleOp: string;
  setNewRuleOp: (val: string) => void;
  newRuleVal: string;
  setNewRuleVal: (val: string) => void;
  newRuleDesc: string;
  setNewRuleDesc: (val: string) => void;
  handleAddRule: () => void;
}

export const RulesOverride: React.FC<RulesOverrideProps> = ({
  merchantRules,
  handleDeleteRule,
  newRuleName,
  setNewRuleName,
  newRuleAction,
  setNewRuleAction,
  newRuleField,
  setNewRuleField,
  newRuleOp,
  setNewRuleOp,
  newRuleVal,
  setNewRuleVal,
  newRuleDesc,
  setNewRuleDesc,
  handleAddRule
}) => {
  const getFriendlyOp = (op: string) => {
    switch (op) {
      case 'eq': return 'equals';
      case 'gt': return 'is greater than';
      case 'lt': return 'is less than';
      default: return op;
    }
  };

  const getFriendlyField = (field: string) => {
    switch (field) {
      case 'amount': return 'Amount (INR)';
      case 'failure_code': return 'Failure reason code';
      case 'status': return 'Recovery status';
      case 'type': return 'Transaction type';
      default: return field;
    }
  };

  const getFriendlyAction = (action: string) => {
    switch (action) {
      case 'escalate': return 'Forward to Support Rep';
      case 'message': return 'Send Custom Outreach Reminder';
      case 'snooze': return 'Snooze Spacing notifications';
      default: return action;
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Override Policies</h1>
          <p className="page-subtitle">Deploy custom routing logic to bypass AI choices and enforce strict payment rules.</p>
        </div>
      </div>

      <div className="bento-grid">
        {/* Active Rules List */}
        <div className="bento-card bento-col-12" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span className="kpi-title">Active Rules Override Register</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.isArray(merchantRules) && merchantRules.map((rule, idx) => (
              <div key={rule.id || idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '16px', 
                backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                border: '1px solid var(--border-subtle)', 
                borderRadius: '8px' 
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-main)' }}>
                    {idx + 1}. {rule.name || 'Unnamed Rule'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    If <b>{getFriendlyField(rule.condition_field)}</b> {getFriendlyOp(rule.operator)} <b>{String(rule.condition_value ?? '')}</b> ➔ Enforce: <b style={{ color: 'var(--accent-purple)' }}>{getFriendlyAction(rule.action)}</b>
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-sub)', fontStyle: 'italic', marginTop: '2px' }}>
                    {rule.description || 'No description provided.'}
                  </span>
                </div>
                <button className="btn btn-danger" onClick={() => handleDeleteRule(rule.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Delete Rule
                </button>
              </div>
            ))}
            {(!Array.isArray(merchantRules) || merchantRules.length === 0) && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-sub)', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                No custom rules deployed. Default AI spacing routes are handling all payments.
              </div>
            )}
          </div>
        </div>

        {/* Form to Add Rule */}
        <div className="bento-card bento-col-12">
          <span className="kpi-title" style={{ display: 'block', marginBottom: '16px' }}>Configure New Policy Rule</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '16px' }}>
            <div className="form-group">
              <label>Rule Name</label>
              <input type="text" className="form-control" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} placeholder="e.g., Enterprise Risk Threshold" />
            </div>
            <div className="form-group">
              <label>Enforced Action</label>
              <select className="form-control" value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                <option value="escalate">Forward to Support Rep (Human CS Escalation)</option>
                <option value="message">Send Digital Outreach Reminder (SMS / WhatsApp)</option>
                <option value="snooze">Snooze Spacing (Pause recovery messages)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '16px' }}>
            <div className="form-group">
              <label>Field</label>
              <select className="form-control" value={newRuleField} onChange={(e) => setNewRuleField(e.target.value)}>
                <option value="amount">Amount (INR)</option>
                <option value="failure_code">Failure Code</option>
                <option value="status">Status</option>
                <option value="type">Channel Type</option>
              </select>
            </div>
            <div className="form-group">
              <label>Operator</label>
              <select className="form-control" value={newRuleOp} onChange={(e) => setNewRuleOp(e.target.value)}>
                <option value="eq">Equals (=)</option>
                <option value="gt">Greater Than (&gt;)</option>
                <option value="lt">Less Than (&lt;)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Compare Value</label>
              <input type="text" className="form-control" value={newRuleVal} onChange={(e) => setNewRuleVal(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Rule Description / Audit Note</label>
            <textarea className="form-control" rows={2} value={newRuleDesc} onChange={(e) => setNewRuleDesc(e.target.value)} placeholder="Describe why this rule override should be triggered..." />
          </div>

          <button className="btn" onClick={handleAddRule}>
            ➕ Deploy Rule
          </button>
        </div>
      </div>
    </>
  );
};
