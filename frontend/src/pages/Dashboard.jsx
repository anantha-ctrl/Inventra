import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import api from '../api/client';
import Loader from '../components/Loader';
import PageHeader from '../components/PageHeader';
import { money, fmtDateTime } from '../utils/format';
import { useSettings } from '../context/SettingsContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const StatCard = ({ grad, icon, label, value, to }) => (
  <div className="col-md-6 col-xl-3">
    <Link to={to || '#'} className="text-decoration-none">
      <div className={`stat-card ${grad}`}>
        <span>{label}</span>
        <h3>{value}</h3>
        <i className={`bi ${icon} stat-icon`} />
      </div>
    </Link>
  </div>
);

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 Days' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState('month');
  const { settings } = useSettings();

  useEffect(() => {
    api.get('/dashboard/stats', { params: { range } }).then((r) => setData(r.data.data)).catch(() => {});
  }, [range]);

  if (!data) return <Loader text="Loading dashboard…" />;

  const monthLabels = data.monthly.map((m) => m.ym);
  const barData = {
    labels: monthLabels,
    datasets: [
      { label: 'Sales', data: data.monthly.map((m) => +m.sales), backgroundColor: '#6366f1', borderRadius: 6 },
      { label: 'Purchases', data: data.monthly.map((m) => +m.purchases), backgroundColor: '#0ea5e9', borderRadius: 6 },
    ],
  };
  const doughnutData = {
    labels: data.category_distribution.map((c) => c.name),
    datasets: [{
      data: data.category_distribution.map((c) => +c.count),
      backgroundColor: ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'],
      borderWidth: 0,
    }],
  };
  const lineData = {
    labels: data.sales_trend.map((s) => s.day?.slice(5)),
    datasets: [{
      label: 'Daily Sales', data: data.sales_trend.map((s) => +s.total),
      borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.12)', fill: true, tension: .35, pointRadius: 4,
    }],
  };
  const noLegend = { plugins: { legend: { display: false } }, maintainAspectRatio: false };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your inventory & operations" icon="bi-speedometer2">
        <div className="dash-range">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </PageHeader>

      {/* Period summary — reacts to the date-range toggle */}
      {data.range && (
        <div className="row g-3 mb-3">
          <div className="col-md-3 col-6">
            <div className="sh-card p-3 h-100">
              <small className="text-muted d-block mb-1">{data.range.label} · Sales</small>
              <h4 className="mb-0">{money(data.range.sales_total)}</h4>
              <small className="text-muted">{data.range.sales_count} invoice(s)</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="sh-card p-3 h-100">
              <small className="text-muted d-block mb-1">{data.range.label} · Purchases</small>
              <h4 className="mb-0">{money(data.range.purchase_total)}</h4>
              <small className="text-muted">{data.range.purchase_count} order(s)</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="sh-card p-3 h-100">
              <small className="text-muted d-block mb-1">Stock Value</small>
              <h4 className="mb-0">{money(data.stock_value)}</h4>
              <small className="text-muted">at cost price</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <Link to="/sales" className="text-decoration-none">
              <div className="sh-card p-3 h-100">
                <small className="text-muted d-block mb-1">Outstanding Dues</small>
                <h4 className="mb-0 text-danger">{money(data.total_dues)}</h4>
                <small className="text-muted">across unpaid invoices</small>
              </div>
            </Link>
          </div>
        </div>
      )}

      <div className="row g-3 mb-3">
        <StatCard grad="bg-grad-1" icon="bi-box-seam" label="Total Products" value={data.total_products} to="/products" />
        <StatCard grad="bg-grad-2" icon="bi-tags" label="Categories" value={data.total_categories} to="/categories" />
        <StatCard grad="bg-grad-3" icon="bi-truck" label="Suppliers" value={data.total_suppliers} to="/suppliers" />
        <StatCard grad="bg-grad-4" icon="bi-people" label="Customers" value={data.total_customers} to="/customers" />
      </div>
      <div className="row g-3 mb-4">
        <StatCard grad="bg-grad-2" icon="bi-cart-plus" label="Purchases" value={data.total_purchases} to="/purchases" />
        <StatCard grad="bg-grad-6" icon="bi-receipt" label="Sales" value={data.total_sales} to="/sales" />
        <StatCard grad="bg-grad-5" icon="bi-exclamation-triangle" label="Low Stock" value={data.low_stock_count} to="/products" />
        <StatCard grad="bg-grad-1" icon="bi-cash-stack" label="Revenue" value={money(data.revenue)} to="/sales" />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <div className="sh-card p-3 h-100">
            <h6 className="fw-semibold mb-3">Sales vs Purchases (last 6 months)</h6>
            <div style={{ height: 300 }}><Bar data={barData} options={{ maintainAspectRatio: false }} /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="sh-card p-3 h-100">
            <h6 className="fw-semibold mb-3">Products by Category</h6>
            <div style={{ height: 300 }}>
              {data.category_distribution.length
                ? <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                : <p className="text-muted text-center pt-5">No data</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="sh-card p-3 h-100">
            <h6 className="fw-semibold mb-3">Daily Sales Trend (7 days)</h6>
            <div style={{ height: 260 }}>
              {data.sales_trend.length
                ? <Line data={lineData} options={noLegend} />
                : <p className="text-muted text-center pt-5">No recent sales</p>}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="sh-card p-3 h-100">
            <h6 className="fw-semibold mb-3 text-danger"><i className="bi bi-exclamation-triangle me-1" />Low Stock Alerts</h6>
            {data.low_stock_products.length === 0 ? (
              <p className="text-muted">All products are sufficiently stocked.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {data.low_stock_products.slice(0, 6).map((p) => (
                  <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span><strong>{p.name}</strong><br /><small className="text-muted">{p.sku}</small></span>
                    <span className="badge bg-danger rounded-pill">{p.quantity} / {p.reorder_level}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          <div className="sh-card p-3">
            <h6 className="fw-semibold mb-3">Top Selling Products</h6>
            <table className="sh-table">
              <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.top_products.length === 0 && <tr><td colSpan={3} className="text-muted text-center">No sales yet</td></tr>}
                {data.top_products.map((p, i) => (
                  <tr key={i}><td>{p.name}</td><td>{p.sold}</td><td>{money(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="sh-card p-3">
            <h6 className="fw-semibold mb-3">Recent Activity</h6>
            <ul className="list-group list-group-flush">
              {data.recent_activities.map((a, i) => (
                <li key={i} className="list-group-item px-0 py-2">
                  <div className="d-flex justify-content-between">
                    <span><span className="badge bg-light text-dark me-2">{a.module}</span>{a.description}</span>
                  </div>
                  <small className="text-muted">{a.user_name || 'System'} · {fmtDateTime(a.created_at)}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
