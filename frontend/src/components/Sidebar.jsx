import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const links = [
  { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard', group: 'Main' },
  { to: '/products', icon: 'bi-box-seam', label: 'Products', group: 'Inventory' },
  { to: '/categories', icon: 'bi-tags', label: 'Categories', group: 'Inventory' },
  { to: '/stock', icon: 'bi-arrow-left-right', label: 'Stock Movements', group: 'Inventory' },
  { to: '/purchases', icon: 'bi-cart-plus', label: 'Purchases', group: 'Operations' },
  { to: '/sales', icon: 'bi-receipt', label: 'Sales', group: 'Operations' },
  { to: '/suppliers', icon: 'bi-truck', label: 'Suppliers', group: 'Operations' },
  { to: '/customers', icon: 'bi-people', label: 'Customers', group: 'Operations' },
  { to: '/reports', icon: 'bi-bar-chart-line', label: 'Reports', group: 'Insights' },
  { to: '/notifications', icon: 'bi-bell', label: 'Notifications', group: 'Insights' },
  { to: '/activity-logs', icon: 'bi-clock-history', label: 'Activity Logs', group: 'Admin', roles: ['Admin', 'Manager'] },
  { to: '/users', icon: 'bi-person-gear', label: 'Users', group: 'Admin', roles: ['Admin'] },
  { to: '/settings', icon: 'bi-gear', label: 'Settings', group: 'Admin' },
];

export default function Sidebar({ open, onClose }) {
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  const visible = links.filter((l) => !l.roles || hasRole(...l.roles));

  let lastGroup = null;
  return (
    <>
      <aside className={`sh-sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <i className="bi bi-boxes" /> {settings?.company_name || 'StockHive'}
        </div>
        <nav className="sh-nav">
          {visible.map((l) => {
            const showGroup = l.group !== lastGroup;
            lastGroup = l.group;
            return (
              <div key={l.to}>
                {showGroup && <div className="nav-label">{l.group}</div>}
                <NavLink to={l.to} end={l.to === '/dashboard'} onClick={onClose}>
                  <i className={`bi ${l.icon}`} /> {l.label}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    </>
  );
}
