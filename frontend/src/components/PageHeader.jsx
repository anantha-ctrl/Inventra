export default function PageHeader({ title, subtitle, icon, children }) {
  return (
    <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
      <div>
        <h1 className="page-title">
          {icon && <i className={`bi ${icon} text-primary me-2`} />}
          {title}
        </h1>
        {subtitle && <small className="text-muted">{subtitle}</small>}
      </div>
      <div className="d-flex gap-2">{children}</div>
    </div>
  );
}
