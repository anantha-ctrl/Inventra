import axios from 'axios';
import { toast } from 'react-toastify';

// Resolve the backend URL so the app works both from localhost AND from another
// device on the LAN (e.g. a phone at http://192.168.1.15:5173).
//
// VITE_API_BASE (.env) defaults to http://localhost/Inventra/backend. That is
// correct on the dev machine, but on a phone "localhost" means the phone itself,
// so every API call (login, edit, save, delete) fails. To handle that, when the
// configured base points at localhost/127.0.0.1 but the page is actually being
// viewed from a different host, we swap in the current hostname (keeping the
// path). A non-localhost VITE_API_BASE (a real domain) is always used as-is.
const resolveApiBase = () => {
  const configured = import.meta.env.VITE_API_BASE;
  const here = typeof window !== 'undefined' ? window.location : null;

  if (configured) {
    if (here?.hostname) {
      try {
        const cfg = new URL(configured, here.origin);
        const cfgIsLocal = /^(localhost|127\.0\.0\.1)$/.test(cfg.hostname);
        const pageIsLocal = /^(localhost|127\.0\.0\.1)$/.test(here.hostname);
        // Page opened from a real host but base is hardwired to localhost →
        // rewrite to the host the user actually reached us on.
        if (cfgIsLocal && !pageIsLocal) {
          return `${here.protocol}//${here.hostname}${cfg.pathname}`.replace(/\/$/, '');
        }
      } catch { /* fall through to using configured as-is */ }
    }
    return configured;
  }

  if (here?.hostname) {
    return `${here.protocol}//${here.hostname}/Inventra/backend`;
  }
  return 'http://localhost/Inventra/backend';
};

const API_BASE = resolveApiBase();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sh_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || 'Request failed';
    if (status === 401) {
      // Token invalid/expired — force re-login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('sh_token');
        localStorage.removeItem('sh_user');
        window.location.href = '/login';
      }
    } else if (error.config?.skipErrorToast) {
      // Caller handles this error itself — stay silent.
    } else if (status === 422 && error.response?.data?.errors) {
      const first = Object.values(error.response.data.errors)[0];
      toast.error(Array.isArray(first) ? first[0] : msg);
    } else if (status !== 404) {
      toast.error(msg);
    }
    return Promise.reject(error);
  }
);

export const API_ORIGIN = API_BASE;
export default api;
