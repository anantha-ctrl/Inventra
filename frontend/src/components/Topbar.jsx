import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { money } from '../utils/format';
import api, { API_ORIGIN } from '../api/client';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  // Only show/poll notifications if this role is allowed to (matches the
  // server-side role_permissions gate so we don't trigger 403 error toasts).
  const effectivePerms = user?.permissions ?? settings?.role_permissions?.[user?.role] ?? {};
  const canNotify = user?.role === 'Admin' || !!effectivePerms.notifications;

  // ----- Global search -----
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);   // mobile search overlay
  const searchRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.get('/search', { params: { q } })
        .then((r) => { setResults(r.data.data); setShowResults(true); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) { setShowResults(false); setMobileSearch(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goTo = (path) => { setShowResults(false); setMobileSearch(false); setQ(''); navigate(path); };
  const hasAnyResult = results && (results.products?.length || results.customers?.length || results.sales?.length);

  useEffect(() => {
    if (!canNotify) { setUnread(0); return; }
    let active = true;
    const fetchCount = () =>
      api.get('/notifications/unread-count', { skipErrorToast: true })
        .then((r) => active && setUnread(r.data.data.count))
        .catch(() => {});
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => { active = false; clearInterval(t); };
  }, [canNotify]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const initials = (user?.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Member';

  return (
    <header className="sh-topbar">
      {/* Left: menu (mobile) */}
      <button className="tb-menu-btn d-lg-none" onClick={onToggleSidebar} aria-label="Menu">
        <i className="bi bi-list" />
      </button>

      {/* Center: brand / logo (mobile only — desktop shows it in the sidebar) */}
      <div className="tb-mobile-brand d-lg-none">
        <i className="bi bi-boxes" />
        <span>{settings?.company_name || 'Inventra'}</span>
      </div>

      {/* Global search (desktop inline · mobile = overlay toggled by the search icon) */}
      <div className={`tb-search ${mobileSearch ? 'mobile-open' : ''}`} ref={searchRef}>
        <i className="bi bi-search tb-search-icon" />
        <input
          className="tb-search-input"
          placeholder="Search products, customers, invoices…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setShowResults(true)}
        />
        {showResults && q.trim().length >= 2 && (
          <div className="tb-search-results">
            {searching && <div className="tb-search-empty"><span className="spinner-border spinner-border-sm me-2" />Searching…</div>}
            {!searching && !hasAnyResult && <div className="tb-search-empty">No matches for “{q}”</div>}

            {results?.products?.length > 0 && (
              <>
                <div className="tb-search-group-label">Products</div>
                {results.products.map((p) => (
                  <div key={`p${p.id}`} className="tb-search-item" onClick={() => goTo('/products')}>
                    <span className="tb-si-ic" style={{ background: '#eef2ff', color: '#6366f1' }}><i className="bi bi-box-seam" /></span>
                    <div className="flex-grow-1">
                      <div className="tb-si-main">{p.name}</div>
                      <div className="tb-si-sub">{p.sku} · {p.category_name} · {p.quantity} in stock</div>
                    </div>
                    <span className="fw-semibold small">{money(p.selling_price)}</span>
                  </div>
                ))}
              </>
            )}

            {results?.customers?.length > 0 && (
              <>
                <div className="tb-search-group-label">Customers</div>
                {results.customers.map((c) => (
                  <div key={`c${c.id}`} className="tb-search-item" onClick={() => goTo('/customers')}>
                    <span className="tb-si-ic" style={{ background: '#ecfdf5', color: '#10b981' }}><i className="bi bi-person" /></span>
                    <div className="flex-grow-1">
                      <div className="tb-si-main">{c.name}</div>
                      <div className="tb-si-sub">{[c.phone, c.email, c.city].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {results?.sales?.length > 0 && (
              <>
                <div className="tb-search-group-label">Invoices</div>
                {results.sales.map((s) => (
                  <div key={`s${s.id}`} className="tb-search-item" onClick={() => goTo('/sales')}>
                    <span className="tb-si-ic" style={{ background: '#fef3c7', color: '#f59e0b' }}><i className="bi bi-receipt" /></span>
                    <div className="flex-grow-1">
                      <div className="tb-si-main">{s.invoice_no}</div>
                      <div className="tb-si-sub">{s.customer_name || 'Walk-in'} · {s.payment_status}</div>
                    </div>
                    <span className="fw-semibold small">{money(s.total_amount)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="d-flex align-items-center gap-2 gap-lg-3 tb-right">
        {/* Search icon (mobile) — opens the search overlay */}
        <button className="tb-theme-btn d-lg-none" onClick={() => { setMobileSearch((v) => !v); setTimeout(() => searchRef.current?.querySelector('input')?.focus(), 50); }} aria-label="Search">
          <i className="bi bi-search" />
        </button>

        {/* Dark mode toggle */}
        <button className="tb-theme-btn" onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} />
        </button>

        {/* Notification bell */}
        {canNotify && (
          <Link to="/notifications" className="tb-bell">
            <i className="bi bi-bell" />
            {unread > 0 && (
              <span className="tb-bell-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>
        )}

        {/* Profile dropdown */}
        <div className="tb-profile-wrap" ref={dropRef}>
          <button className="tb-profile-trigger" onClick={() => setOpen(!open)}>
            <div className="tb-avatar-ring">
              {user?.avatar ? (
                <img src={`${API_ORIGIN}/uploads/${user.avatar}`} alt="" className="tb-avatar-img" />
              ) : (
                <span className="tb-avatar-initials">{initials}</span>
              )}
              <span className="tb-online-dot" />
            </div>
            <span className="tb-profile-info d-none d-sm-flex">
              <span className="tb-profile-name">{user?.name}</span>
              <span className="tb-profile-role">{user?.role}</span>
            </span>
            <i className={`bi bi-chevron-down tb-chevron ${open ? 'open' : ''}`} />
          </button>

          {/* Custom dropdown */}
          <div className={`tb-dropdown ${open ? 'show' : ''}`}>
            {/* User card header */}
            <div className="tb-dd-header">
              <div className="tb-dd-avatar-wrap">
                {user?.avatar ? (
                  <img src={`${API_ORIGIN}/uploads/${user.avatar}`} alt="" className="tb-dd-avatar" />
                ) : (
                  <span className="tb-dd-avatar tb-dd-avatar-text">{initials}</span>
                )}
              </div>
              <div className="tb-dd-user-info">
                <span className="tb-dd-name">{user?.name}</span>
                <span className="tb-dd-email">{user?.email}</span>
              </div>
              <span className="tb-dd-role-chip">{user?.role}</span>
            </div>

            {/* Quick stats */}
            <div className="tb-dd-stats">
              <div className="tb-dd-stat">
                <i className="bi bi-shield-check" />
                <span>{user?.role}</span>
              </div>
              <div className="tb-dd-stat">
                <i className="bi bi-calendar3" />
                <span>{memberSince}</span>
              </div>
            </div>

            {/* Menu items */}
            <div className="tb-dd-menu">
              <Link to="/profile" className="tb-dd-item" onClick={() => setOpen(false)}>
                <div className="tb-dd-item-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                  <i className="bi bi-person" />
                </div>
                <div className="tb-dd-item-text">
                  <span>My Profile</span>
                  <small>View & edit your details</small>
                </div>
                <i className="bi bi-chevron-right tb-dd-item-arrow" />
              </Link>
              <Link to="/change-password" className="tb-dd-item" onClick={() => setOpen(false)}>
                <div className="tb-dd-item-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}>
                  <i className="bi bi-key" />
                </div>
                <div className="tb-dd-item-text">
                  <span>Change Password</span>
                  <small>Update your security</small>
                </div>
                <i className="bi bi-chevron-right tb-dd-item-arrow" />
              </Link>
              <Link to="/settings" className="tb-dd-item" onClick={() => setOpen(false)}>
                <div className="tb-dd-item-icon" style={{ background: '#f0f9ff', color: '#0ea5e9' }}>
                  <i className="bi bi-gear" />
                </div>
                <div className="tb-dd-item-text">
                  <span>System Settings</span>
                  <small>App & business configurations</small>
                </div>
                <i className="bi bi-chevron-right tb-dd-item-arrow" />
              </Link>
              {canNotify && (
                <Link to="/notifications" className="tb-dd-item" onClick={() => setOpen(false)}>
                  <div className="tb-dd-item-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                    <i className="bi bi-bell" />
                  </div>
                  <div className="tb-dd-item-text">
                    <span>Notifications</span>
                    <small>{unread > 0 ? `${unread} unread` : 'All caught up'}</small>
                  </div>
                  {unread > 0 && <span className="tb-dd-notif-badge">{unread}</span>}
                  <i className="bi bi-chevron-right tb-dd-item-arrow" />
                </Link>
              )}
            </div>

            {/* Logout */}
            <div className="tb-dd-footer">
              <button className="tb-dd-logout" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
