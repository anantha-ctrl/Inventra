import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Reusable barcode entry.
 *  - USB/handheld scanners act as keyboards: they type the code then press Enter,
 *    which the text input captures automatically (just keep it focused).
 *  - The camera button opens a live scanner overlay (phones / webcams).
 *
 * Props:
 *   onScan(code)  — fired with the trimmed code on Enter or a camera read.
 *   placeholder, autoFocus, compact
 */
const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export default function BarcodeScanner({ onScan, placeholder = 'Scan or type barcode / SKU…', autoFocus = false, compact = false }) {
  const [code, setCode] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState('');
  const inputRef = useRef(null);
  const scannerRef = useRef(null);

  const submit = (value) => {
    const v = (value ?? code).trim();
    if (!v) return;
    onScan(v);
    setCode('');
    inputRef.current?.focus();
  };

  // ----- Camera lifecycle -----
  useEffect(() => {
    if (!camOpen) return;
    let cancelled = false;
    const regionId = 'bc-cam-region';
    const scanner = new Html5Qrcode(regionId, { formatsToSupport: SCAN_FORMATS, verbose: false });
    scannerRef.current = scanner;

    const stop = () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => {
          if (cancelled) return;
          // Beep + close on a successful read.
          try { navigator.vibrate?.(80); } catch { /* noop */ }
          stop();
          if (!cancelled) { setCamOpen(false); submit(decoded); }
        },
        () => { /* per-frame decode failures are normal; ignore */ }
      )
      .catch((err) => { if (!cancelled) setCamError(err?.message || 'Unable to access camera'); });

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen]);

  return (
    <>
      <div className="input-group">
        <span className="input-group-text"><i className="bi bi-upc-scan" /></span>
        <input
          ref={inputRef}
          className="form-control"
          placeholder={placeholder}
          value={code}
          autoFocus={autoFocus}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
        {!compact && code && (
          <button type="button" className="btn btn-outline-primary" onClick={() => submit()} title="Add">
            <i className="bi bi-plus-lg" />
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary" onClick={() => { setCamError(''); setCamOpen(true); }} title="Scan with camera">
          <i className="bi bi-camera" />
        </button>
      </div>

      {camOpen && (
        <div className="bc-cam-overlay" onClick={() => setCamOpen(false)}>
          <div className="bc-cam-box" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0"><i className="bi bi-camera-video me-2" />Point camera at the barcode</h6>
              <button className="btn btn-sm btn-light" onClick={() => setCamOpen(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <div id="bc-cam-region" className="bc-cam-region" />
            {camError && <div className="alert alert-danger mt-2 mb-0 py-2 small">{camError}</div>}
            <p className="text-muted small mt-2 mb-0">Tip: handheld USB scanners work without the camera — just scan into the box above.</p>
          </div>
        </div>
      )}
    </>
  );
}
