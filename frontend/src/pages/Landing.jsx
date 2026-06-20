import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'bi-box-seam', title: 'Product Management', text: 'CRUD with images, auto SKU & barcode generation, HSN codes, GST rates, reorder levels and category mapping.' },
  { icon: 'bi-upc-scan', title: 'POS Billing Terminal', text: 'Full-screen billing with barcode scan, quick keys, hold/resume bills and a thermal 58/80mm GST receipt.' },
  { icon: 'bi-qr-code', title: 'Payments & GST', text: 'Cash / UPI / card split payments, partial dues, CGST/SGST tax split and a UPI QR with the amount pre-filled.' },
  { icon: 'bi-arrow-left-right', title: 'Real-time Stock', text: 'Stock in / out, adjustments, damaged & returned tracking with an immutable movement ledger.' },
  { icon: 'bi-cart-check', title: 'Purchase Workflow', text: 'Purchase orders with a pending → approved → received approval flow and supplier integration.' },
  { icon: 'bi-bar-chart-line', title: 'Analytics & 20 Reports', text: 'Dashboards, GST, profit & loss, stock valuation and more — exportable to PDF, Excel, CSV or print.' },
];

const ROLES = [
  { icon: 'bi-shield-lock', name: 'Admin', color: 'danger', perks: ['Full system control', 'User & per-user permissions', 'Delete & audit access'] },
  { icon: 'bi-person-badge', name: 'Manager', color: 'primary', perks: ['Approve purchases', 'POS, expenses & day-close', 'View all reports'] },
  { icon: 'bi-person', name: 'Staff', color: 'secondary', perks: ['POS billing & sales', 'Stock movements', 'Create purchase orders'] },
];

const STEPS = [
  { icon: 'bi-folder-plus', title: '1. Catalog Setup', text: 'Add products, configure categories, assign suppliers, set GST rates and low-stock thresholds.' },
  { icon: 'bi-arrow-repeat', title: '2. Bill & Record', text: 'Sell fast at the POS terminal and record purchases — stock levels update in real time.' },
  { icon: 'bi-graph-up', title: '3. Audit & Reports', text: 'Monitor dashboard analytics, run the day-close Z-report, and export reports instantly.' },
];

export default function Landing() {
  const { user } = useAuth();
  const appLink = user ? '/dashboard' : '/login';

  return (
    <div className="land">
      {/* ---------- Navbar ---------- */}
      <header className="land-nav">
        <div className="land-container land-nav-inner">
          <a href="#top" className="land-brand">
            <span className="land-logo"><i className="bi bi-boxes" /></span> Inventra Mart
          </a>
          <nav className="land-links">
            <a href="#features">Features</a>
            <a href="#roles">Roles</a>
            <a href="#workflow">How it Works</a>
          </nav>
          <div className="land-nav-cta">
            {user
              ? <Link to="/dashboard" className="land-btn land-btn-primary">Open Dashboard <i className="bi bi-arrow-right" /></Link>
              : <>
                <Link to="/login" className="land-btn land-btn-ghost">Sign in</Link>
                <Link to="/login" className="land-btn land-btn-primary">Get Started <i className="bi bi-arrow-right" /></Link>
              </>}
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="land-hero" id="top">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="land-grid-bg" />
        <div className="land-container land-hero-inner">
          <div className="land-hero-copy">
            <span className="land-pill"><i className="bi bi-stars" /> Inventory Management & POS Billing</span>
            <h1 className="land-h1">
              Run your shop &amp; <span>inventory</span> in real time.
            </h1>
            <p className="land-lead">
              Inventra Mart unifies products, purchases, sales, a full POS billing terminal with GST,
              suppliers and live stock tracking into one secure, role-based workspace — with analytics
              and instant report exports.
            </p>
            <div className="land-hero-actions">
              <Link to={appLink} className="land-btn land-btn-primary land-btn-lg">
                {user ? 'Go to Dashboard' : 'Launch the App'} <i className="bi bi-arrow-right" />
              </Link>
              <a href="#features" className="land-btn land-btn-outline land-btn-lg">Explore Features</a>
            </div>
            <div className="land-trust">
              <span><i className="bi bi-check-circle-fill" /> POS · GST · UPI billing</span>
              <span><i className="bi bi-check-circle-fill" /> Role + per-user access</span>
              <span><i className="bi bi-check-circle-fill" /> PDF / Excel exports</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="land-hero-visual">
            <div className="land-window">
              <div className="land-window-bar">
                <span /><span /><span />
                <div className="land-window-url">inventra · dashboard</div>
              </div>
              <div className="land-window-body">
                <div className="lw-stats">
                  <div className="lw-stat g1"><small>Products</small><b>1,248</b></div>
                  <div className="lw-stat g2"><small>Revenue</small><b>₹2.6L</b></div>
                  <div className="lw-stat g3"><small>Low stock</small><b>3</b></div>
                </div>
                <div className="lw-chart">
                  {[55, 72, 40, 88, 64, 95, 70, 82].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="lw-rows">
                  <div className="lw-row"><span className="lw-dot ok" /> Wireless Mouse <em>+40</em></div>
                  <div className="lw-row"><span className="lw-dot warn" /> USB-C Cable <em>8 / 20</em></div>
                  <div className="lw-row"><span className="lw-dot ok" /> INV-2026-0001 <em>paid</em></div>
                </div>
              </div>
            </div>
            <div className="land-badge-float a"><i className="bi bi-graph-up-arrow" /> +18% sales</div>
            <div className="land-badge-float b"><i className="bi bi-bell-fill" /> Low stock alert</div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="land-section" id="features">
        <div className="land-container">
          <div className="land-head">
            <span className="land-eyebrow">Everything you need</span>
            <h2 className="land-h2">One platform for your entire inventory &amp; billing workflow</h2>
            <p className="land-sub">From purchase to point-of-sale — track every unit, automate the busywork, and stay in control.</p>
          </div>
          <div className="land-feature-grid">
            {FEATURES.map((f) => (
              <div className="land-feature" key={f.title}>
                <div className="land-feature-icon"><i className={`bi ${f.icon}`} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Roles ---------- */}
      <section className="land-section land-section-alt" id="roles">
        <div className="land-container">
          <div className="land-head">
            <span className="land-eyebrow">Role-based access</span>
            <h2 className="land-h2">The right access for every team member</h2>
            <p className="land-sub">Granular role + per-user permissions enforced on both the UI and the API.</p>
          </div>
          <div className="land-role-grid">
            {ROLES.map((r) => (
              <div className={`land-role land-role-${r.color}`} key={r.name}>
                <div className="land-role-icon"><i className={`bi ${r.icon}`} /></div>
                <h3>{r.name}</h3>
                <ul>
                  {r.perks.map((p) => <li key={p}><i className="bi bi-check2" />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it Works ---------- */}
      <section className="land-section" id="workflow">
        <div className="land-container">
          <div className="land-head">
            <span className="land-eyebrow">Quick Guide</span>
            <h2 className="land-h2">How Inventra Mart Works</h2>
            <p className="land-sub">A simple 3-step workflow to streamline your inventory &amp; billing operations.</p>
          </div>
          <div className="land-feature-grid">
            {STEPS.map((s) => (
              <div className="land-feature" key={s.title}>
                <div className="land-feature-icon"><i className={`bi ${s.icon}`} /></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="land-cta-band">
        <div className="orb orb-2" />
        <div className="land-container land-cta-inner">
          <h2>Ready to take control of your shop?</h2>
          <p>Sign in and explore the full Inventra Mart dashboard with demo data.</p>
          <Link to={appLink} className="land-btn land-btn-light land-btn-lg">
            {user ? 'Open Dashboard' : 'Get Started'} <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="land-footer">
        <div className="land-container land-footer-inner">
          <a href="#top" className="land-brand">
            <span className="land-logo"><i className="bi bi-boxes" /></span> Inventra Mart
          </a>
          <p>© {new Date().getFullYear()} Inventra Mart · Inventory Management & POS Billing System <br /> Designed and Developed by <a href="https://cloudhawk.in" target="_blank" rel="noreferrer">CloudHawk</a></p>
          <div className="land-footer-links">
            <a href="#features">Features</a>
            <a href="#roles">Roles</a>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
