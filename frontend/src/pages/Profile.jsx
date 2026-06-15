import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api, { API_ORIGIN } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime } from '../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [me, setMe] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      const data = r.data.data;
      setMe(data);
      setName(data.name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
    }).catch(() => {});
  }, []);

  if (!me) return <Loader />;

  const initials = (me.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.warning('Name is required');
    if (!email.trim()) return toast.warning('Email is required');

    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { name, email, phone });
      const updatedProfile = data.data;
      setMe(updatedProfile);
      
      // Sync auth state
      const updatedUser = {
        ...user,
        name: updatedProfile.name,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
      };
      localStorage.setItem('sh_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(me.name || '');
    setEmail(me.email || '');
    setPhone(me.phone || '');
    setEditing(false);
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      return toast.error('Only image files are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast.error('Image must be under 2MB');
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const { data } = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedProfile = data.data;
      setMe(updatedProfile);
      
      // Sync auth state
      const updatedUser = {
        ...user,
        avatar: updatedProfile.avatar,
      };
      localStorage.setItem('sh_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success('Profile picture updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    
    setUploading(true);
    try {
      const { data } = await api.delete('/auth/avatar');
      const updatedProfile = data.data;
      setMe(updatedProfile);
      
      // Sync auth state
      const updatedUser = {
        ...user,
        avatar: updatedProfile.avatar,
      };
      localStorage.setItem('sh_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      toast.success('Profile picture removed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your account details and configurations" icon="bi-person" />
      
      <div className="row g-4">
        {/* Left card: Avatar & Role Summary */}
        <div className="col-lg-4">
          <div className="sh-card p-4 text-center h-100 d-flex flex-column align-items-center justify-content-center position-relative overflow-hidden">
            <div className="profile-card-glow" />
            
            <div className="avatar-upload-container mx-auto mb-3 position-relative" onClick={triggerFileSelect}>
              {uploading ? (
                <div className="avatar-circle d-flex align-items-center justify-content-center" style={{ width: 96, height: 96, borderRadius: '50%' }}>
                  <span className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true" />
                </div>
              ) : me.avatar ? (
                <img src={`${API_ORIGIN}/uploads/${me.avatar}`} alt="Avatar" className="avatar-circle" style={{ width: 96, height: 96, objectFit: 'cover' }} />
              ) : (
                <div className="avatar-circle" style={{ width: 96, height: 96, fontSize: '2.2rem', borderRadius: '50%' }}>
                  {initials}
                </div>
              )}
              <div className="avatar-upload-overlay">
                <i className="bi bi-camera-fill mb-1" style={{ fontSize: '1.2rem' }} />
                <span>Change</span>
              </div>
              {me.avatar && !uploading && (
                <button type="button" className="avatar-remove-btn" onClick={handleRemoveAvatar} title="Remove image">
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />

            <h4 className="fw-bold mb-1 text-dark">{me.name}</h4>
            <p className="text-muted mb-3">{me.email}</p>
            <span className="badge px-3 py-2 bg-light text-primary border border-primary-subtle rounded-pill fw-semibold">
              <i className="bi bi-shield-check me-1" /> {me.role || user?.role}
            </span>
          </div>
        </div>

        {/* Right card: Information / Edit Form */}
        <div className="col-lg-8">
          <div className="sh-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-light">
              <h5 className="fw-bold m-0 text-dark">
                <i className="bi bi-person-gear me-2 text-primary" />
                Account Information
              </h5>
              {!editing && (
                <button 
                  onClick={() => setEditing(true)} 
                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                  style={{ borderRadius: '8px' }}
                >
                  <i className="bi bi-pencil" /> Edit Profile
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-muted small">Full Name</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                        <i className="bi bi-person text-muted" />
                      </span>
                      <input 
                        type="text" 
                        className="form-control border-start-0 bg-light-focus" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                        style={{ borderRadius: '0 10px 10px 0' }}
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-muted small">Email Address</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                        <i className="bi bi-envelope text-muted" />
                      </span>
                      <input 
                        type="email" 
                        className="form-control border-start-0 bg-light-focus" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        style={{ borderRadius: '0 10px 10px 0' }}
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-muted small">Phone Number</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                        <i className="bi bi-telephone text-muted" />
                      </span>
                      <input 
                        type="text" 
                        className="form-control border-start-0 bg-light-focus" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        style={{ borderRadius: '0 10px 10px 0' }}
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-muted small">Role</label>
                    <input 
                      type="text" 
                      className="form-control bg-light text-muted border-0" 
                      value={me.role} 
                      disabled 
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top border-light">
                  <button 
                    type="button" 
                    onClick={handleCancel} 
                    className="btn btn-light" 
                    disabled={saving}
                    style={{ borderRadius: '8px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary d-inline-flex align-items-center gap-2" 
                    disabled={saving}
                    style={{ borderRadius: '8px' }}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="row g-4">
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Full Name</span>
                  <span className="fs-6 fw-semibold text-dark">{me.name}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Email</span>
                  <span className="fs-6 fw-semibold text-dark">{me.email}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Phone</span>
                  <span className="fs-6 fw-semibold text-dark">{me.phone || '—'}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Role</span>
                  <span className="fs-6 fw-semibold text-dark">{me.role}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Status</span>
                  <span className="badge bg-success px-2.5 py-1.5 rounded-pill fw-semibold">{me.status}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Last Login</span>
                  <span className="fs-6 text-dark">{fmtDateTime(me.last_login)}</span>
                </div>
                <div className="col-md-6">
                  <span className="d-block text-muted small fw-semibold text-uppercase tracking-wider">Member Since</span>
                  <span className="fs-6 text-dark">{fmtDateTime(me.created_at)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
