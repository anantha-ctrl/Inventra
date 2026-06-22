import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { todayISO } from '../utils/format';
import { REPORTS, GROUP_ORDER, GROUP_ICONS } from '../data/reports';

export default function Reports() {
  const { hasRole } = useAuth();
  const { type } = useParams();
  const navigate = useNavigate();
  const canExport = hasRole('Admin', 'Manager');

  // No (or invalid) :type → show the card dashboard; a valid :type → detail view.
  const valid = (t) => REPORTS.some((r) => r.key === t);
  const active = valid(type) ? type : null;

  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const current = REPORTS.find((r) => r.key === active);

  const load = useCallback(() => {
    if (!active) return;
    setLoading(true);
    api.get(`/reports/${active}`, { params: { from, to } })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [active, from, to]);

  useEffect(() => { setData(null); load(); }, [load]);

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

  // ============================================================= DASHBOARD VIEW
  if (!active) {
    return (
      <>
        <PageHeader title="Reports & Analytics" subtitle="Comprehensive analytics and financial reports for your business." icon="bi-bar-chart-line" />

        <div className="rpt-dash">
          {GROUP_ORDER.map((group) => {
            const items = REPORTS.filter((r) => r.group === group);
            if (items.length === 0) return null;
            return (
              <section className="rpt-dash-group" key={group}>
                <div className="rpt-dash-grouphead">
                  <i className={`bi ${GROUP_ICONS[group] || 'bi-collection'}`} />
                  <span>{group}</span>
                </div>
                <div className="rpt-dash-grid">
                  {items.map((r) => (
                    <button className="rpt-dash-card" key={r.key} onClick={() => navigate(`/reports/${r.key}`)}>
                      <span className="rpt-dash-ic" style={{ background: r.bg }}>
                        <i className={`bi ${r.icon}`} />
                      </span>
                      <span className="rpt-dash-text">
                        <span className="rpt-dash-title">{r.label}</span>
                        <span className="rpt-dash-desc">{r.desc}</span>
                      </span>
                      <i className="bi bi-arrow-right rpt-dash-arrow" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  // ================================================================ DETAIL VIEW
  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Generate, export and print reports" icon="bi-bar-chart-line" />

      <button className="rpt-back-btn" onClick={() => navigate('/reports')}>
        <i className="bi bi-arrow-left" /> All Reports
      </button>

      <div className="row g-4">
        {/* ---------- Content (full width) ---------- */}
        <div className="col-12">
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
