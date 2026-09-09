import React, { useState } from 'react';
import { LogOut, Bell, Shield, Edit2, HelpCircle, X, Mail, PhoneCall } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
export default function AdminSettings({ currentUser, handleLogout }) {
  const [pushNotes, setPushNotes] = useState(() => {
    return localStorage.getItem('admin_push_notifications') !== 'false';
  });
  
  const handleTogglePush = () => {
    const newState = !pushNotes;
    setPushNotes(newState);
    localStorage.setItem('admin_push_notifications', newState.toString());
    if (newState && window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

// ... Inside AdminSettings component, add handleRegisterBiometrics:
  const handleRegisterBiometrics = async () => {
    try {
      const resp = await fetch('https://gcr-9ys1.onrender.com/api/auth/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      const options = await resp.json();

      if (options.error) throw new Error(options.error);

      // Start WebAuthn Registration
      const attResp = await startRegistration(options);

      const verifyResp = await fetch('https://gcr-9ys1.onrender.com/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, response: attResp })
      });

      const verificationJSON = await verifyResp.json();
      if (verificationJSON.success) {
        toast.success('Biometrics / Passkey registered successfully!');
      } else {
        toast.error('Failed to verify biometrics');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error registering biometrics. Make sure your browser supports passkeys.');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/users/${currentUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (res.ok) {
        toast.success('Password updated successfully!');
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error('Failed to update password');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/users/${currentUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone })
      });
      
      if (res.ok) {
        const updatedUser = await res.json();
        toast.success('Profile updated successfully!');
        
        // Update local storage so it persists on refresh
        const storedUser = JSON.parse(localStorage.getItem('sbi_valuation_current_user_v3') || '{}');
        localStorage.setItem('sbi_valuation_current_user_v3', JSON.stringify({ ...storedUser, name: editName, phone: editPhone }));
        
        setShowEditProfileModal(false);
        // We will just do a quick soft reload to reflect changes across the app
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* ... previous JSX up to Security section ... */}
      <div className="admin-profile-card">
        <div className="admin-profile-header"></div>
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Admin User")}&background=0346c8&color=ffffff`} alt="Profile" className="admin-profile-avatar" />
        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>{currentUser?.name || "Admin User"}</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>Senior Admin {currentUser?.phone ? `• ${currentUser.phone}` : ''}</p>
        <div style={{ padding: '0 24px' }}>
          <button 
            onClick={() => setShowEditProfileModal(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0346c8', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
          >
            <Edit2 size={14} /> Edit Profile
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '24px 0 16px' }}>Settings</h2>

      <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '16px', borderBottom: '1px solid #f1f5f9' }}>
          <Bell size={18} color="#0346c8" /> Notifications
        </div>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>System Push Notifications</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>Real-time alerts for incoming chats and updates.</div>
          </div>
          <div className={`admin-toggle ${pushNotes ? 'active' : ''}`} onClick={handleTogglePush}>
            <div className="admin-toggle-knob"></div>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '16px', borderBottom: '1px solid #f1f5f9' }}>
          <Shield size={18} color="#b45309" /> Security
        </div>
        
        {/* NEW BIOMETRIC BUTTON */}
        <div 
          onClick={handleRegisterBiometrics}
          style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff' }}
        >
          <div style={{ flex: 1, paddingRight: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Register Biometrics (Passkey)
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Setup Face ID or Fingerprint for instant login.</div>
          </div>
          <div style={{ color: '#0346c8', fontSize: '12px', fontWeight: '700' }}>Setup</div>
        </div>

        <div 
          onClick={() => setShowPasswordModal(true)}
          style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ flex: 1, paddingRight: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>Password</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Change your login password.</div>
          </div>
          <div style={{ color: '#0346c8', fontSize: '12px', fontWeight: '700' }}>Update</div>
        </div>
      </div>

      <div className="admin-card" style={{ padding: '0', overflow: 'hidden', marginTop: '16px' }}>
        <div 
          onClick={() => setShowHelpModal(true)}
          style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={18} color="#4338ca" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>Help & Support</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Get help with Admin Portal</div>
            </div>
          </div>
          <div style={{ color: '#64748b' }}>›</div>
        </div>
      </div>

      <button onClick={handleLogout} style={{ width: '100%', background: '#fff', border: '1px solid #ef4444', color: '#ef4444', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
        <LogOut size={16} /> Sign Out
      </button>

      <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>App Version 3.1.0</div>
        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Developed by MSTechHive</div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div 
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setShowHelpModal(false)}
          />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', animation: 'slideUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Help & Support</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0' }}>Admin Quick Guide</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Q: How do I track Staff?</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>A: Go to the Staff tab to see real-time locations and live clock-in history.</div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Q: How do I chat with Staff?</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>A: Go to the Chat tab and select an online engineer.</div>
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a8a', margin: '0 0 12px 0' }}>Contact MSTechHive</h4>
              
              <a href="mailto:support@mstechhive.com" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fff', borderRadius: '12px', textDecoration: 'none', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={16} color="#2563eb" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Email Support</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>support@mstechhive.com</div>
                </div>
              </a>

              <a href="tel:+919701800140" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fff', borderRadius: '12px', textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PhoneCall size={16} color="#16a34a" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Call Us</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>+91 9701800140</div>
                </div>
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div 
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setShowPasswordModal(false)}
          />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', animation: 'slideUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>New Password</label>
              <input 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Enter new password"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Confirm New Password</label>
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Re-enter new password"
              />
            </div>

            <button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword}
              style={{ width: '100%', background: '#0346c8', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: isUpdatingPassword ? 'not-allowed' : 'pointer', opacity: isUpdatingPassword ? 0.7 : 1 }}
            >
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div 
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setShowEditProfileModal(false)}
          />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', animation: 'slideUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Edit Profile</h3>
              <button onClick={() => setShowEditProfileModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Full Name</label>
              <input 
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Enter your full name"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Phone Number</label>
              <input 
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Enter phone number"
              />
            </div>

            <button 
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              style={{ width: '100%', background: '#0346c8', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', opacity: isUpdatingProfile ? 0.7 : 1 }}
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
