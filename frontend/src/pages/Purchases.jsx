import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { statusBadge, fmtDate, money, todayISO } from '../utils/format';

export default function Purchases() {
  const { hasRole } = useAuth();
  const canApprove = hasRole('Admin', 'Manager');
  const [refresh, setRefresh] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    api.get('/suppliers/list').then((r) => setSuppliers(r.data.data)).catch(() => {});
    api.get('/products/list').then((r) => setProducts(r.data.data)).catch(() => {});
  }, []);

  const openCreate = () =>
    setForm({ supplier_id: '', purchase_date: todayISO(), notes: '', items: [{ product_id: '', quantity: 1, unit_cost: 0 }] });

  const setItem = (i, key, val) => {
    const items = [...form.items];
    items[i][key] = val;
    if (key === 'product_id') {
      const p = products.find((x) => String(x.id) === String(val));
      if (p) items[i].unit_cost = p.cost_price;
    }
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_cost: 0 }] });
  const delItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const total = form?.items.reduce((s, it) => s + (+it.quantity) * (+it.unit_cost), 0) || 0;

  const save = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) return toast.error('Select a supplier');
    if (form.items.some((it) => !it.product_id)) return toast.error('Select a product in each row');
    setSaving(true);
    try {
      await api.post('/purchases', form);
      toast.success('Purchase order created');
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const action = async (id, verb) => {
    try {
      await api.post(`/purchases/${id}/${verb}`);
      toast.success(`Purchase ${verb}d`);
      setView(null); setRefresh((r) => r + 1);
    } catch { /* handled */ }
  };

  const openView = async (r) => { const { data } = await api.get(`/purchases/${r.id}`); setView(data.data); };

  const columns = [
    { key: 'reference', label: 'Reference', render: (r) => <strong>{r.reference}</strong> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'purchase_date', label: 'Date', render: (r) => fmtDate(r.purchase_date) },
    { key: 'total_amount', label: 'Amount', render: (r) => money(r.total_amount) },
    { key: 'status', label: 'Status', render: (r) => <span className={`badge bg-${statusBadge(r.status)}`}>{r.status}</span> },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => <button className="btn btn-sm btn-outline-secondary" onClick={() => openView(r)}><i className="bi bi-eye" /> View</button>,
    },
  ];

  const filters = (
    <select className="form-select w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
      <option value="">All status</option>
      {['pending', 'approved', 'received', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader title="Purchases" subtitle="Purchase orders & approval workflow" icon="bi-cart-plus">
        <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-1" />New Purchase</button>
      </PageHeader>

      <DataTable endpoint="/purchases" columns={columns} refreshKey={refresh} filters={filters} query={{ status: filterStatus }} />

      {/* Create modal */}
      <Modal show={!!form} onClose={() => setForm(null)} size="modal-xl" title="New Purchase Order"
        footer={<>
          <div className="me-auto fw-semibold">Total: {money(total)}</div>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Create Order</button>
        </>}>
        {form && (
          <form onSubmit={save}>
            <div className="row mb-3">
              <div className="col-md-5">
                <label className="form-label">Supplier *</label>
                <select className="form-select" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <table className="sh-table">
              <thead><tr><th style={{ width: '45%' }}>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <select className="form-select form-select-sm" value={it.product_id} onChange={(e) => setItem(i, 'product_id', e.target.value)}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="1" className="form-control form-control-sm" style={{ width: 80 }} value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} /></td>
                    <td><input type="number" min="0" step="0.01" className="form-control form-control-sm" style={{ width: 110 }} value={it.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} /></td>
                    <td>{money((+it.quantity) * (+it.unit_cost))}</td>
                    <td>{form.items.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => delItem(i)}><i className="bi bi-x" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={addItem}><i className="bi bi-plus" /> Add item</button>
          </form>
        )}
      </Modal>

      {/* View modal */}
      <Modal show={!!view} onClose={() => setView(null)} size="modal-lg"
        title={view ? `${view.reference}` : ''}
        footer={view && (
          <>
            {canApprove && view.status === 'pending' && <button className="btn btn-success" onClick={() => action(view.id, 'approve')}><i className="bi bi-check2 me-1" />Approve</button>}
            {view.status === 'approved' && <button className="btn btn-primary" onClick={() => action(view.id, 'receive')}><i className="bi bi-box-arrow-in-down me-1" />Receive Stock</button>}
            {canApprove && view.status !== 'received' && view.status !== 'cancelled' && <button className="btn btn-outline-danger" onClick={() => action(view.id, 'cancel')}>Cancel Order</button>}
            <button className="btn btn-light" onClick={() => setView(null)}>Close</button>
          </>
        )}>
        {view && (
          <>
            <div className="row mb-3">
              <div className="col-md-4"><small className="text-muted">Supplier</small><div>{view.supplier_name}</div></div>
              <div className="col-md-4"><small className="text-muted">Date</small><div>{fmtDate(view.purchase_date)}</div></div>
              <div className="col-md-4"><small className="text-muted">Status</small><div><span className={`badge bg-${statusBadge(view.status)}`}>{view.status}</span></div></div>
              <div className="col-md-4 mt-2"><small className="text-muted">Created by</small><div>{view.created_by_name || '—'}</div></div>
              <div className="col-md-4 mt-2"><small className="text-muted">Approved by</small><div>{view.approved_by_name || '—'}</div></div>
            </div>
            <table className="sh-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th></tr></thead>
              <tbody>
                {view.items.map((it) => (
                  <tr key={it.id}><td>{it.product_name}<br /><small className="text-muted">{it.sku}</small></td>
                    <td>{it.quantity}</td><td>{money(it.unit_cost)}</td><td>{money(it.subtotal)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3} className="text-end fw-semibold">Total</td><td className="fw-semibold">{money(view.total_amount)}</td></tr></tfoot>
            </table>
            {view.notes && <p className="text-muted mt-2 mb-0"><i className="bi bi-sticky me-1" />{view.notes}</p>}
          </>
        )}
      </Modal>
    </>
  );
}
