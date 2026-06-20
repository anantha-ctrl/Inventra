import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { statusBadge, fmtDateTime } from '../utils/format';

const empty = { name: '', email: '', password: '', phone: '', role_id: 3, status: 'active', permissions: null };

// Modules an admin can grant/deny per user (POS first for billing-only staff).
const PERM_MODULES = [
  ['pos', 'POS Billing Terminal'],
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['stock', 'Stock Movements'],
  ['purchases', 'Purchases'],
  ['sales', 'Sales & Invoicing'],
  ['suppliers', 'Suppliers'],
  ['customers', 'Customers'],
  ['reports', 'Reports'],
  ['notifications', 'Notifications'],
];

export default function Users() {
  const [refresh, setRefresh] = useState(0);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  useEffect(() => {
    api.get('/users/roles').then((r) => setRoles(r.data.data)).catch(() => {});
  }, []);

  // Open edit → fetch the full user (the list endpoint omits permissions).
  const openEdit = async (r) => {
    try { const { data } = await api.get(`/users/${r.id}`); setForm({ ...data.data, password: '' }); }
    catch { setForm({ ...r, password: '' }); }
  };

  const selectedRoleName = roles.find((r) => String(r.id) === String(form?.role_id))?.name;
  const isCustom = form?.permissions != null;            // object → custom; null → inherit role
  const toggleCustom = (on) => setForm({ ...form, permissions: on ? (form.permissions || {}) : null });
  const togglePerm = (key, val) => setForm({ ...form, permissions: { ...(form.permissions || {}), [key]: val } });

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
          <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(r)}><i className="bi bi-pencil" /></button>
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
            <div className="mb-3">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Per-user module access (not shown for Admin — admins get everything) */}
            {selectedRoleName !== 'Admin' && (
              <div className="border rounded-3 p-3 bg-light">
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" id="customAccess" checked={isCustom}
                    onChange={(e) => toggleCustom(e.target.checked)} />
                  <label className="form-check-label fw-semibold" htmlFor="customAccess">
                    Custom access for this user
                  </label>
                </div>
                {isCustom ? (
                  <>
                    <p className="text-muted small mb-2">Tick exactly what this user can access (overrides the {selectedRoleName} role default). E.g. tick only <strong>POS Billing Terminal</strong> for a billing-only staff.</p>
                    <div className="row g-2">
                      {PERM_MODULES.map(([key, label]) => (
                        <div className="col-md-6" key={key}>
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id={`pm-${key}`}
                              checked={!!form.permissions?.[key]} onChange={(e) => togglePerm(key, e.target.checked)} />
                            <label className="form-check-label" htmlFor={`pm-${key}`}>{label}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <small className="text-muted d-block mt-2"><i className="bi bi-info-circle me-1" />Dashboard is always available. Granting POS auto-allows the product/customer/sales data it needs.</small>
                  </>
                ) : (
                  <p className="text-muted small mb-0">This user inherits the default <strong>{selectedRoleName}</strong> role permissions. Turn on to give this individual user a custom access set.</p>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete User" message={`Delete user "${del?.name}"?`} />
    </>
  );
}
