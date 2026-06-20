import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api, { API_ORIGIN } from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Modal, { ConfirmModal } from '../components/Modal';
import BarcodeLabels from '../components/BarcodeLabels';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { money } from '../utils/format';

const empty = {
  name: '', category_id: '', supplier_id: '', sku: '', barcode: '', hsn_code: '', description: '',
  unit: 'pcs', cost_price: 0, selling_price: 0, tax_rate: 0, tax_inclusive: 0,
  quantity: 0, reorder_level: 10, status: 'active',
};

export default function Products() {
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  const canEdit = hasRole('Admin', 'Manager');
  const canDelete = hasRole('Admin', 'Manager');
  const [labelProduct, setLabelProduct] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [blocked, setBlocked] = useState(null);   // product that can't be deleted (has history)
  const [inactivating, setInactivating] = useState(false);
  const [cats, setCats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDelConfirm, setShowBulkDelConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Bulk import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    api.get('/categories/list').then((r) => setCats(r.data.data)).catch(() => { });
    api.get('/suppliers/list').then((r) => setSuppliers(r.data.data)).catch(() => { });
  }, []);

  const openCreate = async () => {
    setImageFile(null);
    const base = { ...empty };
    setForm(base);
  };

  const downloadTemplate = () => {
    const headers = ['name', 'category', 'supplier', 'sku', 'barcode', 'hsn_code', 'unit', 'cost_price', 'selling_price', 'tax_rate', 'tax_inclusive', 'quantity', 'reorder_level', 'description'];
    const rows = [
      ['Example Wireless Mouse', 'Electronics', 'John Traders', 'ELE-0099', '8901000000999', '8471', 'pcs', '250.00', '450.00', '18', '0', '50', '10', 'High precision wireless mouse'],
      ['Premium Basmati Rice 5kg', 'Groceries', 'Acme Supplies', '', '', '1006', 'bag', '500.00', '680.00', '5', '1', '20', '5', 'Long grain basmati rice']
    ];
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return toast.warning('Please select a CSV file to import');

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const { data } = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(data.data);
      toast.success(data.message || 'Import completed successfully!');
      setRefresh(r => r + 1);
      setImportFile(null);
      const fileInput = document.getElementById('csvFileInput');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import products');
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get('/products/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `products_export_${Date.now()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* handled */ }
  };

  // Scan a physical barcode/QR while adding a product.
  // If it already exists in the DB → load that product for editing (real-time
  // lookup); otherwise capture the scanned code into the Barcode field.
  const scanIntoForm = async (code) => {
    const value = String(code).trim();
    if (!value) return;
    try {
      const { data } = await api.get('/products/lookup', { params: { code: value }, skipErrorToast: true });
      const p = data.data;
      setImageFile(null);
      setForm({ ...empty, ...p });   // p has an id → save() will UPDATE it
      toast.info(`"${p.name}" already exists — loaded for editing`);
    } catch {
      setForm((f) => ({ ...(f || empty), barcode: value }));
      toast.success(`Barcode captured: ${value}`);
    }
  };

  const genCodes = async () => {
    const cat = cats.find((c) => String(c.id) === String(form.category_id));
    const { data } = await api.get('/products/generate-codes', { params: { prefix: cat?.name || 'PRD' } });
    setForm((f) => ({ ...f, sku: data.data.sku, barcode: data.data.barcode }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      if (imageFile) fd.append('image', imageFile);
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (form.id) await api.post(`/products/${form.id}?_method=PUT`, fd, cfg);
      else await api.post('/products', fd, cfg);
      toast.success(`Product ${form.id ? 'updated' : 'created'}`);
      setForm(null); setRefresh((r) => r + 1);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const remove = async () => {
    const target = del;
    try {
      await api.delete(`/products/${target.id}`, { skipErrorToast: true });
      toast.success('Product deleted');
      setDel(null); setRefresh((r) => r + 1);
    } catch (err) {
      setDel(null);
      if (err.response?.status === 409) {
        // Has purchase/sales history — offer to deactivate instead of failing.
        setBlocked(target);
      } else {
        toast.error(err.response?.data?.message || 'Failed to delete product');
      }
    }
  };

  const setInactive = async () => {
    setInactivating(true);
    try {
      await api.put(`/products/${blocked.id}`, { ...blocked, status: 'inactive' });
      toast.success(`"${blocked.name}" set to inactive`);
      setBlocked(null); setRefresh((r) => r + 1);
    } catch { /* handled by interceptor */ } finally { setInactivating(false); }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const { data } = await api.delete('/products/bulk-delete', { data: { ids: selectedIds } });
      const { deleted_count, skipped_count, skipped_names } = data.data;

      if (deleted_count > 0 && skipped_count === 0) {
        toast.success(`Successfully deleted ${deleted_count} product(s)`);
      } else if (deleted_count === 0 && skipped_count > 0) {
        toast.error(`No products deleted. Selected products have purchase/sales history.`);
      } else if (deleted_count > 0 && skipped_count > 0) {
        toast.info(`Deleted ${deleted_count} product(s). Skipped ${skipped_count} product(s) with history.`);
      }

      if (skipped_names && skipped_names.length > 0) {
        console.log('Skipped products:', skipped_names);
      }

      setSelectedIds([]);
      setShowBulkDelConfirm(false);
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to bulk delete products');
    } finally {
      setBulkDeleting(false);
    }
  };

  const stockState = (r) => {
    if (r.quantity <= 0) return { tone: 'danger', dot: '#dc2626', label: 'Out of stock' };
    if (r.quantity <= r.reorder_level) return { tone: 'warning', dot: '#f59e0b', label: 'Low' };
    return { tone: 'success', dot: '#16a34a', label: 'In stock' };
  };

  const columns = [
    {
      key: 'name', label: 'Product',
      render: (r) => (
        <div className="prod-cell">
          {r.image
            ? <img src={`${API_ORIGIN}/uploads/${r.image}`} className="prod-thumb" alt="" />
            : <div className="prod-thumb prod-thumb--ph"><i className="bi bi-box-seam" /></div>}
          <div className="prod-meta">
            <span className="prod-name">{r.name}</span>
            <span className="prod-sku"><i className="bi bi-upc" /> {r.sku}</span>
          </div>
        </div>
      ),
    },
    { key: 'category_name', label: 'Category', render: (r) => <span className="prod-chip">{r.category_name}</span> },
    { key: 'selling_price', label: 'Price', render: (r) => <span className="prod-price">{money(r.selling_price)}</span> },
    {
      key: 'quantity', label: 'Stock',
      render: (r) => {
        const s = stockState(r);
        return (
          <span className={`prod-stock prod-stock--${s.tone}`} title={s.label}>
            <span className="prod-stock-dot" style={{ background: s.dot }} />
            <b>{r.quantity}</b> <small>{r.unit}</small>
          </span>
        );
      },
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className={`prod-status prod-status--${r.status}`}>
          <i className={`bi ${r.status === 'active' ? 'bi-check-circle-fill' : 'bi-pause-circle-fill'}`} /> {r.status}
        </span>
      ),
    },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <button className="btn btn-sm btn-outline-secondary" title="Print barcode labels" onClick={() => setLabelProduct(r)}><i className="bi bi-upc" /></button>
          {canEdit && <button className="btn btn-sm btn-outline-primary" onClick={() => { setImageFile(null); setForm({ ...r }); }}><i className="bi bi-pencil" /></button>}
          {canDelete && <button className="btn btn-sm btn-outline-danger" onClick={() => setDel(r)}><i className="bi bi-trash" /></button>}
        </div>
      ),
    },
  ];

  const filters = (
    <>
      <div className="input-group input-group-sm w-auto shadow-sm">
        <span className="input-group-text bg-white border-0 text-muted" style={{ borderRadius: '8px 0 0 8px' }}><i className="bi bi-tag" /></span>
        <select className="form-select border-0 bg-white ps-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ minWidth: '150px', borderRadius: '0 8px 8px 0' }}>
          <option value="">All Categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="input-group input-group-sm w-auto shadow-sm">
        <span className="input-group-text bg-white border-0 text-muted" style={{ borderRadius: '8px 0 0 8px' }}><i className="bi bi-activity" /></span>
        <select className="form-select border-0 bg-white ps-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: '130px', borderRadius: '0 8px 8px 0' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="form-check form-switch d-inline-flex align-items-center gap-2 ms-4 px-3 py-2 bg-white rounded-3 shadow-sm">
        <input className="form-check-input cursor-pointer" type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} id="lowsw" />
        <label className="form-check-label small fw-semibold text-muted cursor-pointer" htmlFor="lowsw">Low Stock</label>
      </div>
    </>
  );

  const num = (label, key, step = '1') => (
    <div className="col-md-4 mb-3">
      <label className="form-label">{label}</label>
      <input type="number" step={step} min="0" className="form-control" value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <>
      <PageHeader title="Products" subtitle="Manage inventory products" icon="bi-box-seam">
        <div className="d-flex flex-wrap gap-2 ph-actions">
          {canDelete && selectedIds.length > 0 && (
            <button className="btn btn-danger" onClick={() => setShowBulkDelConfirm(true)} style={{ borderRadius: '10px' }}>
              <i className="bi bi-trash me-1" /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-outline-secondary" onClick={exportCsv} style={{ borderRadius: '10px' }}>
            <i className="bi bi-file-earmark-arrow-down me-1" /> Export CSV
          </button>
          {canEdit && (
            <>
              <button className="btn btn-outline-primary" onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }} style={{ borderRadius: '10px' }}>
                <i className="bi bi-file-earmark-arrow-up me-1" /> Import CSV
              </button>
              <button className="btn btn-primary" onClick={openCreate} style={{ borderRadius: '10px' }}>
                <i className="bi bi-plus-lg me-1" /> Add Product
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <DataTable endpoint="/products" columns={columns} refreshKey={refresh} filters={filters}
        query={{ category_id: filterCat, status: filterStatus, low_stock: lowOnly ? 1 : '' }}
        selectable={canDelete} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />

      <Modal show={!!form} onClose={() => setForm(null)} size="modal-lg" title={form?.id ? 'Edit Product' : 'Add Product'}
        footer={<>
          <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}>
        {form && (
          <form onSubmit={save} className="row">
            <div className="col-12 mb-3">
              <label className="form-label"><i className="bi bi-upc-scan me-1" />Scan barcode / QR to auto-fill</label>
              <BarcodeScanner onScan={scanIntoForm} placeholder="Scan product barcode/QR (USB or camera) or type code + Enter…" />
              <small className="text-muted">Scans an existing product → loads it; a new code → fills the Barcode field below.</small>
            </div>
            <div className="col-md-8 mb-3">
              <label className="form-label">Name *</label>
              <input className="form-control" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Unit</label>
              <input className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Category *</label>
              <select className="form-select" value={form.category_id} required onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={form.supplier_id || ''} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">SKU</label>
              <div className="input-group">
                <input className="form-control" value={form.sku} placeholder="Auto-generated" onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                {!form.id && <button type="button" className="btn btn-outline-secondary" onClick={genCodes}><i className="bi bi-magic" /></button>}
              </div>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Barcode</label>
              <input className="form-control" value={form.barcode} placeholder="Auto-generated" disabled={!!form.id}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">HSN / SAC Code</label>
              <input className="form-control" value={form.hsn_code || ''} placeholder="e.g. 8471 (for GST)"
                onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">GST Rate (%)</label>
              <select className="form-select" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}>
                {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
            </div>
            {num('Cost Price', 'cost_price', '0.01')}
            {num('Selling Price', 'selling_price', '0.01')}
            <div className="col-md-6 mb-3 d-flex align-items-end">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="taxInc" checked={!!+form.tax_inclusive}
                  onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked ? 1 : 0 })} />
                <label className="form-check-label" htmlFor="taxInc">Selling price is <strong>tax-inclusive</strong> (GST already in price)</label>
              </div>
            </div>
            {form.id ? num('Reorder Level', 'reorder_level') : num('Opening Qty', 'quantity')}
            {!form.id && num('Reorder Level', 'reorder_level')}
            <div className="col-md-6 mb-3">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Image</label>
              <input type="file" accept="image/*" className="form-control" onChange={(e) => setImageFile(e.target.files[0])} />
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>

      <BarcodeLabels product={labelProduct} shopName={settings?.company_name} onClose={() => setLabelProduct(null)} />

      <ConfirmModal show={!!del} onClose={() => setDel(null)} onConfirm={remove}
        title="Delete Product" message={`Delete "${del?.name}"? Products with history cannot be deleted.`} />

      {/* Deletion blocked → offer to deactivate */}
      <ConfirmModal
        show={!!blocked}
        onClose={() => setBlocked(null)}
        onConfirm={setInactive}
        loading={inactivating}
        danger={false}
        title="Can't delete this product"
        confirmText="Set Inactive"
        message={
          <>
            <strong>"{blocked?.name}"</strong> has purchase or sales history, so it can't be deleted
            (that would break your reports and records).
            <br /><br />
            Set it to <strong>inactive</strong> instead? It will be hidden from new sales and purchases
            but kept for history.
          </>
        }
      />

      <ConfirmModal
        show={showBulkDelConfirm}
        onClose={() => setShowBulkDelConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title="Delete Selected Products"
        message={`Are you sure you want to delete the ${selectedIds.length} selected products? Products with purchase or sales history will not be deleted.`}
      />

      {/* CSV Bulk Import Modal */}
      <Modal show={showImport} onClose={() => setShowImport(false)} title="Bulk Import Products via CSV" size="modal-md"
        footer={<>
          <button className="btn btn-light" onClick={() => setShowImport(false)}>Close</button>
          <button className="btn btn-primary" onClick={handleImportSubmit} disabled={importing || !importFile}>
            {importing && <span className="spinner-border spinner-border-sm me-2" />}Upload & Import
          </button>
        </>}>
        <div className="p-1">
          <p className="text-muted small mb-4">
            Import multiple products at once. Only <strong>name</strong> &amp; <strong>category</strong> are required.
            Optional columns: SKU, Barcode, <strong>hsn_code</strong>, <strong>tax_rate</strong> (GST %),
            <strong> tax_inclusive</strong> (1/0), unit, cost_price, selling_price, quantity, reorder_level, description.
            Missing Category/Supplier are auto-created. Auto-generated when SKU/Barcode are blank.
          </p>

          <div className="d-grid mb-4">
            <button type="button" className="btn btn-light text-primary border-primary border-dashed py-2.5 fw-semibold" onClick={downloadTemplate}>
              <i className="bi bi-download me-2" /> Download CSV Template
            </button>
          </div>

          <form onSubmit={handleImportSubmit}>
            <div className="mb-4">
              <label className="form-label fw-bold">Select CSV File <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-filetype-csv text-muted" /></span>
                <input type="file" id="csvFileInput" className="form-control border-start-0 bg-light-focus" accept=".csv" required
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </form>

          {importResult && (
            <div className="alert alert-info border-0 shadow-sm mt-3 p-3">
              <h6 className="fw-bold mb-2"><i className="bi bi-info-circle-fill me-2" />Import Summary</h6>
              <ul className="mb-0 small ps-3">
                <li>Successfully Imported: <strong>{importResult.imported}</strong> products</li>
                <li>Skipped: <strong>{importResult.skipped}</strong> rows</li>
              </ul>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3">
                  <div className="fw-bold small text-danger mb-1">Errors/Skipped Lines:</div>
                  <div className="bg-light p-2 rounded small border text-danger overflow-auto" style={{ maxHeight: '120px', fontFamily: 'monospace' }}>
                    {importResult.errors.map((err, idx) => <div key={idx}>{err}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
