import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - Indian Standard Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

const CURRENCIES = [
  { value: 'USD', symbol: '$', label: 'USD (US Dollar - $)' },
  { value: 'INR', symbol: '₹', label: 'INR (Indian Rupee - ₹)' },
  { value: 'EUR', symbol: '€', label: 'EUR (Euro - €)' },
  { value: 'GBP', symbol: '£', label: 'GBP (British Pound - £)' },
  { value: 'SGD', symbol: 'S$', label: 'SGD (Singapore Dollar - S$)' },
  { value: 'AUD', symbol: 'A$', label: 'AUD (Australian Dollar - A$)' },
];

const MODULE_MAP = {
  'products': 'Product Management (Products)',
  'categories': 'Category Management (Categories)',
  'stock': 'Stock Movements (Stock)',
  'purchases': 'Purchase Orders (Purchases)',
  'sales': 'Sales & Invoicing (Sales)',
  'suppliers': 'Supplier Management (Suppliers)',
  'customers': 'Customer Management (Customers)',
  'reports': 'Analytics & Reports (Reports)',
  'notifications': 'System Notifications (Notifications)',
  'activity-logs': 'Activity Audit Logs (Activity Logs)',
  'users': 'User Accounts CRUD (Users)'
};

export default function Settings() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const { settings: globalSettings, saveSettings, loading: contextLoading } = useSettings();

  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: 'StockHive',
    company_email: 'support@stockhive.test',
    company_phone: '9000000001',
    currency: 'INR',
    currency_symbol: '₹',
    low_stock_threshold: 10,
    timezone: 'Asia/Kolkata',
    date_format: 'YYYY-MM-DD',
    enable_alerts: true,
    enable_email: false,
  });

  useEffect(() => {
    if (globalSettings) {
      setSettings(globalSettings);
    }
  }, [globalSettings]);

  const handleChange = (key, val) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: val };
      if (key === 'currency') {
        const found = CURRENCIES.find((c) => c.value === val);
        if (found) updated.currency_symbol = found.symbol;
      }
      return updated;
    });
  };

  const handlePermissionChange = (role, module, isChecked) => {
    setSettings((prev) => {
      const updatedPermissions = {
        ...prev.role_permissions,
        [role]: {
          ...prev.role_permissions?.[role],
          [module]: isChecked,
        },
      };
      return {
        ...prev,
        role_permissions: updatedPermissions,
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('System settings updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading) return <Loader />;

  const tabs = [
    { id: 'general', label: 'Company Profile', icon: 'bi-building', color: '#6366f1' },
    { id: 'localization', label: 'Localization', icon: 'bi-globe', color: '#0ea5e9' },
    { id: 'inventory', label: 'Stock Alerts', icon: 'bi-bell', color: '#f59e0b' },
    { id: 'security', label: 'Role Permissions', icon: 'bi-shield-check', color: '#10b981' },
  ];

  return (
    <>
      <style>{`
        .settings-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.03);
          padding: 28px;
        }
        .set-nav-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.03);
          padding: 12px;
        }
        .set-nav-item {
          width: 100%;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          color: #64748b;
          font-weight: 500;
          text-align: left;
          font-size: 0.94rem;
          transition: all 0.2s ease;
          margin-bottom: 4px;
        }
        .set-nav-item:last-child {
          margin-bottom: 0;
        }
        .set-nav-item:hover {
          background: #f8fafc;
          color: #0f172a;
        }
        .set-nav-item.active {
          background: #eef2ff;
          color: #4f46e5;
          font-weight: 600;
        }
        .set-nav-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          font-size: 1.1rem;
          background: #f1f5f9;
          transition: all 0.2s ease;
        }
        .set-nav-item.active .set-nav-icon {
          background: #4f46e5;
          color: #fff !important;
        }
        .set-label {
          font-weight: 600;
          color: #334155;
          font-size: 0.92rem;
          margin-bottom: 6px;
        }
        .readonly-alert {
          background-color: #fffbeb;
          border: 1px solid #fef3c7;
          border-radius: 12px;
          color: #b45309;
          padding: 14px 18px;
          font-size: 0.88rem;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
      `}</style>

      <PageHeader title="System Settings" subtitle="Configure global parameters & business rules" icon="bi-gear" />

      {!isAdmin && (
        <div className="readonly-alert">
          <i className="bi bi-exclamation-triangle-fill fs-5" />
          <span><strong>Read-only mode:</strong> Only administrators can edit settings. Current role: <strong>{hasRole('Manager') ? 'Manager' : 'Staff'}</strong>.</span>
        </div>
      )}

      <div className="row g-4">
        {/* Left Side Navigation */}
        <div className="col-lg-3">
          <div className="set-nav-card">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`set-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="set-nav-icon" style={{ color: activeTab === tab.id ? '#fff' : tab.color }}>
                  <i className={`bi ${tab.icon}`} />
                </div>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side Settings Form */}
        <div className="col-lg-9">
          <form onSubmit={handleSave} className="settings-card">
            {activeTab === 'general' && (
              <div>
                <h5 className="fw-bold mb-4" style={{ fontFamily: 'Outfit' }}>Company Profile</h5>
                <div className="row g-3">
                  <div className="col-md-12">
                    <label className="set-label">Company / Application Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.company_name}
                      required
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="set-label">Corporate Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={settings.company_email || ''}
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('company_email', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="set-label">Corporate Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.company_phone || ''}
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('company_phone', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="set-label">Default Currency</label>
                    <select
                      className="form-select"
                      value={settings.currency}
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('currency', e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="set-label">Currency Symbol Representation</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.currency_symbol}
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('currency_symbol', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'localization' && (
              <div>
                <h5 className="fw-bold mb-4" style={{ fontFamily: 'Outfit' }}>Localization</h5>
                <div className="row g-3">
                  <div className="col-md-12">
                    <label className="set-label">Default System Timezone</label>
                    <select
                      className="form-select"
                      value={settings.timezone}
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-12">
                    <label className="set-label">System Date Format Display</label>
                    <select
                      className="form-select"
                      disabled={!isAdmin}
                      value={settings.date_format || 'YYYY-MM-DD'}
                      onChange={(e) => handleChange('date_format', e.target.value)}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g., 2026-06-13)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g., 13/06/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (e.g., 06/13/2026)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div>
                <h5 className="fw-bold mb-4" style={{ fontFamily: 'Outfit' }}>Stock Alerts</h5>
                <div className="row g-3">
                  <div className="col-md-12">
                    <label className="set-label">Global Low Stock Reorder Threshold *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={settings.low_stock_threshold}
                      required
                      disabled={!isAdmin}
                      onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                    />
                    <small className="text-muted mt-1 d-block">Default limit to trigger low stock warnings when item count drops below this value.</small>
                  </div>
                  <div className="col-md-12 mt-4">
                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!settings.enable_alerts}
                        disabled={!isAdmin}
                        id="enableAlerts"
                        onChange={(e) => handleChange('enable_alerts', e.target.checked)}
                      />
                      <label className="form-check-label fw-medium text-slate" htmlFor="enableAlerts">Enable low stock dashboard notifications</label>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!settings.enable_email}
                        disabled={!isAdmin}
                        id="enableEmail"
                        onChange={(e) => handleChange('enable_email', e.target.checked)}
                      />
                      <label className="form-check-label fw-medium text-slate" htmlFor="enableEmail">Receive daily low stock summary email reports</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h5 className="fw-bold mb-4" style={{ fontFamily: 'Outfit' }}>Role-Based Access Rules</h5>
                <p className="text-muted mb-4 fs-9">Current overview of permissions assigned to system user roles.</p>
                <div className="table-responsive">
                  <table className="table align-middle border-0">
                    <thead>
                      <tr className="text-muted" style={{ fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' }}>
                        <th>MODULE / FEATURE</th>
                        <th className="text-center">STAFF</th>
                        <th className="text-center">MANAGER</th>
                        <th className="text-center">ADMIN</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontSize: '0.88rem' }}>
                      {Object.keys(MODULE_MAP).map((modKey) => {
                        const label = MODULE_MAP[modKey];
                        return (
                          <tr key={modKey} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td className="fw-semibold text-slate">{label}</td>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!settings.role_permissions?.Staff?.[modKey]}
                                disabled={!isAdmin}
                                onChange={(e) => handlePermissionChange('Staff', modKey, e.target.checked)}
                              />
                            </td>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!settings.role_permissions?.Manager?.[modKey]}
                                disabled={!isAdmin}
                                onChange={(e) => handlePermissionChange('Manager', modKey, e.target.checked)}
                              />
                            </td>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={true}
                                disabled={true}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <small className="text-muted mt-2 d-block">
                  <i className="bi bi-info-circle me-1" />
                  Note: The Dashboard (for both Manager and Staff) and the Logout button are always accessible by default.
                </small>
              </div>
            )}

            {isAdmin && (
              <div className="d-flex justify-content-end mt-4 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary px-4 py-2 fw-semibold"
                  style={{ borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderColor: 'transparent' }}
                >
                  {saving && <span className="spinner-border spinner-border-sm me-2" />}
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
