import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/client';

const STEPS = [
  { key: 'request', icon: 'bi-envelope-at', title: 'Verify email', text: 'Tell us the email tied to your account.' },
  { key: 'reset', icon: 'bi-shield-lock', title: 'Set new password', text: 'Use your reset token to choose a new password.' },
  { key: 'done', icon: 'bi-check2-circle', title: 'All set', text: 'Sign back in with your new credentials.' },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [stage, setStage] = useState('request'); // request | reset | done
  const [loading, setLoading] = useState(false);

  const stageIndex = STEPS.findIndex((s) => s.key === stage);

  const request = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success(data.message);
      if (data.data?.reset_token) {
        setToken(data.data.reset_token);
        toast.info('Dev mode: reset token auto-filled');
      }
      setStage('reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally { setLoading(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword });
      toast.success('Password reset! You can now sign in.');
      setStage('done');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  const titles = {
    request: ['Reset your password', "Enter your account email and we'll send you a reset link."],
    reset: ['Choose a new password', 'Paste your reset token and pick a strong new password.'],
    done: ['Password updated', 'Your password has been changed successfully.'],
  };

  return (
    <div className="login2">
      {/* ---------- Showcase panel with stepper ---------- */}
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
            Forgot your<br /><span>password?</span> No problem.
          </h1>
          <p className="login2-sub">
            Recover access to your account in three quick steps — secure and hassle-free.
          </p>

          <ol className="login2-steps">
            {STEPS.map((s, i) => {
              const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'todo';
              return (
                <li key={s.key} className={`login2-step ${state}`}>
                  <span className="login2-step-icon">
                    <i className={`bi ${state === 'done' ? 'bi-check-lg' : s.icon}`} />
                  </span>
                  <span className="login2-step-body">
                    <b>{s.title}</b>
                    <small>{s.text}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="login2-foot">© {new Date().getFullYear()} StockHive · Inventory Management System</div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="login2-form-panel">
        <div className="login2-form">
          <Link to="/" className="login2-brand login2-brand--mobile text-decoration-none">
            <span className="login2-logo"><i className="bi bi-boxes" /></span> StockHive
          </Link>

          <span className="login2-pill"><i className="bi bi-shield-lock" /> Account recovery</span>
          <h2 className="login2-title">{titles[stage][0]}</h2>
          <p className="text-muted mb-4">{titles[stage][1]}</p>

          {stage === 'request' && (
            <form onSubmit={request}>
              <label className="login2-label">Email address</label>
              <div className="login2-field">
                <i className="bi bi-envelope" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" required autoFocus />
              </div>
              <button className="login2-submit" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2" />Sending…</>
                  : <>Send Reset Link <i className="bi bi-arrow-right ms-1" /></>}
              </button>
            </form>
          )}

          {stage === 'reset' && (
            <form onSubmit={reset}>
              <label className="login2-label">Reset token</label>
              <div className="login2-field">
                <i className="bi bi-key" />
                <input value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token" required autoFocus />
              </div>
              <label className="login2-label">New password</label>
              <div className="login2-field">
                <i className="bi bi-lock" />
                <input type={showPw ? 'text' : 'password'} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
                <button type="button" className="login2-eye" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
                  <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
              <button className="login2-submit" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2" />Updating…</>
                  : <>Reset Password <i className="bi bi-arrow-right ms-1" /></>}
              </button>
            </form>
          )}

          {stage === 'done' && (
            <div className="login2-done">
              <span className="login2-done-icon"><i className="bi bi-check-lg" /></span>
              <p className="text-muted mb-4">You can now sign in with your new password.</p>
              <button className="login2-submit" onClick={() => navigate('/login')}>
                Go to Sign In <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
          )}

          <div className="text-center mt-3">
            <Link to="/login" className="login2-link d-inline-flex align-items-center gap-1">
              <i className="bi bi-arrow-left" /> Back to login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
