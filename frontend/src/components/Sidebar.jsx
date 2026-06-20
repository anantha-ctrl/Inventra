import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const links = [
  { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard', group: 'Main' },
  { to: '/products', icon: 'bi-box-seam', label: 'Products', group: 'Inventory' },
  { to: '/categories', icon: 'bi-tags', label: 'Categories', group: 'Inventory' },
  { to: '/stock', icon: 'bi-arrow-left-right', label: 'Stock Movements', group: 'Inventory' },
  { to: '/pos', icon: 'bi-bag-check', label: 'POS Terminal', group: 'Operations' },
  { to: '/purchases', icon: 'bi-cart-plus', label: 'Purchases', group: 'Operations' },
  { to: '/sales', icon: 'bi-receipt', label: 'Sales', group: 'Operations' },
  { to: '/expenses', icon: 'bi-wallet2', label: 'Expenses', group: 'Operations' },
  { to: '/suppliers', icon: 'bi-truck', label: 'Suppliers', group: 'Operations' },
  { to: '/customers', icon: 'bi-people', label: 'Customers', group: 'Operations' },
  { to: '/reports', icon: 'bi-bar-chart-line', label: 'Reports', group: 'Insights' },
  { to: '/day-close', icon: 'bi-journal-check', label: 'Day Close', group: 'Insights' },
  { to: '/notifications', icon: 'bi-bell', label: 'Notifications', group: 'Insights' },
  { to: '/activity-logs', icon: 'bi-clock-history', label: 'Activity Logs', group: 'Admin', roles: ['Admin', 'Manager'] },
  { to: '/users', icon: 'bi-person-gear', label: 'Users', group: 'Admin', roles: ['Admin'] },
  { to: '/settings', icon: 'bi-gear', label: 'Settings', group: 'Admin' },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const visible = links.filter((l) => {
    if (user?.role === 'Admin') return true;
    if (l.to === '/dashboard') return true;
    if (l.to === '/settings') return false;
    // Expenses & Day Close hold financial data → Manager only (besides Admin).
    if (l.to === '/expenses' || l.to === '/day-close') return user?.role === 'Manager';

    // Per-user permissions take priority; fall back to role defaults (old sessions).
    const permissions = user?.permissions ?? settings?.role_permissions?.[user?.role] ?? {};
    const routeMap = {
      '/products': 'products',
      '/categories': 'categories',
      '/stock': 'stock',
      '/pos': 'pos',
      '/purchases': 'purchases',
      '/sales': 'sales',
      '/suppliers': 'suppliers',
      '/customers': 'customers',
      '/reports': 'reports',
      '/notifications': 'notifications',
      '/activity-logs': 'activity-logs',
      '/users': 'users'
    };
    
    const permissionKey = routeMap[l.to];
    if (permissionKey !== undefined) {
      return !!permissions[permissionKey];
    }
    return false;
  });

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
