import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../api/client';
import Modal from '../components/Modal';
import Receipt from '../components/Receipt';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { money } from '../utils/format';

const GST_SLABS = [0, 5, 12, 18, 28];
const MODES = [
  { key: 'cash', label: 'Cash', icon: 'bi-cash-coin' },
  { key: 'upi', label: 'UPI', icon: 'bi-qr-code' },
  { key: 'card', label: 'Card', icon: 'bi-credit-card' },
];

export default function POS() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { isDark, toggleTheme } = useTheme();

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [held, setHeld] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(0);

  const [showPay, setShowPay] = useState(false);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(null);
  const [showHeld, setShowHeld] = useState(false);
  const searchRef = useRef(null);

  const loadProducts = useCallback(() => api.get('/products/list').then((r) => setProducts(r.data.data.filter((p) => p.status === 'active'))).catch(() => {}), []);
  const loadHeld = useCallback(() => api.get('/held-sales').then((r) => setHeld(r.data.data)).catch(() => {}), []);
  useEffect(() => {
    loadProducts();
    api.get('/customers/list').then((r) => setCustomers(r.data.data)).catch(() => {});
    loadHeld();
  }, [loadProducts, loadHeld]);

  // ----- Cart maths (net unit price; tax-inclusive products decomposed) -----
  const stockOf = (id) => products.find((p) => String(p.id) === String(id))?.quantity ?? 0;

  const addProduct = (p) => {
    if (!p) return;
    const rate = +p.tax_rate || 0;
    const netUnit = p.tax_inclusive && rate > 0 ? +(p.selling_price / (1 + rate / 100)).toFixed(2) : +p.selling_price;
    setGstRate((g) => (g === 0 && rate > 0 ? rate : g)); // auto-suggest bill GST from product
    setCart((c) => {
      const i = c.findIndex((x) => x.product_id === p.id);
      if (i >= 0) {
        if (c[i].quantity + 1 > stockOf(p.id)) { toast.warning(`Only ${stockOf(p.id)} in stock`); return c; }
        const next = [...c]; next[i] = { ...next[i], quantity: next[i].quantity + 1 }; return next;
      }
      if (stockOf(p.id) < 1) { toast.warning(`${p.name} is out of stock`); return c; }
      return [...c, { product_id: p.id, name: p.name, sku: p.sku, hsn_code: p.hsn_code, unit_price: netUnit, quantity: 1 }];
    });
  };

  const setQty = (id, q) => setCart((c) => c.map((x) => {
    if (x.product_id !== id) return x;
    const qty = Math.max(1, Math.min(+q || 1, stockOf(id)));
    return { ...x, quantity: qty };
  }));
  const removeLine = (id) => setCart((c) => c.filter((x) => x.product_id !== id));
  const clearCart = () => { setCart([]); setDiscount(0); setGstRate(0); setCustomerId(''); };

  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.quantity * x.unit_price, 0), [cart]);
  const taxable = Math.max(0, subtotal - (+discount || 0));
  const taxAmt = +(taxable * (+gstRate || 0) / 100).toFixed(2);
  const grand = +(taxable + taxAmt).toFixed(2);

  // ----- Scanner / search add -----
  const onScanEnter = async (code) => {
    const c = code.trim();
    if (!c) return;
    // try local match first (name/sku/barcode)
    const local = products.find((p) => p.barcode === c || p.sku?.toLowerCase() === c.toLowerCase());
    if (local) { addProduct(local); setSearch(''); return; }
    try {
      const { data } = await api.get('/products/lookup', { params: { code: c }, skipErrorToast: true });
      addProduct(products.find((p) => p.id === data.data.id) || data.data);
      setSearch('');
    } catch { toast.error(`No product for "${c}"`); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 60);
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.includes(q)).slice(0, 60);
  }, [products, search]);

  // ----- Payments -----
  const paidTotal = payments.reduce((s, p) => s + (+p.amount || 0), 0);
  const balance = +(grand - paidTotal).toFixed(2);
  const openPay = () => {
    if (cart.length === 0) return toast.warning('Cart is empty');
    setPayments([{ mode: 'cash', amount: String(grand) }]);
    setShowPay(true);
  };
  const setPay = (i, key, val) => setPayments((ps) => ps.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));
  const addSplit = () => setPayments((ps) => [...ps, { mode: 'upi', amount: String(Math.max(0, balance)) }]);
  const removeSplit = (i) => setPayments((ps) => ps.filter((_, idx) => idx !== i));

  // Amount to encode in the UPI QR: the UPI split line if one is being entered,
  // otherwise the full bill total. Always normalised to 2 decimals (UPI apps
  // reject amounts that aren't a clean rupee value, e.g. 290.5 or 290.555).
  const upiAmount = useMemo(() => {
    const upiLine = payments.find((p) => p.mode === 'upi');
    const raw = upiLine && +upiLine.amount > 0 ? +upiLine.amount : grand;
    return (Math.round((+raw || 0) * 100) / 100).toFixed(2);
  }, [payments, grand]);

  const upiString = useMemo(() => {
    const pa = (settings?.upi_id || '').trim();
    if (!pa) return '';
    const pn = encodeURIComponent(settings?.company_name || 'Shop');
    const tn = encodeURIComponent(`${settings?.company_name || 'Shop'} bill`);
    // NPCI UPI deep-link — am carries the exact amount so the customer's
    // GPay/PhonePe/Paytm auto-fills it on scan. VPA's @ is left raw on purpose.
    return `upi://pay?pa=${pa}&pn=${pn}&am=${upiAmount}&cu=INR&tn=${tn}`;
  }, [settings, upiAmount]);

  const completeSale = async () => {
    if (cart.length === 0) return;
    const validPays = payments.filter((p) => +p.amount > 0).map((p) => ({ mode: p.mode, amount: +p.amount }));
    setSaving(true);
    try {
      const payload = {
        sale_date: new Date().toISOString().slice(0, 10),
        customer_id: customerId || '',
        discount: +discount || 0,
        tax_rate: +gstRate || 0,
        items: cart.map((x) => ({ product_id: x.product_id, quantity: x.quantity, unit_price: x.unit_price })),
        payments: validPays.length ? validPays : undefined,
        paid_amount: validPays.length ? undefined : grand,
      };
      const { data } = await api.post('/sales', payload);
      const { data: full } = await api.get(`/sales/${data.data.id}`);
      setCompleted(full.data);
      setShowPay(false);
      clearCart();
      loadProducts();
      toast.success(`${data.data.invoice_no} saved`);
    } catch { /* handled */ } finally { setSaving(false); }
  };

  // ----- Hold / Resume -----
  const holdBill = async () => {
    if (cart.length === 0) return toast.warning('Cart is empty');
    try {
      await api.post('/held-sales', { customer_id: customerId || '', cart: { items: cart, discount, gstRate } });
      toast.success('Bill held');
      clearCart(); loadHeld();
    } catch { /* handled */ }
  };
  const resumeBill = (h) => {
    const data = h.cart;
    setCart(data.items || []);
    setDiscount(data.discount || 0);
    setGstRate(data.gstRate || 0);
    setCustomerId(h.customer_id || '');
    api.delete(`/held-sales/${h.id}`).then(loadHeld).catch(() => {});
    setShowHeld(false);
  };

  // ----- Keyboard shortcuts -----
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); clearCart(); }
      else if (e.key === 'F4') { e.preventDefault(); openPay(); }
      else if (e.key === 'F9') { e.preventDefault(); holdBill(); }
      else if (e.key === 'Escape') { setShowPay(false); setShowHeld(false); }
      else if (e.key === '/' && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, grand, discount, gstRate, customerId, payments]);

  // Print the thermal slip cleanly: inject an @page rule sized to the paper
  // roll (kills A4 margins + the browser's date/url/page-number header & footer),
  // flag <html> so the print stylesheet narrows the body, then restore after.
  const printReceipt = () => {
    const width = String(settings?.receipt_width || '80'); // 80mm or 58mm roll
    const styleId = 'pos-thermal-page';
    let el = document.getElementById(styleId);
    if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el); }
    el.textContent = `@media print { @page { size: ${width}mm auto; margin: 0; } }`;
    document.documentElement.classList.add('thermal-print');
    const cleanup = () => {
      document.documentElement.classList.remove('thermal-print');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000); // fallback if afterprint doesn't fire
  };

  return (
    <div className="pos-wrap">
      <div className="pos-topbar">
        <button className="btn btn-light" onClick={() => navigate('/dashboard')} title="Back"><i className="bi bi-arrow-left" /></button>
        <span className="pos-brand"><i className="bi bi-boxes" /> {settings?.company_name || 'Inventra'} POS</span>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="text-muted small d-none d-md-inline">
            <span className="pos-kbd">F2</span> New · <span className="pos-kbd">F4</span> Pay · <span className="pos-kbd">F9</span> Hold · <span className="pos-kbd">/</span> Search
          </span>
          <button className="btn btn-light position-relative" onClick={() => setShowHeld(true)} title="Held bills">
            <i className="bi bi-pause-circle" />
            {held.length > 0 && <span className="badge bg-warning text-dark position-absolute top-0 start-100 translate-middle rounded-pill">{held.length}</span>}
          </button>
          <button className="btn btn-light" onClick={toggleTheme}><i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} /></button>
        </div>
      </div>

      <div className="pos-body">
        {/* Products */}
        <div className="pos-main">
          <div className="pos-scanbar">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-upc-scan" /></span>
              <input ref={searchRef} className="form-control" placeholder="Scan barcode or search product (press / )…"
                value={search} autoFocus
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onScanEnter(search); } }} />
            </div>
          </div>
          <div className="pos-grid">
            {filtered.length === 0 && <p className="text-muted">No products found.</p>}
            {filtered.map((p) => {
              const st = p.quantity <= 0 ? 'out' : p.quantity <= p.reorder_level ? 'low' : '';
              return (
                <button key={p.id} className="pos-product-card" onClick={() => addProduct(p)} disabled={p.quantity <= 0}>
                  <span className="pos-pc-name">{p.name}</span>
                  <span className="pos-pc-sku">{p.sku}</span>
                  <span className="pos-pc-bottom">
                    <span className="pos-pc-price">{money(p.selling_price)}</span>
                    <span className={`pos-pc-stock ${st}`}>{p.quantity} {p.unit}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="pos-cart">
          <div className="pos-cart-head">
            <i className="bi bi-cart3 fs-5" />
            <select className="form-select form-select-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-cart-empty"><i className="bi bi-cart-x fs-1 d-block mb-2" />Cart is empty<br /><small>Scan or tap a product</small></div>
            ) : cart.map((x) => (
              <div className="pos-line" key={x.product_id}>
                <div className="pos-line-main">
                  <div className="pos-line-name">{x.name}</div>
                  <div className="pos-line-sub">{money(x.unit_price)} × {x.quantity} = {money(x.unit_price * x.quantity)}</div>
                </div>
                <div className="pos-qty">
                  <button onClick={() => setQty(x.product_id, x.quantity - 1)}>−</button>
                  <input value={x.quantity} onChange={(e) => setQty(x.product_id, e.target.value)} />
                  <button onClick={() => setQty(x.product_id, x.quantity + 1)}>+</button>
                </div>
                <button className="btn btn-sm btn-link text-danger" onClick={() => removeLine(x.product_id)}><i className="bi bi-trash" /></button>
              </div>
            ))}
          </div>

          <div className="pos-cart-foot">
            <div className="pos-tot-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="pos-tot-row align-items-center">
              <span>Discount</span>
              <input type="number" min="0" className="form-control form-control-sm w-auto" style={{ width: 90 }} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="pos-tot-row align-items-center">
              <span>GST %</span>
              <div className="btn-group btn-group-sm">
                {GST_SLABS.map((g) => (
                  <button key={g} className={`btn btn-${gstRate === g ? 'primary' : 'outline-secondary'}`} onClick={() => setGstRate(g)}>{g}</button>
                ))}
              </div>
            </div>
            <div className="pos-tot-row"><span>Tax</span><span>{money(taxAmt)}</span></div>
            <hr className="my-2" />
            <div className="pos-tot-row pos-tot-grand"><span>Total</span><span>{money(grand)}</span></div>
            <div className="pos-actions">
              <button className="btn btn-light" onClick={clearCart} title="F2"><i className="bi bi-trash" /></button>
              <button className="btn btn-warning" onClick={holdBill} title="F9"><i className="bi bi-pause-circle me-1" />Hold</button>
              <button className="btn btn-success pos-pay-btn" onClick={openPay} disabled={cart.length === 0} title="F4">
                <i className="bi bi-cash-stack me-1" />Pay {money(grand)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      <Modal show={showPay} onClose={() => setShowPay(false)} title="Payment" size="modal-lg"
        footer={<>
          <div className="me-auto">
            <span className="fw-bold fs-5">{money(grand)}</span>
            {balance > 0.001 ? <span className="text-danger ms-3">Balance {money(balance)}</span>
              : balance < -0.001 ? <span className="text-success ms-3">Change {money(-balance)}</span>
              : <span className="text-success ms-3">Exact</span>}
          </div>
          <button className="btn btn-light" onClick={() => setShowPay(false)}>Cancel</button>
          <button className="btn btn-success" onClick={completeSale} disabled={saving || paidTotal <= 0}>
            {saving && <span className="spinner-border spinner-border-sm me-2" />}Complete Sale
          </button>
        </>}>
        <div className="row">
          <div className="col-md-7">
            {payments.map((p, i) => (
              <div key={i} className="mb-3 p-3 border rounded-3">
                <div className="d-flex gap-2 mb-2">
                  {MODES.map((m) => (
                    <button key={m.key} className={`pos-pay-mode ${p.mode === m.key ? 'active' : ''}`} onClick={() => setPay(i, 'mode', m.key)}>
                      <i className={`bi ${m.icon}`} />{m.label}
                    </button>
                  ))}
                </div>
                <div className="input-group">
                  <span className="input-group-text">{money(0).charAt(0)}</span>
                  <input type="number" min="0" step="0.01" className="form-control" placeholder="Amount"
                    value={p.amount} onChange={(e) => setPay(i, 'amount', e.target.value)} autoFocus={i === 0} />
                  {payments.length > 1 && <button className="btn btn-outline-danger" onClick={() => removeSplit(i)}><i className="bi bi-x" /></button>}
                </div>
              </div>
            ))}
            <button className="btn btn-sm btn-outline-primary" onClick={addSplit}><i className="bi bi-plus" /> Split payment</button>
            {/* quick cash buttons */}
            <div className="mt-3 d-flex gap-2 flex-wrap">
              {[grand, 100, 200, 500, 2000].map((v, idx) => (
                <button key={idx} className="btn btn-sm btn-light border" onClick={() => setPay(0, 'amount', String(v))}>
                  {idx === 0 ? 'Exact' : money(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-5 text-center border-start">
            {payments.some((p) => p.mode === 'upi') ? (
              settings?.upi_id ? (
                <>
                  <p className="fw-semibold mb-2">Scan to pay via UPI</p>
                  <QRCodeCanvas value={upiString} size={180} includeMargin level="M" />
                  <div className="pos-upi-amt mt-2">Pay {money(+upiAmount)}</div>
                  <p className="small text-muted mb-1">{settings.upi_id}</p>
                  <p className="small text-muted">Amount is pre-filled on scan</p>
                </>
              ) : <p className="text-muted small mt-5">Set a UPI ID in Settings to show a payment QR.</p>
            ) : <p className="text-muted small mt-5"><i className="bi bi-qr-code fs-1 d-block mb-2" />Select UPI to show a QR code.</p>}
          </div>
        </div>
      </Modal>

      {/* Held bills */}
      <Modal show={showHeld} onClose={() => setShowHeld(false)} title="Held Bills" size="modal-md">
        {held.length === 0 ? <p className="text-muted">No held bills.</p> : (
          <div className="list-group">
            {held.map((h) => (
              <div key={h.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">{h.label}</div>
                  <small className="text-muted">{h.customer_name || 'Walk-in'} · {h.cart?.items?.length || 0} items</small>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={() => resumeBill(h)}>Resume</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => api.delete(`/held-sales/${h.id}`).then(loadHeld)}><i className="bi bi-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Receipt after sale */}
      <Modal show={!!completed} onClose={() => setCompleted(null)} title="Sale Complete" size="modal-md"
        footer={<>
          <button className="btn btn-outline-secondary" onClick={printReceipt}><i className="bi bi-printer me-1" />Print Receipt</button>
          <button className="btn btn-primary" onClick={() => setCompleted(null)}><i className="bi bi-plus-lg me-1" />New Sale</button>
        </>}>
        {completed && (
          <div className="d-flex justify-content-center">
            <Receipt sale={completed} settings={settings} width={String(settings?.receipt_width || '80')} />
          </div>
        )}
      </Modal>
    </div>
  );
}
