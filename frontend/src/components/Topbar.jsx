import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { API_ORIGIN } from '../api/client';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchCount = () =>
      api.get('/notifications/unread-count')
        .then((r) => active && setUnread(r.data.data.count))
        .catch(() => {});
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

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
      <button className="btn btn-light d-lg-none" onClick={onToggleSidebar}>
        <i className="bi bi-list" />
      </button>
      <div className="fw-semibold text-muted d-none d-md-block">
        Inventory Management & Stock Monitoring
      </div>
      <div className="d-flex align-items-center gap-3">
        {/* Notification bell */}
        <Link to="/notifications" className="tb-bell">
          <i className="bi bi-bell" />
          {unread > 0 && (
            <span className="tb-bell-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </Link>

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
