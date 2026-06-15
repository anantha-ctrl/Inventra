import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { statusBadge, fmtDate, money } from '../utils/format';

const empty = { name: '', email: '', phone: '', address: '', city: '', status: 'active' };

export default function Customers() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Manager', 'Staff');
  const canDelete = hasRole('Admin');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/customers/${form.id}`, form);
      else await api.post('/customers', form);
      toast.success(`Customer ${form.id ? 'updated' : 'created'}`);
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.delete(`/customers/${del.id}`); toast.success('Customer deleted'); setDel(null); setRefresh((r) => r + 1); }
    catch { setDel(null); }
  };

  const openView = async (r) => {
    const { data } = await api.get(`/customers/${r.id}`);
    setView(data.data);
  };

  const columns = [
    { key: 'name', label: 'Customer', render: (r) => <strong>{r.name}</strong> },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'city', label: 'City', render: (r) => r.city || '—' },
    { key: 'status', label: 'Status', render: (r) => <span className={`badge bg-${statusBadge(r.status)}`}>{r.status}</span> },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => openView(r)}><i className="bi bi-eye" /></button>
          {canEdit && <button className="btn btn-sm btn-outline-primary" onClick={() => setForm(r)}><i className="bi bi-pencil" /></button>}
          {canDelete && <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>}
        </div>
      ),
    },
  ];

  const field = (label, key, type = 'text') => (
    <div className="col-md-6 mb-3">
      <label className="form-label">{label}</label>
      <input type={type} className="form-control" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <>
      <PageHeader title="Customers" subtitle="Manage customers and purchase history" icon="bi-people">
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add Customer</button>}
      </PageHeader>

      <DataTable endpoint="/customers" columns={columns} refreshKey={refresh} />

      <Modal show={!!form} onClose={() => setForm(null)} size="modal-lg" title={form?.id ? 'Edit Customer' : 'Add Customer'}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}>
        {form && (
          <form onSubmit={save} className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Name *</label>
              <input className="form-control" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {field('Email', 'email', 'email')}
            {field('Phone', 'phone')}
            {field('City', 'city')}
            <div className="col-12 mb-3">
              <label className="form-label">Address</label>
              <input className="form-control" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </form>
        )}
      </Modal>

      <Modal show={!!view} onClose={() => setView(null)} size="modal-lg" title={view?.name}>
        {view && (
          <>
            <div className="row mb-3">
              <div className="col-md-6"><small className="text-muted">Email</small><div>{view.email || '—'}</div></div>
              <div className="col-md-6"><small className="text-muted">Phone</small><div>{view.phone || '—'}</div></div>
            </div>
            <h6 className="fw-semibold">Purchase History</h6>
            <table className="sh-table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Payment</th></tr></thead>
              <tbody>
                {view.sales_history?.length === 0 && <tr><td colSpan={4} className="text-muted text-center">No purchases</td></tr>}
                {view.sales_history?.map((s) => (
                  <tr key={s.id}><td>{s.invoice_no}</td><td>{fmtDate(s.sale_date)}</td><td>{money(s.total_amount)}</td>
                    <td><span className={`badge bg-${statusBadge(s.payment_status)}`}>{s.payment_status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete Customer" message={`Delete customer "${del?.name}"?`} />
    </>
  );
}
