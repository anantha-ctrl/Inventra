export default function Loader({ text = 'Loading…', small = false }) {
  return (
    <div className={`d-flex align-items-center justify-content-center text-muted ${small ? 'py-3' : 'py-5'}`}>
      <div className="spinner-border text-primary me-2" style={{ width: '1.4rem', height: '1.4rem' }} role="status" />
      <span>{text}</span>
    </div>
  );
}
