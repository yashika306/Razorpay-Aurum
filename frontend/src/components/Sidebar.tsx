import React from 'react';
import { LayoutDashboard, Sliders } from 'lucide-react';

interface SidebarProps {
  currentTab: 'dashboard' | 'policies';
  setCurrentTab: (tab: 'dashboard' | 'policies') => void;
  setSandboxOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  setSandboxOpen
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">⚡ AURUM</span>
      </div>

      <div className="sidebar-menu">
        <button 
          className={`menu-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentTab('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Operations Console</span>
        </button>
        
        <button 
          className={`menu-item ${currentTab === 'policies' ? 'active' : ''}`}
          onClick={() => setCurrentTab('policies')}
        >
          <Sliders size={18} />
          <span>Rules Override</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <button 
          className="menu-item" 
          style={{ 
            width: '100%', 
            justifyContent: 'center', 
            marginBottom: '12px', 
            border: '1px solid rgba(255,255,255,0.06)', 
            backgroundColor: 'rgba(139, 92, 246, 0.05)',
            color: 'var(--text-main)'
          }}
          onClick={() => setSandboxOpen(true)}
        >
          <Sliders size={16} />
          <span>Developer Sandbox</span>
        </button>
        <div style={{ fontSize: '11px', color: 'var(--text-sub)', textAlign: 'center' }}>
          🔒 Safe & Compliant Ingestion Active
        </div>
      </div>
    </div>
  );
};
