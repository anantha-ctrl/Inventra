import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import Modal from './Modal';
import { money } from '../utils/format';

/**
 * Printable barcode stickers for a product. Renders `count` copies of a label
 * (shop name + product + price + scannable barcode) and prints just the sheet.
 */
export default function BarcodeLabels({ product, shopName = '', onClose }) {
  const [count, setCount] = useState(12);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!product) return;
    const code = product.barcode || product.sku || '';
    requestAnimationFrame(() => {
      sheetRef.current?.querySelectorAll('svg.bc-svg').forEach((svg) => {
        try {
          JsBarcode(svg, code, { format: code.length === 13 ? 'EAN13' : 'CODE128', width: 1.5, height: 38, fontSize: 12, margin: 2 });
        } catch {
          try { JsBarcode(svg, code, { format: 'CODE128', width: 1.5, height: 38, fontSize: 12, margin: 2 }); } catch { /* noop */ }
        }
      });
    });
  }, [product, count]);

  const printLabels = () => {
    const html = sheetRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<html><head><title>Labels</title><style>
      body{margin:0;font-family:Arial,sans-serif;}
      .bc-sheet{display:flex;flex-wrap:wrap;gap:6px;padding:8px;}
      .bc-label{width:160px;border:1px dashed #bbb;border-radius:6px;padding:6px;text-align:center;}
      .bc-shop{font-size:10px;font-weight:700;}
      .bc-name{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .bc-price{font-size:13px;font-weight:800;}
      svg{max-width:100%;}
      @media print{.bc-label{border:1px dashed #ddd;}}
    </style></head><body><div class="bc-sheet">${html}</div></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  if (!product) return null;
  return (
    <Modal show={!!product} onClose={onClose} title={`Barcode Labels — ${product.name}`} size="modal-lg"
      footer={<>
        <div className="me-auto d-flex align-items-center gap-2">
          <label className="form-label mb-0">Copies</label>
          <input type="number" min="1" max="100" className="form-control form-control-sm" style={{ width: 90 }}
            value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, +e.target.value || 1)))} />
        </div>
        <button className="btn btn-light" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={printLabels}><i className="bi bi-printer me-1" />Print Labels</button>
      </>}>
      <div ref={sheetRef} className="bc-sheet" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div className="bc-label" key={i} style={{ width: 160, border: '1px dashed #bbb', borderRadius: 6, padding: 6, textAlign: 'center' }}>
            {shopName && <div className="bc-shop" style={{ fontSize: 10, fontWeight: 700 }}>{shopName}</div>}
            <div className="bc-name" style={{ fontSize: 11, fontWeight: 600 }}>{product.name}</div>
            <svg className="bc-svg" />
            <div className="bc-price" style={{ fontSize: 13, fontWeight: 800 }}>{money(product.selling_price)}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
