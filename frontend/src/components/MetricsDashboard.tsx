import React from 'react';
import type { Metrics } from '../types';

interface MetricsDashboardProps {
  metrics: Metrics | null;
  onFilterStatus?: (status: string) => void;
  onFilterType?: (type: string) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ 
  metrics,
  onFilterStatus,
  onFilterType
}) => {
  if (!metrics) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-sub)' }}>
        ⏳ Loading metrics database...
      </div>
    );
  }

  return (
    <>
      {/* Metrics Row - Bento Style */}
      <div className="bento-grid">
        <div className="bento-card bento-col-3">
          <span className="kpi-title">Revenue At Risk</span>
          <span className="kpi-value" style={{ color: 'var(--accent-rose)', display: 'block', marginTop: '4px' }}>
            ₹{metrics.total_at_risk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <div className="kpi-detail">Pending Recovery Spacing</div>
        </div>

        <div 
          className="bento-card bento-col-3" 
          onClick={() => onFilterStatus && onFilterStatus('SUCCESS')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease' }}
          title="Click to filter table by Recovered cases"
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-emerald)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          <span className="kpi-title">Revenue Recovered</span>
          <span className="kpi-value" style={{ color: 'var(--accent-emerald)', display: 'block', marginTop: '4px' }}>
            ₹{metrics.total_recovered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <div className="kpi-detail">Closed-loop Recovery Successful</div>
        </div>

        <div className="bento-card bento-col-3">
          <span className="kpi-title">Recovery Success Rate</span>
          <span className="kpi-value" style={{ color: 'var(--accent-blue)', display: 'block', marginTop: '4px' }}>
            {metrics.recovery_rate.toFixed(1)}%
          </span>
          <div className="kpi-detail">Performance Indicator</div>
        </div>

        <div 
          className="bento-card bento-col-3" 
          onClick={() => onFilterStatus && onFilterStatus('ESCALATED')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease' }}
          title="Click to filter table by Escalations"
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-amber)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          <span className="kpi-title">Active Escalations</span>
          <span className="kpi-value" style={{ color: 'var(--accent-amber)', display: 'block', marginTop: '4px' }}>
            {metrics.active_escalations}
          </span>
          <div className="kpi-detail">Forwarded to Operations</div>
        </div>
      </div>

      {/* Custom visual chart card and metrics split */}
      {metrics.total_count > 0 && (
        <div className="bento-grid">
          {/* Recovery Status Breakdown */}
          <div className="bento-card bento-col-6">
            <span className="kpi-title" style={{ display: 'block', marginBottom: '20px' }}>Recovery Status Breakdown</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '6px 0' }}>
              {Object.entries(metrics.status_breakdown).map(([status, count]) => {
                const pct = (count / metrics.total_count) * 100;
                let colorClass = 'var(--text-secondary)';
                if (status === 'success') colorClass = 'var(--accent-emerald)';
                if (status === 'failed') colorClass = 'var(--accent-rose)';
                if (status === 'escalated') colorClass = 'var(--accent-amber)';
                if (status === 'promised') colorClass = 'var(--accent-blue)';
                if (status === 'overdue') colorClass = 'var(--accent-amber)';
                
                const filterVal = status.toUpperCase();

                return (
                  <div 
                    key={status} 
                    onClick={() => onFilterStatus && onFilterStatus(filterVal)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title={`Click to filter table by status ${filterVal}`}
                  >
                    <span style={{ width: '130px', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {status.replace('_', ' ')}
                    </span>
                    <div style={{ flexGrow: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: colorClass, borderRadius: '3px', boxShadow: `0 0 6px ${colorClass}` }} />
                    </div>
                    <span style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: 'var(--text-sub)' }}>
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transactions by Payment Channel */}
          <div className="bento-card bento-col-6">
            <span className="kpi-title" style={{ display: 'block', marginBottom: '20px' }}>Transactions by Payment Channel</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '6px 0' }}>
              {Object.entries(metrics.type_breakdown).map(([type, count]) => {
                const pct = (count / metrics.total_count) * 100;
                const filterVal = type.toUpperCase();
                
                return (
                  <div 
                    key={type} 
                    onClick={() => onFilterType && onFilterType(filterVal)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title={`Click to filter table by channel ${filterVal}`}
                  >
                    <span style={{ width: '130px', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {type}
                    </span>
                    <div style={{ flexGrow: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--accent-purple)', borderRadius: '3px', boxShadow: '0 0 6px var(--accent-purple)' }} />
                    </div>
                    <span style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: 'var(--text-sub)' }}>
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
