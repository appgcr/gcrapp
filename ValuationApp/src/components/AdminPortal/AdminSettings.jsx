import { API_BASE_URL } from '../../config/api';
import React, { useState } from 'react';
import { Bell, HelpCircle, X, Mail, Phone, ChevronRight, ChevronLeft, Clock, BarChart3, Fingerprint, KeyRound, Landmark, FileImage } from 'lucide-react';
import LetterheadSettings from '../Shared/LetterheadSettings';
import BanksSettings from './BanksSettings';
import pkg from '../../../package.json';
import { isSuperAdmin, roleLabel } from '../../utils/session';
import IconTile, { AssistiveGlyph } from '../Shared/IconTile';
import ReminderSettingsCard from './ReminderSettingsCard';
import NotificationPrefsCard from '../Shared/NotificationPrefsCard';
import NotificationInsightsCard from './NotificationInsightsCard';
import { Row, Switch, IosSettingsStyles } from '../Shared/IosSettings';
import { authHeaders } from '../Shared/authHeaders';
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

  const [showWhatsappFloat, setShowWhatsappFloat] = useState(() => {
    return localStorage.getItem('gcr_whatsapp_float_enabled') !== 'false';
  });

  const handleToggleWhatsapp = () => {
    const newState = !showWhatsappFloat;
    setShowWhatsappFloat(newState);
    localStorage.setItem('gcr_whatsapp_float_enabled', newState.toString());
    window.dispatchEvent(new CustomEvent('gcr_whatsapp_toggle', { detail: newState }));
    toast.success(newState ? 'Assistive Touch button turned ON' : 'Assistive Touch button turned OFF');
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
      const resp = await fetch(`${API_BASE_URL}/api/auth/webauthn/register-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      const options = await resp.json();

      if (options.error) throw new Error(options.error);

      // Start WebAuthn Registration
      const attResp = await startRegistration(options);

      const verifyResp = await fetch(`${API_BASE_URL}/api/auth/webauthn/register-verify`, {
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
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.username}`, {
        method: 'PUT',
        headers: authHeaders(),
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
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.username}`, {
        method: 'PUT',
        headers: authHeaders(),
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

  // iOS Settings navigation: main list → detail pages
  const [page, setPage] = useState('main'); // 'main' | 'notifications' | 'reminders' | 'insights'
  const open = (p) => { setPage(p); document.querySelector('.admin-main-content')?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); };

  const name = currentUser?.name || 'Admin User';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'A';

  const titles = { notifications: 'Notifications', reminders: 'Automatic Reminders', insights: 'Alert Insights', banks: 'Banks', letterhead: 'Letterhead & Valuer' };

  if (page !== 'main') {
    return (
      <div className="ios-settings ios-subpage" key={page}>
        <button type="button" className="ios-back" onClick={() => setPage('main')}>
          <ChevronLeft size={22} strokeWidth={2.4} /> Settings
        </button>
        <h1 className="ios-large-title">{titles[page]}</h1>

        {page === 'notifications' && (
          <>
            <div className="ios-group">
              <div className="ios-row">
                <IconTile icon={Bell} color="red" size={30} />
                <span className="ios-row-label">Browser notifications</span>
                <Switch on={pushNotes} onChange={handleTogglePush} label="Browser notifications" />
              </div>
            </div>
            <p className="ios-footnote">Shows alerts on this computer's desktop while the portal is open.</p>
            <NotificationPrefsCard currentUser={currentUser} />
          </>
        )}
        {page === 'reminders' && <ReminderSettingsCard currentUser={currentUser} embedded />}
        {page === 'insights' && <NotificationInsightsCard currentUser={currentUser} />}
        {page === 'banks' && <BanksSettings />}
        {page === 'letterhead' && <LetterheadSettings branchId={currentUser?.branchId} branchName={currentUser?.branchInfo?.name} />}
        <IosSettingsStyles />
      </div>
    );
  }

  return (
    <div className="ios-settings animate-fade-in">
      {/* Profile (like the Apple ID row) */}
      <div className="ios-group">
        <button type="button" className="ios-row ios-profile is-link" onClick={() => setShowEditProfileModal(true)}>
          <span className="ios-avatar" aria-hidden="true">{initials}</span>
          <span className="ios-profile-text">
            <span className="ios-profile-name">{name}</span>
            <span className="ios-profile-sub">{roleLabel(currentUser)}{currentUser?.branchInfo ? ` · ${currentUser.branchInfo.name}` : ''}{currentUser?.phone ? ` · ${currentUser.phone}` : ''}</span>
          </span>
          <ChevronRight size={18} className="ios-chev" aria-hidden="true" />
        </button>
      </div>

      {isSuperAdmin(currentUser) && (
        <>
          <div className="ios-section">Organisation</div>
          <div className="ios-group">
            <Row icon={Landmark} color="blue" label="Banks" onClick={() => open('banks')} />
          </div>
          <p className="ios-footnote">Add or rename banks and set each bank’s report format and valuation percentages.</p>
        </>
      )}

      {!isSuperAdmin(currentUser) && currentUser?.branchId && (
        <>
          <div className="ios-section">Reports</div>
          <div className="ios-group">
            <Row icon={FileImage} color="indigo" label="Letterhead & Valuer" onClick={() => open('letterhead')} />
          </div>
          <p className="ios-footnote">Upload your branch letterhead once — every bank report from your branch uses it.</p>
        </>
      )}

      <div className="ios-section">Notifications</div>
      <div className="ios-group">
        <Row icon={Bell} color="red" label="Notifications" onClick={() => open('notifications')} />
        {/* Company-wide alert rules are set by the Super Admin */}
        {isSuperAdmin(currentUser) && <Row icon={Clock} color="purple" label="Automatic Reminders" onClick={() => open('reminders')} />}
        {isSuperAdmin(currentUser) && <Row icon={BarChart3} color="indigo" label="Alert Insights" onClick={() => open('insights')} />}
      </div>

      <div className="ios-section">General</div>
      <div className="ios-group">
        <div className="ios-row">
          <IconTile glyph={<AssistiveGlyph size={18} />} color="graphite" size={30} />
          <span className="ios-row-label">Assistive Touch</span>
          <Switch on={showWhatsappFloat} onChange={handleToggleWhatsapp} label="Assistive Touch" />
        </div>
      </div>
      <p className="ios-footnote">A floating button for Messages and quick actions, like on iPhone.</p>

      <div className="ios-section">Security</div>
      <div className="ios-group">
        <Row icon={Fingerprint} color="green" label="Face ID & Passkey" value="Set up" onClick={handleRegisterBiometrics} />
        <Row icon={KeyRound} color="gray" label="Change Password" onClick={() => setShowPasswordModal(true)} />
      </div>

      <div className="ios-section">Support</div>
      <div className="ios-group">
        <Row icon={HelpCircle} color="blue" label="Help & Support" onClick={() => setShowHelpModal(true)} />
      </div>

      <div className="ios-group ios-group-gap">
        <button type="button" className="ios-row ios-signout" onClick={handleLogout}>Sign Out</button>
      </div>

      <div className="ios-version">
        GCR Valuation · Version {pkg.version}<br />Developed by MSTechHive
      </div>

      <IosSettingsStyles />

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
                <IconTile icon={Mail} color="blue" size={36} />
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Email Support</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>support@mstechhive.com</div>
                </div>
              </a>

              <a href="tel:+919701800140" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fff', borderRadius: '12px', textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <IconTile icon={Phone} color="green" size={36} />
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
              style={{ width: '100%', background: 'var(--gcr-accent)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: isUpdatingPassword ? 'not-allowed' : 'pointer', opacity: isUpdatingPassword ? 0.7 : 1 }}
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
              style={{ width: '100%', background: 'var(--gcr-accent)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', opacity: isUpdatingProfile ? 0.7 : 1 }}
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
