import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AccessDenied() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 140px)', padding: '24px' }}>
      <style>{`
        @keyframes pulse-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(239, 68, 68, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            transform: scale(1);
          }
        }
        @keyframes float-key {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .ad-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08);
          max-width: 480px;
          width: 100%;
          text-align: center;
          padding: 40px 32px;
          transition: all 0.3s ease;
        }
        .ad-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.12);
        }
        .ad-icon-wrap {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
          position: relative;
          animation: pulse-glow 2.5s infinite;
        }
        .ad-icon-inner {
          color: #ef4444;
          font-size: 2.5rem;
          animation: float-key 3s ease-in-out infinite;
        }
        .ad-role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 0.82rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }
        .ad-role-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
        }
      `}</style>
      <div className="ad-card">
        <div className="ad-icon-wrap">
          <i className="bi bi-shield-lock ad-icon-inner" />
        </div>
        <h3 className="mb-2 fw-bold" style={{ letterSpacing: '-0.02em', fontSize: '1.75rem' }}>Access Denied</h3>
        <p className="text-muted mb-4" style={{ fontSize: '0.98rem', lineHeight: '1.6' }}>
          You do not have the required permissions to access this page. Please contact your administrator if you think this is a mistake.
        </p>

        <div className="ad-role-badge">
          <span className="ad-role-dot" />
          <span>Current Role: <strong>{user?.role || 'Guest'}</strong></span>
        </div>

        <div className="d-flex flex-column gap-2">
          <Link to="/dashboard" className="btn btn-primary py-2.5 fw-semibold shadow-sm w-100" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderColor: 'transparent' }}>
            <i className="bi bi-house-door-fill me-2" /> Back to Dashboard
          </Link>
          <button onClick={() => navigate(-1)} className="btn btn-light py-2.5 fw-semibold w-100" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', color: '#475569' }}>
            <i className="bi bi-arrow-left me-2" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
