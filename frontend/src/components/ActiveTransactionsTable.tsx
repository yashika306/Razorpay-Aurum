import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Copy, Check, Download, Play, Link } from 'lucide-react';
import type { Transaction } from '../types';

interface ActiveTransactionsTableProps {
  cases: Transaction[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  typeFilter: string;
  setTypeFilter: (val: string) => void;
  onSelectCase: (txn_id: string) => void;
  onRunPipeline?: (txn_id: string) => void;
}

export const ActiveTransactionsTable: React.FC<ActiveTransactionsTableProps> = ({
  cases,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  onSelectCase,
  onRunPipeline
}) => {
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting State
  const [sortField, setSortField] = useState<'txn_id' | 'customer_name' | 'timestamp' | 'type' | 'amount' | 'status'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Clipboard State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const filteredCases = cases.filter(c => {
    const matchSearch = c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.txn_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || c.status.toUpperCase() === statusFilter;
    const matchType = typeFilter === 'ALL' || c.type.toUpperCase() === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Sorting logic
  const sortedCases = [...filteredCases].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'timestamp') {
      aVal = new Date(a.timestamp).getTime();
      bVal = new Date(b.timestamp).getTime();
    }

    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    } else {
      return sortDirection === 'asc' 
        ? (aVal > bVal ? 1 : -1) 
        : (bVal > aVal ? 1 : -1);
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedCases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = sortedCases.slice(startIndex, startIndex + itemsPerPage);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportCSV = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Header columns
    const headers = ["Transaction ID", "Customer Name", "Phone", "Email", "Ingestion Date", "Channel", "Failure Code", "Amount (INR)", "Status"];
    
    // Map cases to rows
    const rows = filteredCases.map(c => [
      c.txn_id,
      c.customer_name,
      c.customer_phone,
      c.customer_email,
      c.timestamp,
      c.type,
      c.failure_code || "N/A",
      c.amount,
      c.status
    ]);
    
    // Join CSV content
    const csvContent = [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sageant_recovery_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderHeader = (label: string, field: typeof sortField) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{label}</span>
          <span style={{ 
            display: 'inline-flex', 
            opacity: isSorted ? 1 : 0.25, 
            color: isSorted ? 'var(--accent-purple)' : 'inherit' 
          }}>
            {isSorted && sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="bento-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="kpi-title" style={{ margin: 0 }}>Active Transactions Log</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', animation: 'pulse 1.2s infinite' }} />
            Live Sync
          </div>
        </div>
        
        {/* Export to CSV Button */}
        <button 
          className="btn btn-secondary" 
          onClick={handleExportCSV}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}
          title="Export transactions table data to CSV"
        >
          <Download size={14} />
          <span>Export to CSV</span>
        </button>
      </div>
      
      {/* Responsive Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search customer or transaction ID..." 
            className="form-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingRight: '36px' }}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          )}
        </div>
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="FAILED">Failed</option>
          <option value="SUCCESS">Success</option>
          <option value="ESCALATED">Escalated</option>
          <option value="PROMISED">Promised</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ABANDONED">Abandoned (Checkout)</option>
          <option value="OVERDUE">Overdue (Invoice)</option>
        </select>
        <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">All Channels</option>
          <option value="PAYMENT">Payment Decline</option>
          <option value="CHECKOUT">Checkout Abandon</option>
          <option value="SUBSCRIPTION">Subscription Failed</option>
          <option value="INVOICE">B2B Invoice Overdue</option>
        </select>
        {hasActiveFilters && (
          <button 
            className="btn btn-secondary" 
            onClick={handleResetFilters}
            style={{ padding: '10px', fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid Datatable */}
      <div className="table-container">
        <table className="sageant-table">
          <thead>
            <tr>
              {renderHeader('Transaction ID', 'txn_id')}
              {renderHeader('Customer Name', 'customer_name')}
              {renderHeader('Date Ingested', 'timestamp')}
              {renderHeader('Channel Type', 'type')}
              <th>Decline Reason</th>
              {renderHeader('Amount', 'amount')}
              {renderHeader('Recovery Status', 'status')}
              <th style={{ userSelect: 'none', width: '120px', textAlign: 'center' }}>Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCases.map((c) => {
              const dt = new Date(c.timestamp).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              
              const isCardIssue = ['card_expired', 'card_invalid', 'fraud_suspicion'].includes(c.failure_code || '');

              return (
                <tr key={c.txn_id} onClick={() => onSelectCase(c.txn_id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{c.txn_id}</code>
                      <button 
                        onClick={(e) => handleCopyId(e, c.txn_id)}
                        style={{ border: 'none', background: 'none', padding: '4px', color: 'var(--text-sub)', cursor: 'pointer', display: 'inline-flex', borderRadius: '4px' }}
                        title="Copy Transaction ID"
                      >
                        {copiedId === c.txn_id ? <Check size={12} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{c.customer_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{c.customer_phone}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px' }}>{dt}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {c.type}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      {c.failure_code}
                    </code>
                  </td>
                  <td>
                    <span style={{ fontWeight: 'bold' }}>₹{c.amount.toLocaleString('en-IN')}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      {/* Execute Pipeline Quick Action */}
                      {['failed', 'abandoned', 'overdue'].includes(c.status.toLowerCase()) && onRunPipeline ? (
                        <button 
                          className="btn" 
                          onClick={() => onRunPipeline(c.txn_id)}
                          style={{ padding: '6px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                          title="Run AI Recovery Agent"
                        >
                          <Play size={12} fill="var(--accent-purple)" />
                        </button>
                      ) : null}
                      
                      {/* Send Payment Link Action */}
                      {['failed', 'abandoned', 'overdue'].includes(c.status.toLowerCase()) && isCardIssue ? (
                        <button 
                          className="btn" 
                          onClick={() => alert("Secure billing update link dispatched to customer's contact points.")}
                          style={{ padding: '6px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                          title="Send Billing Update Link"
                        >
                          <Link size={12} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedCases.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '40px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)' }}>No matching entries found</div>
                  <div style={{ fontSize: '12px', marginBottom: '16px' }}>Try resetting your active search filters to view case history.</div>
                  {hasActiveFilters && (
                    <button className="btn" onClick={handleResetFilters} style={{ padding: '8px 16px', fontSize: '12px' }}>
                      Reset Filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {sortedCases.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '16px', 
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Entries select count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-sub)' }}>
            <span>Show</span>
            <select 
              className="form-control" 
              value={itemsPerPage} 
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ width: '70px', padding: '6px' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
            <span style={{ marginLeft: '12px' }}>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedCases.length)} of {sortedCases.length} entries
            </span>
          </div>

          {/* Page navigation buttons */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', fontSize: '13px', opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isCurrent = pageNum === currentPage;
                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={isCurrent ? 'btn' : 'btn btn-secondary'}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '13px',
                      minWidth: '32px'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button 
                className="btn btn-secondary" 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', fontSize: '13px', opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
