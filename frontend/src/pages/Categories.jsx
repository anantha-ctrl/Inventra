import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { statusBadge, fmtDate } from '../utils/format';

const empty = { name: '', description: '', status: 'active' };

export default function Categories() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Manager');
  const canDelete = hasRole('Admin', 'Manager');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/categories/${form.id}`, form);
      else await api.post('/categories', form);
      toast.success(`Category ${form.id ? 'updated' : 'created'}`);
      setForm(null);
      setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try {
      await api.delete(`/categories/${del.id}`);
      toast.success('Category deleted');
      setDel(null);
      setRefresh((r) => r + 1);
    } catch { setDel(null); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <strong>{r.name}</strong> },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
    { key: 'status', label: 'Status', render: (r) => <span className={`badge bg-${statusBadge(r.status)}`}>{r.status}</span> },
    { key: 'created_at', label: 'Created', render: (r) => fmtDate(r.created_at) },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          {canEdit && <button className="btn btn-sm btn-outline-primary" onClick={() => setForm(r)}><i className="bi bi-pencil" /></button>}
          {canDelete && <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Categories" subtitle="Organise products into categories" icon="bi-tags">
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add Category</button>}
      </PageHeader>

      <DataTable endpoint="/categories" columns={columns} refreshKey={refresh} />

      <Modal show={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit Category' : 'Add Category'}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-2" />}Save
          </button>
        </>}>
        {form && (
          <form onSubmit={save}>
            <div className="mb-3">
              <label className="form-label">Name *</label>
              <input className="form-control" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="mb-1">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete Category" message={`Delete category "${del?.name}"? This cannot be undone.`} />
    </>
  );
}
