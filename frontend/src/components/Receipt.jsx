import { money, fmtDateTime } from '../utils/format';

/**
 * Thermal GST receipt (58mm / 80mm). Renders into #thermal-receipt so the
 * print stylesheet can isolate it. CGST/SGST are split 50/50 (intra-state).
 */
export default function Receipt({ sale, settings = {}, width = '80' }) {
  if (!sale) return null;
  const tax = +sale.tax || 0;
  const cgst = +(tax / 2).toFixed(2);
  const sgst = +(tax / 2).toFixed(2);
  const paid = +sale.paid_amount || 0;
  const total = +sale.total_amount || 0;
  const due = +(total - paid).toFixed(2);
  const payments = sale.payments || [];

  return (
    <div id="thermal-receipt" className={`thermal thermal-${width}`}>
      <div className="t-center">
        <div className="t-shop">{settings.company_name || 'StockHive'}</div>
        {settings.shop_address && <div className="t-sm">{settings.shop_address}</div>}
        <div className="t-sm">
          {settings.company_phone ? `Ph: ${settings.company_phone}` : ''}
          {settings.shop_state ? ` · ${settings.shop_state}` : ''}
        </div>
        {settings.gstin && <div className="t-sm">GSTIN: {settings.gstin}</div>}
        <div className="t-title">TAX INVOICE</div>
      </div>

      <div className="t-row t-sm">
        <span>{sale.invoice_no}</span>
        <span>{fmtDateTime(sale.created_at || sale.sale_date)}</span>
      </div>
      <div className="t-sm">Customer: {sale.customer_name || 'Walk-in'}{sale.customer_phone ? ` (${sale.customer_phone})` : ''}</div>

      <div className="t-hr" />
      <table className="t-table">
        <thead>
          <tr><th className="t-l">Item</th><th>Qty</th><th>Rate</th><th className="t-r">Amt</th></tr>
        </thead>
        <tbody>
          {sale.items?.map((it) => (
            <tr key={it.id ?? it.product_id}>
              <td className="t-l">
                {it.product_name}
                {it.hsn_code ? <div className="t-xs">HSN: {it.hsn_code}</div> : null}
              </td>
              <td>{it.quantity}</td>
              <td>{(+it.unit_price).toFixed(2)}</td>
              <td className="t-r">{(+it.subtotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="t-hr" />

      <div className="t-row"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
      {+sale.discount > 0 && <div className="t-row"><span>Discount</span><span>- {money(sale.discount)}</span></div>}
      {tax > 0 && (
        <>
          <div className="t-row t-sm"><span>CGST</span><span>{money(cgst)}</span></div>
          <div className="t-row t-sm"><span>SGST</span><span>{money(sgst)}</span></div>
        </>
      )}
      <div className="t-hr" />
      <div className="t-row t-total"><span>TOTAL</span><span>{money(total)}</span></div>

      {payments.length > 0 && (
        <>
          <div className="t-hr" />
          {payments.map((p, i) => (
            <div className="t-row t-sm" key={i}><span>{p.mode?.toUpperCase()}</span><span>{money(p.amount)}</span></div>
          ))}
        </>
      )}
      {due > 0 && <div className="t-row"><span>Balance Due</span><span>{money(due)}</span></div>}

      <div className="t-hr" />
      <div className="t-center t-sm">Thank you! Visit again 🙏</div>
      <div className="t-center t-xs">Powered by Inventra</div>
    </div>
  );
}
