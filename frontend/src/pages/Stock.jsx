import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime } from '../utils/format';

const TYPES = [
  { value: 'in', label: 'Stock In', icon: 'bi-box-arrow-in-down', color: 'success' },
  { value: 'out', label: 'Stock Out', icon: 'bi-box-arrow-up', color: 'primary' },
  { value: 'adjustment', label: 'Adjustment', icon: 'bi-sliders', color: 'info' },
  { value: 'damaged', label: 'Damaged', icon: 'bi-exclamation-octagon', color: 'danger' },
  { value: 'returned', label: 'Returned', icon: 'bi-arrow-return-left', color: 'warning' },
];

const typeMeta = (t) => TYPES.find((x) => x.value === t) || { color: 'secondary', label: t };

export default function Stock() {
  const { hasRole } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');

  const allowedTypes = TYPES.filter((t) => t.value !== 'adjustment' || hasRole('Admin', 'Manager'));

  useEffect(() => {
    api.get('/products/list').then((r) => setProducts(r.data.data)).catch(() => {});
  }, [refresh]);

  const openMove = (type) =>
    setForm({ product_id: '', type, quantity: 1, note: '' });

  const currentStock = products.find((p) => String(p.id) === String(form?.product_id))?.quantity ?? 0;

  const selectByCode = async (code) => {
    try {
      const { data } = await api.get('/products/lookup', { params: { code }, skipErrorToast: true });
      setForm((f) => ({ ...f, product_id: data.data.id }));
      toast.success(`Selected ${data.data.name}`, { autoClose: 1000 });
    } catch {
      toast.error(`No product found for "${code}"`);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.product_id) return toast.error('Select a product');
    setSaving(true);
    try {
      await api.post('/stock/move', form);
      toast.success('Stock movement recorded');
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const columns = [
    { key: 'created_at', label: 'Date', render: (r) => fmtDateTime(r.created_at) },
    { key: 'product_name', label: 'Product', render: (r) => <div><strong>{r.product_name}</strong><br /><small className="text-muted">{r.sku}</small></div> },
    { key: 'type', label: 'Type', render: (r) => <span className={`badge bg-${typeMeta(r.type).color}`}>{typeMeta(r.type).label}</span> },
    { key: 'quantity', label: 'Change', render: (r) => <strong className={r.quantity >= 0 ? 'text-success' : 'text-danger'}>{r.quantity >= 0 ? '+' : ''}{r.quantity}</strong> },
    { key: 'quantity_after', label: 'Balance', render: (r) => `${r.quantity_before} → ${r.quantity_after}` },
    { key: 'note', label: 'Note', render: (r) => r.note || '—' },
    { key: 'created_by_name', label: 'By', render: (r) => r.created_by_name || 'System' },
  ];

  const filters = (
    <select className="form-select w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
      <option value="">All movements</option>
      {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader title="Stock Movements" subtitle="Track every inventory change" icon="bi-arrow-left-right">
        <div className="dropdown">
          <button className="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown"><i className="bi bi-plus-lg me-1" />New Movement</button>
          <ul className="dropdown-menu dropdown-menu-end shadow">
            {allowedTypes.map((t) => (
              <li key={t.value}><button className="dropdown-item" onClick={() => openMove(t.value)}><i className={`bi ${t.icon} text-${t.color} me-2`} />{t.label}</button></li>
            ))}
          </ul>
        </div>
      </PageHeader>

      <DataTable endpoint="/stock" columns={columns} refreshKey={refresh} filters={filters} query={{ type: filterType }} />

      <Modal show={!!form} onClose={() => setForm(null)} title={form ? typeMeta(form.type).label : ''}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Record</button>
        </>}>
        {form && (
          <form onSubmit={save}>
            <div className="mb-3">
              <label className="form-label">Movement Type</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {allowedTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Scan barcode / SKU</label>
              <BarcodeScanner onScan={selectByCode} placeholder="Scan or type code + Enter to select product…" compact />
            </div>
            <div className="mb-3">
              <label className="form-label">Product *</label>
              <select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.quantity} in stock</option>)}
              </select>
              {form.product_id && <small className="text-muted">Current stock: <strong>{currentStock}</strong></small>}
            </div>
            <div className="mb-3">
              <label className="form-label">
                {form.type === 'adjustment' ? 'New Quantity (absolute) *' : 'Quantity *'}
              </label>
              <input type="number" min="0" className="form-control" value={form.quantity} required
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              {form.type === 'adjustment' && <small className="text-muted">Stock will be set to this exact value.</small>}
            </div>
            <div className="mb-1">
              <label className="form-label">Note</label>
              <input className="form-control" value={form.note} placeholder="Reason / reference"
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
