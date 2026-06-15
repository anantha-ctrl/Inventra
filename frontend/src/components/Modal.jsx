export default function Modal({ show, onClose, title, children, footer, size = '' }) {
  if (!show) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className={`modal-dialog modal-dialog-centered ${size}`}>
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}

export function ConfirmModal({ show, onClose, onConfirm, title = 'Confirm', message, confirmText = 'Delete', danger = true, loading }) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading && <span className="spinner-border spinner-border-sm me-2" />}
            {confirmText}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
    </Modal>
  );
}
