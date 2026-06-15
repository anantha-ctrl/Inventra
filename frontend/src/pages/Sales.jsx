import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { statusBadge, fmtDate, money, todayISO } from '../utils/format';

export default function Sales() {
  const { hasRole } = useAuth();
  const canDelete = hasRole('Admin');
  const [refresh, setRefresh] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers/list').then((r) => setCustomers(r.data.data)).catch(() => {});
    api.get('/products/list').then((r) => setProducts(r.data.data)).catch(() => {});
  }, []);

  const openCreate = () =>
    setForm({ customer_id: '', sale_date: todayISO(), discount: 0, tax: 0, payment_status: 'paid', notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }] });

  const setItem = (i, key, val) => {
    const items = [...form.items];
    items[i][key] = val;
    if (key === 'product_id') {
      const p = products.find((x) => String(x.id) === String(val));
      if (p) items[i].unit_price = p.selling_price;
    }
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_price: 0 }] });
  const delItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal = form?.items.reduce((s, it) => s + (+it.quantity) * (+it.unit_price), 0) || 0;
  const grand = subtotal - (+form?.discount || 0) + (+form?.tax || 0);

  const stockOf = (id) => products.find((p) => String(p.id) === String(id))?.quantity ?? 0;

  const save = async (e) => {
    e.preventDefault();
    if (form.items.some((it) => !it.product_id)) return toast.error('Select a product in each row');
    for (const it of form.items) {
      if (+it.quantity > stockOf(it.product_id)) {
        const p = products.find((x) => String(x.id) === String(it.product_id));
        return toast.error(`Insufficient stock for ${p?.name} (have ${stockOf(it.product_id)})`);
      }
    }
    setSaving(true);
    try {
      const { data } = await api.post('/sales', form);
      toast.success(`Invoice ${data.data.invoice_no} created`);
      setForm(null); setRefresh((r) => r + 1);
      api.get('/products/list').then((r) => setProducts(r.data.data));
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.delete(`/sales/${del.id}`); toast.success('Sale reversed & stock restored'); setDel(null); setRefresh((r) => r + 1); }
    catch { setDel(null); }
  };

  const openView = async (r) => { const { data } = await api.get(`/sales/${r.id}`); setView(data.data); };
  const printInvoice = () => window.print();

  const columns = [
    { key: 'invoice_no', label: 'Invoice', render: (r) => <strong>{r.invoice_no}</strong> },
    { key: 'customer_name', label: 'Customer', render: (r) => r.customer_name || 'Walk-in' },
    { key: 'sale_date', label: 'Date', render: (r) => fmtDate(r.sale_date) },
    { key: 'total_amount', label: 'Total', render: (r) => money(r.total_amount) },
    { key: 'payment_status', label: 'Payment', render: (r) => <span className={`badge bg-${statusBadge(r.payment_status)}`}>{r.payment_status}</span> },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => openView(r)}><i className="bi bi-eye" /></button>
          {canDelete && <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Sales" subtitle="Record sales & generate invoices" icon="bi-receipt">
        <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-1" />New Sale</button>
      </PageHeader>

      <DataTable endpoint="/sales" columns={columns} refreshKey={refresh} />

      {/* Create */}
      <Modal show={!!form} onClose={() => setForm(null)} size="modal-xl" title="New Sale"
        footer={<>
          <div className="me-auto fw-semibold">Total: {money(grand)}</div>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Save Sale</button>
        </>}>
        {form && (
          <form onSubmit={save}>
            <div className="row mb-3">
              <div className="col-md-4">
                <label className="form-label">Customer</label>
                <select className="form-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Walk-in</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Payment</label>
                <select className="form-select" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  <option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>
            <table className="sh-table">
              <thead><tr><th style={{ width: '40%' }}>Product</th><th>Stock</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <select className="form-select form-select-sm" value={it.product_id} onChange={(e) => setItem(i, 'product_id', e.target.value)}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                    </td>
                    <td>{it.product_id ? <span className="badge bg-light text-dark">{stockOf(it.product_id)}</span> : '—'}</td>
                    <td><input type="number" min="1" className="form-control form-control-sm" style={{ width: 75 }} value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} /></td>
                    <td><input type="number" min="0" step="0.01" className="form-control form-control-sm" style={{ width: 105 }} value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} /></td>
                    <td>{money((+it.quantity) * (+it.unit_price))}</td>
                    <td>{form.items.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => delItem(i)}><i className="bi bi-x" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={addItem}><i className="bi bi-plus" /> Add item</button>
            <div className="row justify-content-end mt-3">
              <div className="col-md-5">
                <div className="d-flex justify-content-between mb-1"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>Discount</span>
                  <input type="number" min="0" step="0.01" className="form-control form-control-sm w-auto" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                </div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>Tax</span>
                  <input type="number" min="0" step="0.01" className="form-control form-control-sm w-auto" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
                </div>
                <hr className="my-1" />
                <div className="d-flex justify-content-between fw-bold fs-5"><span>Total</span><span>{money(grand)}</span></div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Invoice view */}
      <Modal show={!!view} onClose={() => setView(null)} size="modal-lg"
        title={view ? `Invoice ${view.invoice_no}` : ''}
        footer={view && <>
          <button className="btn btn-outline-secondary" onClick={printInvoice}><i className="bi bi-printer me-1" />Print</button>
          <button className="btn btn-light" onClick={() => setView(null)}>Close</button>
        </>}>
        {view && (
          <div id="invoice-print">
            <div className="d-flex justify-content-between mb-3">
              <div><h4 className="text-primary mb-0">StockHive</h4><small className="text-muted">Tax Invoice</small></div>
              <div className="text-end">
                <div><strong>{view.invoice_no}</strong></div>
                <small className="text-muted">{fmtDate(view.sale_date)}</small>
              </div>
            </div>
            <div className="row mb-3">
              <div className="col-6"><small className="text-muted">Billed To</small>
                <div className="fw-semibold">{view.customer_name || 'Walk-in Customer'}</div>
                <small>{view.customer_phone || ''} {view.customer_email || ''}</small>
              </div>
              <div className="col-6 text-end"><small className="text-muted">Payment</small>
                <div><span className={`badge bg-${statusBadge(view.payment_status)}`}>{view.payment_status}</span></div>
              </div>
            </div>
            <table className="sh-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
              <tbody>
                {view.items.map((it) => (
                  <tr key={it.id}><td>{it.product_name}</td><td>{it.quantity}</td><td>{money(it.unit_price)}</td><td>{money(it.subtotal)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="row justify-content-end mt-2">
              <div className="col-md-5">
                <div className="d-flex justify-content-between"><span>Subtotal</span><span>{money(view.subtotal)}</span></div>
                <div className="d-flex justify-content-between"><span>Discount</span><span>- {money(view.discount)}</span></div>
                <div className="d-flex justify-content-between"><span>Tax</span><span>+ {money(view.tax)}</span></div>
                <hr className="my-1" />
                <div className="d-flex justify-content-between fw-bold fs-5"><span>Total</span><span>{money(view.total_amount)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Reverse Sale" confirmText="Reverse" message={`Reverse ${del?.invoice_no}? Stock will be restored.`} />
    </>
  );
}
