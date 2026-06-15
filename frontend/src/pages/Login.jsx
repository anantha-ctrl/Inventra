import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'bi-box-seam', text: 'Real-time stock tracking' },
  { icon: 'bi-graph-up-arrow', text: 'Sales & profit analytics' },
  { icon: 'bi-shield-check', text: 'Role-based secure access' },
];

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@stockhive.test');
  const [password, setPassword] = useState('Password@123');
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  const quick = (em) => { setEmail(em); setPassword('Password@123'); };

  return (
    <div className="login2">
      {/* ---------- Showcase panel ---------- */}
      <aside className="login2-showcase">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="login2-grid" />

        <div className="login2-showcase-inner">
          <Link to="/" className="login2-brand text-decoration-none">
            <span className="login2-logo"><i className="bi bi-boxes" /></span>
            StockHive
          </Link>
          <h1 className="login2-headline">
            Take control of your<br /><span>inventory</span> in real time.
          </h1>
          <p className="login2-sub">
            A unified workspace for products, purchases, sales and stock — with
            live analytics and role-based control.
          </p>

          <ul className="login2-features">
            {FEATURES.map((f) => (
              <li key={f.text}><i className={`bi ${f.icon}`} />{f.text}</li>
            ))}
          </ul>
        </div>

        <div className="login2-foot">© {new Date().getFullYear()} StockHive · Inventory Management System <br /> Designed and Developed by <a href="https://cloudhawk.in" target="_blank">CloudHawk</a> </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="login2-form-panel">
        <div className="login2-form">
          <Link to="/" className="login2-brand login2-brand--mobile text-decoration-none">
            <span className="login2-logo"><i className="bi bi-boxes" /></span> StockHive
          </Link>

          <span className="login2-pill"><i className="bi bi-stars" /> Welcome back</span>
          <h2 className="login2-title">Sign in to your account</h2>
          <p className="text-muted mb-4">Enter your credentials to access the dashboard.</p>

          <form onSubmit={submit}>
            <label className="login2-label">Email address</label>
            <div className="login2-field">
              <i className="bi bi-envelope" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required autoFocus />
            </div>

            <label className="login2-label">Password</label>
            <div className="login2-field">
              <i className="bi bi-lock" />
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <button type="button" className="login2-eye" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
                <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <label className="login2-remember">
                <input type="checkbox" defaultChecked /> Remember me
              </label>
              <Link to="/forgot-password" className="login2-link">Forgot password?</Link>
            </div>

            <button className="login2-submit" disabled={loading}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" />Signing in…</>
                : <>Sign In <i className="bi bi-arrow-right ms-1" /></>}
            </button>

            <div className="text-center mt-3">
              <Link to="/" className="login2-link d-inline-flex align-items-center gap-1">
                <i className="bi bi-arrow-left" /> Back to Home
              </Link>
            </div>
          </form>

          <div className="login2-demo">
            <span className="login2-demo-title">Demo accounts · password <code>Password@123</code></span>
            <div className="login2-demo-chips">
              <button onClick={() => quick('admin@stockhive.test')}><i className="bi bi-shield-lock" /> Admin</button>
              <button onClick={() => quick('manager@stockhive.test')}><i className="bi bi-person-badge" /> Manager</button>
              <button onClick={() => quick('staff@stockhive.test')}><i className="bi bi-person" /> Staff</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
