import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { statusBadge, fmtDate, money } from '../utils/format';

const empty = { name: '', company: '', email: '', phone: '', address: '', city: '', country: '', status: 'active' };

export default function Suppliers() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Manager');
  const canDelete = hasRole('Admin', 'Manager');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/suppliers/${form.id}`, form);
      else await api.post('/suppliers', form);
      toast.success(`Supplier ${form.id ? 'updated' : 'created'}`);
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.delete(`/suppliers/${del.id}`); toast.success('Supplier deleted'); setDel(null); setRefresh((r) => r + 1); }
    catch { setDel(null); }
  };

  const openView = async (r) => {
    const { data } = await api.get(`/suppliers/${r.id}`);
    setView(data.data);
  };

  const columns = [
    { key: 'name', label: 'Supplier', render: (r) => <div><strong>{r.name}</strong><br /><small className="text-muted">{r.company || '—'}</small></div> },
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
      <input type={type} className="form-control" value={form[key] || ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Manage your suppliers and history" icon="bi-truck">
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add Supplier</button>}
      </PageHeader>

      <DataTable endpoint="/suppliers" columns={columns} refreshKey={refresh} />

      <Modal show={!!form} onClose={() => setForm(null)} size="modal-lg" title={form?.id ? 'Edit Supplier' : 'Add Supplier'}
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
            {field('Company', 'company')}
            {field('Email', 'email', 'email')}
            {field('Phone', 'phone')}
            {field('City', 'city')}
            {field('Country', 'country')}
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
              <div className="col-md-6"><small className="text-muted">Company</small><div>{view.company || '—'}</div></div>
              <div className="col-md-6"><small className="text-muted">Email</small><div>{view.email || '—'}</div></div>
              <div className="col-md-6"><small className="text-muted">Phone</small><div>{view.phone || '—'}</div></div>
              <div className="col-md-6"><small className="text-muted">City / Country</small><div>{[view.city, view.country].filter(Boolean).join(', ') || '—'}</div></div>
            </div>
            <h6 className="fw-semibold">Purchase History</h6>
            <table className="sh-table">
              <thead><tr><th>Reference</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {view.purchase_history?.length === 0 && <tr><td colSpan={4} className="text-muted text-center">No purchases</td></tr>}
                {view.purchase_history?.map((p) => (
                  <tr key={p.id}><td>{p.reference}</td><td>{fmtDate(p.purchase_date)}</td><td>{money(p.total_amount)}</td>
                    <td><span className={`badge bg-${statusBadge(p.status)}`}>{p.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete Supplier" message={`Delete supplier "${del?.name}"?`} />
    </>
  );
}
