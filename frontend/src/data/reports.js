// Single source of truth for report types — used by the Reports page (card
// dashboard + detail table) and the Sidebar (expandable Reports submenu).
// `group` drives the dashboard sections; GROUP_ORDER controls their order.
export const GROUP_ORDER = [
  'Sales & Performance',
  'Tax & GST (Billing)',
  'Financial Statements',
  'Inventory & Stock',
  'Purchases & Partners',
];

export const REPORTS = [
  // ---- Sales & Performance ----
  { key: 'sales', label: 'Sales Report', icon: 'bi-receipt', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: true, group: 'Sales & Performance', desc: 'Revenue & sales data' },
  { key: 'sales_summary', label: 'Sales Summary', icon: 'bi-calendar3', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: true, group: 'Sales & Performance', desc: 'Date-wise totals & avg bill' },
  { key: 'profit', label: 'Profit Analysis', icon: 'bi-graph-up-arrow', color: '#ef4444', bg: 'linear-gradient(135deg,#ef4444,#f87171)', dated: true, group: 'Sales & Performance', desc: 'Per-product profit margin' },
  { key: 'payments', label: 'Payment Mode Report', icon: 'bi-credit-card-2-front', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: true, group: 'Sales & Performance', desc: 'Cash / UPI / Card collections' },
  { key: 'cashier', label: 'Cashier / Salesperson', icon: 'bi-person-badge', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: true, group: 'Sales & Performance', desc: 'Sales by staff member' },

  // ---- Tax & GST (Billing) ----
  { key: 'gst', label: 'GST / Tax Report', icon: 'bi-percent', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: true, group: 'Tax & GST (Billing)', desc: 'Slab-wise CGST/SGST + B2B/B2C' },
  { key: 'hsn', label: 'HSN Summary', icon: 'bi-upc', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: true, group: 'Tax & GST (Billing)', desc: 'HSN/SAC-wise tax breakdown' },

  // ---- Financial Statements ----
  { key: 'pnl', label: 'Profit & Loss', icon: 'bi-journal-text', color: '#8b5cf6', bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', dated: true, group: 'Financial Statements', desc: 'Sales − COGS − expenses' },
  { key: 'expense', label: 'Expense Report', icon: 'bi-wallet2', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: true, group: 'Financial Statements', desc: 'Category-wise expenses' },
  { key: 'dues', label: 'Outstanding Dues', icon: 'bi-cash-stack', color: '#ef4444', bg: 'linear-gradient(135deg,#ef4444,#f87171)', dated: false, group: 'Financial Statements', desc: 'Receivables + ageing' },
  { key: 'customer_ledger', label: 'Customer Ledger', icon: 'bi-journal-bookmark', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: false, group: 'Financial Statements', desc: 'Billed / paid / balance' },

  // ---- Inventory & Stock ----
  { key: 'product', label: 'Product Report', icon: 'bi-box-seam', color: '#6366f1', bg: 'linear-gradient(135deg,#6366f1,#818cf8)', dated: false, group: 'Inventory & Stock', desc: 'Complete product catalog' },
  { key: 'inventory', label: 'Inventory Report', icon: 'bi-clipboard-data', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: false, group: 'Inventory & Stock', desc: 'Current stock levels' },
  { key: 'stock_valuation', label: 'Stock Valuation', icon: 'bi-cash-coin', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: false, group: 'Inventory & Stock', desc: 'Cost & sell value + margin' },
  { key: 'low_stock', label: 'Low Stock / Reorder', icon: 'bi-exclamation-triangle', color: '#f59e0b', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', dated: false, group: 'Inventory & Stock', desc: 'Items to reorder' },
  { key: 'dead_stock', label: 'Dead / Slow Stock', icon: 'bi-hourglass-split', color: '#64748b', bg: 'linear-gradient(135deg,#64748b,#94a3b8)', dated: true, group: 'Inventory & Stock', desc: 'Unsold capital locked' },
  { key: 'stock_ledger', label: 'Stock Movement Ledger', icon: 'bi-arrow-left-right', color: '#0ea5e9', bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', dated: true, group: 'Inventory & Stock', desc: 'In / out / adjustments' },

  // ---- Purchases & Partners ----
  { key: 'purchase', label: 'Purchase Report', icon: 'bi-cart-plus', color: '#10b981', bg: 'linear-gradient(135deg,#10b981,#34d399)', dated: true, group: 'Purchases & Partners', desc: 'Purchase transactions' },
  { key: 'supplier', label: 'Supplier Report', icon: 'bi-truck', color: '#8b5cf6', bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', dated: false, group: 'Purchases & Partners', desc: 'Supplier directory' },
  { key: 'customer', label: 'Customer Report', icon: 'bi-people', color: '#ec4899', bg: 'linear-gradient(135deg,#ec4899,#f472b6)', dated: false, group: 'Purchases & Partners', desc: 'Customer analytics' },
];

// Small icon shown beside each dashboard group heading.
export const GROUP_ICONS = {
  'Sales & Performance': 'bi-graph-up',
  'Tax & GST (Billing)': 'bi-percent',
  'Financial Statements': 'bi-bank',
  'Inventory & Stock': 'bi-boxes',
  'Purchases & Partners': 'bi-truck',
};
