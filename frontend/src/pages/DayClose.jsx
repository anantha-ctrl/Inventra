import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { money, todayISO, fmtDate } from '../utils/format';

const MODE_META = {
  cash: { label: 'Cash', icon: 'bi-cash-coin', color: '#16a34a' },
  upi: { label: 'UPI', icon: 'bi-qr-code', color: '#6366f1' },
  card: { label: 'Card', icon: 'bi-credit-card', color: '#0ea5e9' },
  other: { label: 'Other', icon: 'bi-three-dots', color: '#64748b' },
};

export default function DayClose() {
  const [date, setDate] = useState(todayISO());
  const [z, setZ] = useState(null);
  const [gst, setGst] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const month = date.slice(0, 7);
    Promise.all([
      api.get('/pos/z-report', { params: { date } }),
      api.get('/pos/gst-report', { params: { from: `${month}-01`, to: date } }),
    ]).then(([zr, gr]) => { setZ(zr.data.data); setGst(gr.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const printPage = () => window.print();

  return (
    <>
      <PageHeader title="Day Close / Z-Report" subtitle="Daily cash register summary & GST" icon="bi-journal-check">
        <div className="d-flex gap-2 align-items-center">
          <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-outline-secondary" onClick={printPage}><i className="bi bi-printer me-1" />Print</button>
        </div>
      </PageHeader>

      {loading || !z ? <Loader text="Loading day summary…" /> : (
        <div id="invoice-print">
          {/* Summary cards */}
          <div className="row g-3 mb-3">
            <div className="col-md-3 col-6"><div className="sh-card p-3"><small className="text-muted d-block">Invoices</small><h4 className="mb-0">{z.sales.invoices}</h4></div></div>
            <div className="col-md-3 col-6"><div className="sh-card p-3"><small className="text-muted d-block">Sales Total</small><h4 className="mb-0">{money(z.sales.total)}</h4></div></div>
            <div className="col-md-3 col-6"><div className="sh-card p-3"><small className="text-muted d-block">Expenses</small><h4 className="mb-0 text-danger">{money(z.expenses.total)}</h4></div></div>
            <div className="col-md-3 col-6"><div className="sh-card p-3"><small className="text-muted d-block">Net (Sales − Exp)</small><h4 className={`mb-0 ${z.net_profit_est >= 0 ? 'text-success' : 'text-danger'}`}>{money(z.net_profit_est)}</h4></div></div>
          </div>

          <div className="row g-3">
            {/* Payment modes */}
            <div className="col-lg-6">
              <div className="sh-card p-3 h-100">
                <h6 className="fw-semibold mb-3">Collections by Payment Mode</h6>
                {Object.entries(z.by_mode).map(([mode, v]) => {
                  const m = MODE_META[mode] || MODE_META.other;
                  return (
                    <div key={mode} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                      <span><i className={`bi ${m.icon} me-2`} style={{ color: m.color }} />{m.label} <small className="text-muted">({v.count})</small></span>
                      <strong>{money(v.amount)}</strong>
                    </div>
                  );
                })}
                <div className="d-flex justify-content-between align-items-center pt-3">
                  <span className="fw-semibold"><i className="bi bi-cash-stack me-2 text-success" />Expected Cash in Drawer</span>
                  <strong className="fs-5">{money(z.expected_cash)}</strong>
                </div>
                <small className="text-muted">= cash sales − cash expenses</small>
              </div>
            </div>

            {/* GST summary */}
            <div className="col-lg-6">
              <div className="sh-card p-3 h-100">
                <h6 className="fw-semibold mb-1">GST Summary <small className="text-muted">({gst && fmtDate(gst.from)} → {gst && fmtDate(gst.to)})</small></h6>
                <table className="sh-table">
                  <thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
                  <tbody>
                    {gst?.slabs?.length ? gst.slabs.map((s, i) => (
                      <tr key={i}>
                        <td>{s.tax_rate}%</td><td>{money(s.taxable)}</td><td>{money(s.cgst)}</td><td>{money(s.sgst)}</td><td>{money(s.total_tax)}</td>
                      </tr>
                    )) : <tr><td colSpan={5} className="text-muted text-center">No data</td></tr>}
                  </tbody>
                </table>
                {gst && (
                  <div className="d-flex justify-content-between fw-bold mt-2 pt-2 border-top">
                    <span>Total Tax Collected</span>
                    <span>{money(gst.totals.total_tax)} <small className="text-muted">(CGST {money(gst.totals.cgst)} + SGST {money(gst.totals.sgst)})</small></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top products */}
          <div className="sh-card p-3 mt-3">
            <h6 className="fw-semibold mb-3">Top Products — {fmtDate(z.date)}</h6>
            <table className="sh-table">
              <thead><tr><th>Product</th><th>Qty Sold</th><th>Amount</th></tr></thead>
              <tbody>
                {z.top_products.length === 0 && <tr><td colSpan={3} className="text-muted text-center">No sales</td></tr>}
                {z.top_products.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.qty}</td><td>{money(p.amount)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
