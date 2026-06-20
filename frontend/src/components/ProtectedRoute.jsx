import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import AccessDenied from '../pages/AccessDenied';

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  const { settings } = useSettings();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin has access to all routes
  if (user.role === 'Admin') {
    return children;
  }

  // Static role checks (e.g. Users page which is strictly Admin-only)
  if (roles && !roles.includes(user.role)) {
    return <AccessDenied />;
  }

  // Dynamic route permissions check
  const path = location.pathname;
  if (path !== '/dashboard' && path !== '/profile' && path !== '/change-password') {
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
      '/users': 'users',
      '/settings': 'settings' // settings is Admin-only for Staff/Manager
    };

    const permissionKey = routeMap[path];
    if (permissionKey !== undefined) {
      if (permissionKey === 'settings') {
        return <AccessDenied />;
      }

      // Per-user permissions take priority; fall back to role defaults.
      const permissions = user.permissions ?? settings?.role_permissions?.[user.role] ?? {};
      if (!permissions[permissionKey]) {
        return <AccessDenied />;
      }
    }
  }

  return children;
}
