import { useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { fmtDateTime } from '../utils/format';

const actionColor = (a) => ({
  login: 'success', logout: 'secondary', create: 'primary', update: 'info',
  delete: 'danger', approve: 'success', stock: 'warning', export: 'dark',
}[a] || 'secondary');

export default function ActivityLogs() {
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');

  const columns = [
    { key: 'created_at', label: 'When', render: (r) => fmtDateTime(r.created_at) },
    { key: 'user_name', label: 'User', render: (r) => r.user_name || 'System' },
    { key: 'action', label: 'Action', render: (r) => <span className={`badge bg-${actionColor(r.action)}`}>{r.action}</span> },
    { key: 'module', label: 'Module', render: (r) => <span className="badge bg-light text-dark">{r.module}</span> },
    { key: 'description', label: 'Description' },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address || '—' },
  ];

  const filters = (
    <>
      <select className="form-select w-auto" value={module} onChange={(e) => setModule(e.target.value)}>
        <option value="">All modules</option>
        {['auth', 'product', 'category', 'supplier', 'customer', 'purchase', 'sale', 'inventory', 'user', 'report'].map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select className="form-select w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All actions</option>
        {['login', 'logout', 'create', 'update', 'delete', 'approve', 'stock', 'export'].map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </>
  );

  return (
    <>
      <PageHeader title="Activity Logs" subtitle="Audit trail of all system activity" icon="bi-clock-history" />
      <DataTable endpoint="/activity-logs" columns={columns} filters={filters} query={{ module, action }} perPage={15} />
    </>
  );
}
