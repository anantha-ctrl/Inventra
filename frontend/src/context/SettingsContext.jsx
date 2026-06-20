import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { setFormatSettings } from '../utils/format';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
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
    gstin: '',
    shop_address: '',
    shop_state: '',
    upi_id: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const r = await api.get('/settings');
      if (r.data.data) {
        const data = r.data.data;
        data.low_stock_threshold = parseInt(data.low_stock_threshold, 10) || 10;
        data.enable_alerts = data.enable_alerts !== undefined ? !!parseInt(data.enable_alerts, 10) : true;
        data.enable_email = data.enable_email !== undefined ? !!parseInt(data.enable_email, 10) : false;
        
        setSettings(data);
        setFormatSettings(data);

        if (data.company_name) {
          document.title = `${data.company_name} — Inventory Management`;
        }
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchSettings();
  }, [user, fetchSettings]);

  const saveSettings = useCallback(async (newSettings) => {
    const payload = {
      ...newSettings,
      enable_alerts: newSettings.enable_alerts ? 1 : 0,
      enable_email: newSettings.enable_email ? 1 : 0,
    };
    await api.put('/settings', payload);
    setSettings(newSettings);
    setFormatSettings(newSettings);
    if (newSettings.company_name) {
      document.title = `${newSettings.company_name} — Inventory Management`;
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, saveSettings, reloadSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
