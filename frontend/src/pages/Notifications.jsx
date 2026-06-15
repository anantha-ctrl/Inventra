import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { fmtDateTime } from '../utils/format';

const meta = {
  low_stock: { icon: 'bi-exclamation-triangle', color: 'warning' },
  out_of_stock: { icon: 'bi-x-octagon', color: 'danger' },
  purchase_approval: { icon: 'bi-cart-check', color: 'info' },
  info: { icon: 'bi-info-circle', color: 'secondary' },
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/notifications', { params: { per_page: 50 } })
      .then((r) => setItems(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setItems((it) => it.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };
  const markAll = async () => {
    await api.put('/notifications/read-all');
    toast.success('All marked as read');
    load();
  };
  const remove = async (id) => {
    await api.delete(`/notifications/${id}`);
    setItems((it) => it.filter((n) => n.id !== id));
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Alerts & system messages" icon="bi-bell">
        <button className="btn btn-outline-primary" onClick={markAll}><i className="bi bi-check2-all me-1" />Mark all read</button>
      </PageHeader>

      <div className="sh-card p-2">
        {loading ? <Loader /> : items.length === 0 ? (
          <p className="text-center text-muted py-5"><i className="bi bi-bell-slash display-5 d-block mb-2" />No notifications</p>
        ) : (
          <ul className="list-group list-group-flush">
            {items.map((n) => {
              const m = meta[n.type] || meta.info;
              return (
                <li key={n.id} className={`list-group-item d-flex align-items-center gap-3 ${n.is_read ? '' : 'bg-light'}`}>
                  <i className={`bi ${m.icon} fs-4 text-${m.color}`} />
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{n.title} {!n.is_read && <span className="badge bg-primary ms-1">new</span>}</div>
                    <div className="text-muted small">{n.message}</div>
                    <small className="text-muted">{fmtDateTime(n.created_at)}</small>
                  </div>
                  {!n.is_read && <button className="btn btn-sm btn-outline-secondary" onClick={() => markRead(n.id)}><i className="bi bi-check" /></button>}
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(n.id)}><i className="bi bi-trash" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
