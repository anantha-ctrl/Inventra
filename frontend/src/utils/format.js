let activeCurrencySymbol = '₹';
let activeDateFormat = 'YYYY-MM-DD';

export const setFormatSettings = (settings) => {
  if (settings.currency_symbol) activeCurrencySymbol = settings.currency_symbol;
  if (settings.date_format) activeDateFormat = settings.date_format;
};

export const money = (n) =>
  activeCurrencySymbol + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d.replace(' ', 'T'));
  if (isNaN(date)) return d;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (activeDateFormat === 'DD/MM/YYYY') {
    return `${dd}/${mm}/${yyyy}`;
  } else if (activeDateFormat === 'MM/DD/YYYY') {
    return `${mm}/${dd}/${yyyy}`;
  }
  return `${yyyy}-${mm}-${dd}`;
};

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d.replace(' ', 'T'));
  if (isNaN(date)) return d;

  const formattedDate = fmtDate(d);
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${formattedDate} ${hh}:${min}`;
};

export const statusBadge = (status) => {
  const map = {
    active: 'success', inactive: 'secondary',
    pending: 'warning', approved: 'info', received: 'success', cancelled: 'danger',
    paid: 'success', partial: 'warning', unpaid: 'danger',
  };
  return map[status] || 'secondary';
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
