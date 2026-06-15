import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/Inventra/backend';

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
