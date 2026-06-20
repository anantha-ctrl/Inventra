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

  // Bulk import/export state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const exportCsv = async () => {
    try {
      const res = await api.get('/customers/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `customers_export_${Date.now()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* handled */ }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'phone', 'address', 'city', 'status'];
    const rows = [
      ['Ravi Kumar', 'ravi@mail.test', '7700000001', '12 MG Road', 'Chennai', 'active'],
      ['Priya Sharma', 'priya@mail.test', '7700000002', '5 Park St', 'Pune', 'active'],
    ];
    const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'customers_import_template.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return toast.warning('Please select a CSV file to import');
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const { data } = await api.post('/customers/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(data.data);
      toast.success(data.message || 'Import completed');
      setRefresh((r) => r + 1);
      setImportFile(null);
      const fi = document.getElementById('custCsvInput');
      if (fi) fi.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import customers');
    } finally { setImporting(false); }
  };

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
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={exportCsv}><i className="bi bi-file-earmark-arrow-down me-1" />Export CSV</button>
          {canEdit && (
            <>
              <button className="btn btn-outline-primary" onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}>
                <i className="bi bi-file-earmark-arrow-up me-1" />Import CSV
              </button>
              <button className="btn btn-primary" onClick={() => setForm({ ...empty })}><i className="bi bi-plus-lg me-1" />Add Customer</button>
            </>
          )}
        </div>
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

      {/* CSV Bulk Import */}
      <Modal show={showImport} onClose={() => setShowImport(false)} title="Bulk Import Customers via CSV" size="modal-md"
        footer={<>
          <button className="btn btn-light" onClick={() => setShowImport(false)}>Close</button>
          <button className="btn btn-primary" onClick={handleImportSubmit} disabled={importing || !importFile}>
            {importing && <span className="spinner-border spinner-border-sm me-2" />}Upload & Import
          </button>
        </>}>
        <div className="p-1">
          <p className="text-muted small mb-4">Import many customers at once. Only the <strong>name</strong> column is required; email, phone, address, city and status are optional.</p>
          <div className="d-grid mb-4">
            <button type="button" className="btn btn-light text-primary border-primary py-2 fw-semibold" onClick={downloadTemplate}>
              <i className="bi bi-download me-2" />Download CSV Template
            </button>
          </div>
          <form onSubmit={handleImportSubmit}>
            <label className="form-label fw-bold">Select CSV File <span className="text-danger">*</span></label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-filetype-csv text-muted" /></span>
              <input type="file" id="custCsvInput" className="form-control" accept=".csv" required onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            </div>
          </form>
          {importResult && (
            <div className="alert alert-info border-0 shadow-sm mt-3 p-3">
              <h6 className="fw-bold mb-2"><i className="bi bi-info-circle-fill me-2" />Import Summary</h6>
              <ul className="mb-0 small ps-3">
                <li>Imported: <strong>{importResult.imported}</strong></li>
                <li>Skipped: <strong>{importResult.skipped}</strong></li>
              </ul>
              {importResult.errors?.length > 0 && (
                <div className="bg-light p-2 rounded small border text-danger overflow-auto mt-2" style={{ maxHeight: 120, fontFamily: 'monospace' }}>
                  {importResult.errors.map((er, i) => <div key={i}>{er}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
