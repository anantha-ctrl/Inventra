import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { todayISO, money } from '../utils/format';

const REPORTS = [
  { key: 'product', label: 'Product Report', icon: 'bi-box-seam', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: false, desc: 'Complete product catalog' },
  { key: 'inventory', label: 'Inventory Report', icon: 'bi-clipboard-data', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: false, desc: 'Current stock levels' },
  { key: 'purchase', label: 'Purchase Report', icon: 'bi-cart-plus', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: true, desc: 'Purchase transactions' },
  { key: 'sales', label: 'Sales Report', icon: 'bi-receipt', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: true, desc: 'Revenue & sales data' },
  { key: 'supplier', label: 'Supplier Report', icon: 'bi-truck', color: '#8b5cf6', bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', dated: false, desc: 'Supplier directory' },
  { key: 'customer', label: 'Customer Report', icon: 'bi-people', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: false, desc: 'Customer analytics' },
  { key: 'profit', label: 'Profit Analysis', icon: 'bi-graph-up-arrow', color: '#ef4444', bg: 'linear-gradient(135deg,#ef4444,#f87171)', dated: true, desc: 'Per-product profit' },

  // ---- GST / Billing ----
  { key: 'gst', label: 'GST / Tax Report', icon: 'bi-percent', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: true, desc: 'Slab-wise CGST/SGST + B2B/B2C' },
  { key: 'hsn', label: 'HSN Summary', icon: 'bi-upc', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: true, desc: 'HSN/SAC-wise tax' },
  { key: 'payments', label: 'Payment Mode Report', icon: 'bi-credit-card-2-front', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: true, desc: 'Cash / UPI / Card collections' },
  { key: 'dues', label: 'Outstanding Dues', icon: 'bi-cash-stack', color: '#ef4444', bg: 'linear-gradient(135deg,#ef4444,#f87171)', dated: false, desc: 'Receivables + ageing' },

  // ---- Money / Profit ----
  { key: 'expense', label: 'Expense Report', icon: 'bi-wallet2', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: true, desc: 'Category-wise expenses' },
  { key: 'pnl', label: 'Profit & Loss', icon: 'bi-journal-text', color: '#8b5cf6', bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', dated: true, desc: 'Sales − COGS − expenses' },
  { key: 'sales_summary', label: 'Sales Summary', icon: 'bi-calendar3', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: true, desc: 'Date-wise totals & avg bill' },

  // ---- Inventory ----
  { key: 'stock_valuation', label: 'Stock Valuation', icon: 'bi-cash-coin', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: false, desc: 'Cost & sell value + margin' },
  { key: 'low_stock', label: 'Low Stock / Reorder', icon: 'bi-exclamation-triangle', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: false, desc: 'Items to reorder' },
  { key: 'dead_stock', label: 'Dead / Slow Stock', icon: 'bi-hourglass-split', color: '#64748b', bg: 'linear-gradient(135deg,#64748b,#94a3b8)', dated: true, desc: 'Unsold capital locked' },
  { key: 'stock_ledger', label: 'Stock Movement Ledger', icon: 'bi-arrow-left-right', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: true, desc: 'In/out/adjustments' },

  // ---- People ----
  { key: 'cashier', label: 'Cashier / Salesperson', icon: 'bi-person-badge', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: true, desc: 'Sales by staff' },
  { key: 'customer_ledger', label: 'Customer Ledger', icon: 'bi-journal-bookmark', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: false, desc: 'Billed / paid / balance' },
];

export default function Reports() {
  const { hasRole } = useAuth();
  const canExport = hasRole('Admin', 'Manager');
  const [active, setActive] = useState('product');
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const current = REPORTS.find((r) => r.key === active);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/reports/${active}`, { params: { from, to } })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [active, from, to]);

  useEffect(() => { load(); }, [load]);

  const download = async (format) => {
    setExporting(format);
    try {
      const res = await api.get(`/reports/${active}/export`, {
        params: { from, to, format },
        responseType: 'blob',
      });
      const isHtml = format === 'print';
      const blob = new Blob([res.data], { type: isHtml ? 'text/html' : res.data.type });
      const url = URL.createObjectURL(blob);
      if (isHtml) {
        const w = window.open(url, '_blank');
        if (w) setTimeout(() => w.print?.(), 600);
      } else {
        const a = document.createElement('a');
        const ext = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
        a.href = url;
        a.download = `${active}_report_${Date.now()}.${ext}`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      // interceptor surfaces the error
    } finally {
      setExporting('');
    }
  };

  const exportButtons = [
    { format: 'pdf', label: 'PDF', icon: 'bi-file-pdf', cls: 'rpt-export-pdf' },
    { format: 'excel', label: 'Excel', icon: 'bi-file-excel', cls: 'rpt-export-excel' },
    { format: 'csv', label: 'CSV', icon: 'bi-filetype-csv', cls: 'rpt-export-csv' },
    { format: 'print', label: 'Print', icon: 'bi-printer', cls: 'rpt-export-print' },
  ];

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Generate, export and print reports" icon="bi-bar-chart-line" />

      <div className="row g-4">
        {/* ---------- Left sidebar nav ---------- */}
        <div className="col-lg-3">
          <div className="rpt-nav-card">
            <div className="rpt-nav-header">
              <i className="bi bi-list-columns-reverse" />
              <span>Report Types</span>
            </div>
            <div className="rpt-nav-list">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  className={`rpt-nav-item ${active === r.key ? 'active' : ''}`}
                  onClick={() => setActive(r.key)}
                >
                  <div className="rpt-nav-icon" style={{ background: active === r.key ? r.bg : undefined }}>
                    <i className={`bi ${r.icon}`} />
                  </div>
                  <div className="rpt-nav-text">
                    <span className="rpt-nav-label">{r.label}</span>
                    <span className="rpt-nav-desc">{r.desc}</span>
                  </div>
                  {active === r.key && <i className="bi bi-chevron-right rpt-nav-arrow" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Right content ---------- */}
        <div className="col-lg-9">
          {/* Report title card */}
          <div className="rpt-title-strip" style={{ '--rpt-accent': current.color }}>
            <div className="rpt-title-icon" style={{ background: current.bg }}>
              <i className={`bi ${current.icon}`} />
            </div>
            <div className="rpt-title-text">
              <h5>{data?.title || current.label}</h5>
              <small>{current.desc}</small>
            </div>

            {/* Date filters if applicable */}
            {current?.dated && (
              <div className="rpt-date-group">
                <div className="rpt-date-field">
                  <i className="bi bi-calendar3" />
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <span className="rpt-date-sep">→</span>
                <div className="rpt-date-field">
                  <i className="bi bi-calendar3" />
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button className="rpt-apply-btn" onClick={load}>
                  <i className="bi bi-funnel-fill" /> Apply
                </button>
              </div>
            )}

            {/* Export buttons */}
            {canExport && (
              <div className="rpt-export-group">
                {exportButtons.map((b) => (
                  <button
                    key={b.format}
                    className={`rpt-export-btn ${b.cls}`}
                    onClick={() => download(b.format)}
                    disabled={!!exporting}
                    title={b.label}
                  >
                    {exporting === b.format ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className={`bi ${b.icon}`} />
                    )}
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary badges */}
          {data?.summary && (
            <div className="rpt-summary-row">
              {Object.entries(data.summary).map(([k, v]) => (
                <div key={k} className="rpt-summary-chip">
                  <span className="rpt-summary-label">{k}</span>
                  <span className="rpt-summary-value">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data table */}
          <div className="rpt-table-card">
            {loading ? <Loader /> : !data ? null : (
              <>
                <div className="table-responsive">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th className="rpt-th-idx">#</th>
                        {data.columns.map((c) => <th key={c}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.length === 0 && (
                        <tr>
                          <td colSpan={data.columns.length + 1} className="text-center text-muted py-5">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.3 }} />
                            No data available for this report
                          </td>
                        </tr>
                      )}
                      {data.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="rpt-td-idx">{i + 1}</td>
                          {row.map((cell, j) => <td key={j}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rpt-table-footer">
                  <div className="rpt-footer-stat">
                    <i className="bi bi-database" />
                    <span>{data.rows.length} record{data.rows.length !== 1 ? 's' : ''} found</span>
                  </div>
                  <div className="rpt-footer-meta">
                    <span><i className="bi bi-clock" /> Generated: {new Date().toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
