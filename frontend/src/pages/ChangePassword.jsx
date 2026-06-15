import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';
import PageHeader from '../components/PageHeader';

export default function ChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Password changed successfully');
      setForm({ current_password: '', new_password: '', confirm: '' });
      setShowPassword({ current: false, new: false, confirm: false });
    } catch { /* handled */ } finally { setSaving(false); }
  };

  const toggleShow = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <>
      <PageHeader title="Change Password" subtitle="Update your account password securely" icon="bi-shield-lock" />
      
      <div className="row justify-content-center">
        <div className="col-lg-7 col-xl-6">
          <div className="sh-card p-4 p-md-5">
            <div className="text-center mb-5">
              <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle mb-3" style={{ width: '72px', height: '72px', fontSize: '1.8rem' }}>
                <i className="bi bi-key" />
              </div>
              <h4 className="fw-bold">Security Settings</h4>
              <p className="text-muted mb-0">Ensure your account is using a long, random password to stay secure.</p>
            </div>
            
            <form onSubmit={submit}>
              <div className="mb-4">
                <label className="form-label fw-medium">Current Password <span className="text-danger">*</span></label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light border-end-0 text-muted"><i className="bi bi-lock-fill" /></span>
                  <input 
                    type={showPassword.current ? "text" : "password"} 
                    className="form-control border-start-0 ps-0 bg-light-focus fs-6" 
                    placeholder="Enter current password"
                    value={form.current_password} required
                    onChange={(e) => setForm({ ...form, current_password: e.target.value })} 
                  />
                  <button type="button" className="input-group-text bg-light text-muted" onClick={() => toggleShow('current')}>
                    <i className={`bi ${showPassword.current ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-medium">New Password <span className="text-danger">*</span></label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light border-end-0 text-muted"><i className="bi bi-shield-lock-fill" /></span>
                  <input 
                    type={showPassword.new ? "text" : "password"} 
                    className="form-control border-start-0 ps-0 bg-light-focus fs-6" 
                    placeholder="Enter new password (min. 6 characters)"
                    value={form.new_password} required minLength={6}
                    onChange={(e) => setForm({ ...form, new_password: e.target.value })} 
                  />
                  <button type="button" className="input-group-text bg-light text-muted" onClick={() => toggleShow('new')}>
                    <i className={`bi ${showPassword.new ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-medium">Confirm New Password <span className="text-danger">*</span></label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light border-end-0 text-muted"><i className="bi bi-check-circle-fill" /></span>
                  <input 
                    type={showPassword.confirm ? "text" : "password"} 
                    className="form-control border-start-0 ps-0 bg-light-focus fs-6" 
                    placeholder="Confirm your new password"
                    value={form.confirm} required
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })} 
                  />
                  <button type="button" className="input-group-text bg-light text-muted" onClick={() => toggleShow('confirm')}>
                    <i className={`bi ${showPassword.confirm ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="d-grid mt-5 pt-2">
                <button className="btn btn-primary btn-lg fw-semibold" disabled={saving}>
                  {saving ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Updating...</>
                  ) : (
                    <><i className="bi bi-shield-check me-2" />Update Password</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
