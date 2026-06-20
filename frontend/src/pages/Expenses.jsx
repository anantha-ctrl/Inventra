import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { money, fmtDate, todayISO } from '../utils/format';

const CATEGORIES = ['Rent', 'Salary', 'Electricity', 'Water', 'Internet', 'Transport', 'Supplies', 'Maintenance', 'Marketing', 'Misc'];
const MODES = ['cash', 'upi', 'card', 'other'];
const empty = { category: 'Rent', amount: '', expense_date: todayISO(), payment_mode: 'cash', note: '' };

export default function Expenses() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Manager');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/expenses/${form.id}`, form);
      else await api.post('/expenses', form);
      toast.success(`Expense ${form.id ? 'updated' : 'recorded'}`);
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.delete(`/expenses/${del.id}`); toast.success('Expense deleted'); setDel(null); setRefresh((r) => r + 1); }
    catch { setDel(null); }
  };

  const columns = [
    { key: 'expense_date', label: 'Date', render: (r) => fmtDate(r.expense_date) },
    { key: 'category', label: 'Category', render: (r) => <span className="badge bg-light text-dark">{r.category}</span> },
    { key: 'amount', label: 'Amount', render: (r) => <strong className="text-danger">{money(r.amount)}</strong> },
    { key: 'payment_mode', label: 'Mode', render: (r) => <span className="text-capitalize">{r.payment_mode}</span> },
    { key: 'note', label: 'Note', render: (r) => r.note || '—' },
    { key: 'created_by_name', label: 'By', render: (r) => r.created_by_name || 'System' },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => canEdit && (
        <div className="d-flex gap-1 justify-content-end">
          <button className="btn btn-sm btn-outline-primary" onClick={() => setForm({ ...r })}><i className="bi bi-pencil" /></button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>
        </div>
      ),
    },
  ];

  const filters = (
    <div className="d-flex gap-2 align-items-center">
      <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
      <span className="text-muted">to</span>
      <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} />
    </div>
  );

  return (
    <>
      <PageHeader title="Expenses" subtitle="Track shop running costs for true profit" icon="bi-wallet2">
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add Expense</button>}
      </PageHeader>

      <DataTable endpoint="/expenses" columns={columns} refreshKey={refresh} filters={filters} query={{ from, to }} />

      <Modal show={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit Expense' : 'Add Expense'}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}>
        {form && (
          <form onSubmit={save} className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Category *</label>
              <input className="form-control" list="exp-cats" value={form.category} required onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="exp-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Amount *</label>
              <input type="number" min="0" step="0.01" className="form-control" value={form.amount} required onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" value={form.expense_date} required onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Payment Mode</label>
              <select className="form-select text-capitalize" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Note</label>
              <input className="form-control" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete Expense" message={`Delete ${del?.category} expense of ${money(del?.amount || 0)}?`} />
    </>
  );
}
