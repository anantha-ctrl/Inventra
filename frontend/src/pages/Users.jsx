import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { statusBadge, fmtDateTime } from '../utils/format';

const empty = { name: '', email: '', password: '', phone: '', role_id: 3, status: 'active' };

export default function Users() {
  const [refresh, setRefresh] = useState(0);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  useEffect(() => {
    api.get('/users/roles').then((r) => setRoles(r.data.data)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/users/${form.id}`, form);
      else await api.post('/users', form);
      toast.success(`User ${form.id ? 'updated' : 'created'}`);
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.delete(`/users/${del.id}`); toast.success('User deleted'); setDel(null); setRefresh((r) => r + 1); }
    catch { setDel(null); }
  };

  const roleBadge = (role) => ({ Admin: 'danger', Manager: 'primary', Staff: 'secondary' }[role] || 'secondary');

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <div><strong>{r.name}</strong><br /><small className="text-muted">{r.email}</small></div> },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'role', label: 'Role', render: (r) => <span className={`badge bg-${roleBadge(r.role)}`}>{r.role}</span> },
    { key: 'status', label: 'Status', render: (r) => <span className={`badge bg-${statusBadge(r.status)}`}>{r.status}</span> },
    { key: 'last_login', label: 'Last Login', render: (r) => fmtDateTime(r.last_login) },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <button className="btn btn-sm btn-outline-primary" onClick={() => setForm({ ...r, password: '' })}><i className="bi bi-pencil" /></button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Manage system users & roles" icon="bi-person-gear">
        <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add User</button>
      </PageHeader>

      <DataTable endpoint="/users" columns={columns} refreshKey={refresh} />

      <Modal show={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit User' : 'Add User'}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}>
        {form && (
          <form onSubmit={save}>
            <div className="mb-3">
              <label className="form-label">Name *</label>
              <input className="form-control" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" value={form.email} required onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Password {form.id ? '(leave blank to keep)' : '*'}</label>
              <input type="password" className="form-control" value={form.password} required={!form.id} minLength={6}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-1">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete User" message={`Delete user "${del?.name}"?`} />
    </>
  );
}
