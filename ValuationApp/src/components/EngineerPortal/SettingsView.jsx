import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Fingerprint, HelpCircle, ChevronRight, CheckCircle2, Bell, SlidersHorizontal, PenTool } from 'lucide-react';
import pkg from '../../../package.json';
import IconTile, { AssistiveGlyph } from '../Shared/IconTile';
import NotificationPrefsCard from '../Shared/NotificationPrefsCard';
import SignatureSettings from '../Shared/SignatureSettings';
import { Row, Switch, BackBar, IosSettingsStyles } from '../Shared/IosSettings';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import { roleLabel as roleName } from '../../utils/session';

export default function SettingsView({ currentUser, handleLogout }) {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // WhatsApp floating toggle state
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
  
  // Profile state
  const [isSaved, setIsSaved] = useState(false);
  const [profilePic, setProfilePic] = useState(() => {
    return localStorage.getItem(`profilePic_${currentUser?.id}`) || null;
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const fileInputRef = useRef(null);

  // Form state
  const [profileData, setProfileData] = useState(() => {
    const savedData = localStorage.getItem(`profileData_${currentUser?.id}`);
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (e) {}
    }
    return {
      name: currentUser?.name || currentUser?.username || 'Unknown User',
      phone: currentUser?.phone || 'Not Set',
      email: currentUser?.email || 'Not Set',
      address: 'Kadapa, Y.S.R District, Andhra Pradesh',
      bio: 'Technical Valuation Engineer at Gouru Panel.'
    };
  });

  const [showProfilePreview, setShowProfilePreview] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.body.classList.contains('dark-theme'));
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.body.classList.remove('dark-theme');
      setIsDarkMode(false);
    } else {
      document.body.classList.add('dark-theme');
      setIsDarkMode(true);
    }
  };

  const handleInputChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
        localStorage.setItem(`profilePic_${currentUser?.id}`, reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    localStorage.setItem(`profileData_${currentUser?.id}`, JSON.stringify(profileData));
    if (profilePic) {
      localStorage.setItem(`profilePic_${currentUser?.id}`, profilePic);
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setPage('main'); // back to Settings after saving
    }, 1200);
  };

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

  // iOS Settings navigation: main list → detail pages
  const [page, setPage] = useState('main'); // 'main' | 'profile' | 'notifications'
  const open = (p) => { setPage(p); document.querySelector('.main-content')?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0 }); };
  const initials = (profileData.name || 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const roleLabel = roleName(currentUser);

  const avatar = (size) => (
    <span className="ios-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {profilePic ? <img src={profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials}
    </span>
  );

  return (
    <div className={`ios-settings ${page === 'main' ? 'animate-fade-in' : 'ios-subpage'}`} key={page} style={{ paddingBottom: '80px' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleProfilePicUpload} />

      {page === 'main' && (
        <>
          <h1 className="ios-large-title" style={{ marginTop: 0 }}>Settings</h1>

          {/* Profile (like the Apple ID row) */}
          <div className="ios-group">
            <button type="button" className="ios-row ios-profile is-link" onClick={() => open('profile')}>
              {avatar(58)}
              <span className="ios-profile-text">
                <span className="ios-profile-name">{profileData.name}</span>
                <span className="ios-profile-sub">{roleLabel} · {currentUser?.id || 'ENG-001'}</span>
              </span>
              <ChevronRight size={18} className="ios-chev" aria-hidden="true" />
            </button>
          </div>

          <div className="ios-section">Reports</div>
          <div className="ios-group">
            <Row icon={PenTool} color="indigo" label="Digital Signature" onClick={() => open('signature')} />
          </div>
          <p className="ios-footnote">Save your signature once — it is applied to your bank reports when you submit a case.</p>

          <div className="ios-section">Notifications</div>
          <div className="ios-group">
            <Row icon={Bell} color="red" label="Notifications" onClick={() => open('notifications')} />
          </div>

          <div className="ios-section">General</div>
          <div className="ios-group">
            <div className="ios-row">
              <IconTile icon={isDarkMode ? Moon : Sun} color={isDarkMode ? 'indigo' : 'orange'} size={30} />
              <span className="ios-row-label">Dark Mode</span>
              <Switch on={isDarkMode} onChange={toggleTheme} label="Dark Mode" />
            </div>
            <div className="ios-row">
              <IconTile glyph={<AssistiveGlyph size={18} />} color="graphite" size={30} />
              <span className="ios-row-label">Assistive Touch</span>
              <Switch on={showWhatsappFloat} onChange={handleToggleWhatsapp} label="Assistive Touch" />
            </div>
          </div>
          <p className="ios-footnote">Assistive Touch is a floating button for Messages and quick actions, like on iPhone.</p>

          <div className="ios-section">Security</div>
          <div className="ios-group">
            <Row icon={Fingerprint} color="green" label="Face ID & Fingerprint" value="Set up" onClick={handleRegisterBiometrics} />
            <Row icon={SlidersHorizontal} color="blue" label="App Permissions" onClick={() => window.dispatchEvent(new Event('gcr_open_permissions'))} />
          </div>
          <p className="ios-footnote">Unlock with your face or fingerprint, and check location, camera and notification access.</p>

          <div className="ios-section">Support</div>
          <div className="ios-group">
            <Row icon={HelpCircle} color="blue" label="Help & Support" onClick={() => setShowHelpModal(true)} />
          </div>

          <div className="ios-group ios-group-gap">
            <button type="button" className="ios-row ios-signout" onClick={handleLogout}>Sign Out</button>
          </div>

          <div className="ios-version">Gouru Valuations · Version {pkg.version}<br />Developed by MSTechHive</div>
        </>
      )}

      {page === 'signature' && (
        <>
          <BackBar onBack={() => setPage('main')} title="Digital Signature" />
          <SignatureSettings />
        </>
      )}

      {page === 'notifications' && (
        <>
          <BackBar onBack={() => setPage('main')} title="Notifications" />
          <NotificationPrefsCard currentUser={currentUser} />
        </>
      )}

      {page === 'profile' && (
        <>
          <BackBar onBack={() => setPage('main')} title="Personal Details" />

          <div className="pd-photo">
            <button type="button" className="pd-photo-btn" onClick={() => (profilePic ? setShowProfilePreview(true) : fileInputRef.current?.click())} aria-label={profilePic ? 'View photo' : 'Add photo'}>
              {avatar(96)}
            </button>
            <button type="button" className="pd-photo-edit" onClick={() => fileInputRef.current?.click()}>
              {profilePic ? 'Change Photo' : 'Add Photo'}
            </button>
          </div>

          <div className="ios-group pd-form">
            <label className="pd-field">
              <span>Name</span>
              <input type="text" name="name" value={profileData.name || ''} onChange={handleInputChange} placeholder="Full name" />
            </label>
            <label className="pd-field">
              <span>Age</span>
              <input type="number" name="age" inputMode="numeric" value={profileData.age || ''} onChange={handleInputChange} placeholder="Optional" />
            </label>
            <label className="pd-field">
              <span>Date of Birth</span>
              <input type="date" name="dob" value={profileData.dob || ''} onChange={handleInputChange} />
            </label>
            <label className="pd-field">
              <span>Address</span>
              <input type="text" name="address" value={profileData.address || ''} onChange={handleInputChange} placeholder="City, district" />
            </label>
          </div>

          <div className="ios-section">About</div>
          <div className="ios-group pd-form">
            <label className="pd-field pd-field-area">
              <span className="sr-only">Bio</span>
              <textarea name="bio" rows="3" value={profileData.bio || ''} onChange={handleInputChange} placeholder="A short line about you" />
            </label>
          </div>

          <button type="button" className={`pd-save ${isSaved ? 'saved' : ''}`} onClick={handleSaveProfile}>
            {isSaved ? <><CheckCircle2 size={18} /> Saved</> : 'Save'}
          </button>
          <p className="ios-footnote" style={{ textAlign: 'center' }}>Your ID {currentUser?.id || ''} and role are managed by the admin.</p>
        </>
      )}

      <IosSettingsStyles />
      <style>{`
        .pd-photo { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 4px 0 20px; }
        .pd-photo-btn { border: none; background: none; padding: 0; cursor: pointer; border-radius: 50%; }
        .pd-photo-edit { border: none; background: none; color: #007aff; font: inherit; font-size: 15px; cursor: pointer; }
        .pd-form { display: flex; flex-direction: column; }
        .pd-field { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 0 16px; position: relative; cursor: text; }
        .pd-field + .pd-field::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.22); }
        .pd-field > span { width: 108px; flex-shrink: 0; font-size: 16px; color: inherit; letter-spacing: -0.3px; }
        .pd-field input, .pd-field textarea {
          flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px;
          color: #3c3c43; text-align: right; padding: 12px 0; letter-spacing: -0.3px;
        }
        .pd-field-area textarea { text-align: left; resize: none; line-height: 1.4; }
        .pd-field input::placeholder, .pd-field textarea::placeholder { color: #c7c7cc; }
        .pd-save {
          display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 50px; margin-top: 24px;
          border: none; border-radius: 12px; background: #007aff; color: #fff; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer;
        }
        .pd-save.saved { background: #34c759; }
        .pd-save:active { opacity: 0.85; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .dark-theme .pd-field input, .dark-theme .pd-field textarea { color: #ebebf5; }
        .dark-theme .pd-field + .pd-field::before { border-top-color: rgba(84,84,88,0.6); }
      `}</style>

      {showProfilePreview && profilePic && (
        <div 
          onClick={() => setShowProfilePreview(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <img 
            src={profilePic} 
            alt="Profile Preview" 
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain' }} 
          />
        </div>
      )}

      {/* Help & Support Modal */}
      {showHelpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>Help & Support</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>Frequently Asked Questions</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {/* FAQ 1 */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                    style={{ padding: '14px 16px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>How do I submit a valuation report?</span>
                    <span style={{ color: '#94a3b8', transform: expandedFaq === 1 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {expandedFaq === 1 && (
                    <div style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', lineHeight: '1.5' }}>
                      Go to the "Cases" tab, select a case, and tap the "Submit Report" button to fill out the form and upload photos.
                    </div>
                  )}
                </div>

                {/* FAQ 2 */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
                    style={{ padding: '14px 16px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>How do I mark my attendance?</span>
                    <span style={{ color: '#94a3b8', transform: expandedFaq === 2 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {expandedFaq === 2 && (
                    <div style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', lineHeight: '1.5' }}>
                      Tap the "Attendance" tab at the bottom to mark your daily presence. You have the option to <strong>clock-in up to 3 times</strong> and <strong>clock-out up to 3 times</strong> per day to support flexible shift patterns.
                    </div>
                  )}
                </div>

                {/* FAQ 3 */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedFaq(expandedFaq === 3 ? null : 3)}
                    style={{ padding: '14px 16px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>How can I chat with the Admin?</span>
                    <span style={{ color: '#94a3b8', transform: expandedFaq === 3 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {expandedFaq === 3 && (
                    <div style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', lineHeight: '1.5' }}>
                      Use the "Chat" tab at the bottom navigation bar to send direct messages, documents, photos, and live locations directly to the Admin.
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: '0 0 12px 0' }}>Contact MSTechHive Support</h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.4' }}>If you are facing any technical issues with the app, please contact our official support team:</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <a href="mailto:support@mstechhive.com" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#eff6ff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' }}>📧</div>
                    <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '500' }}>support@mstechhive.com</span>
                  </a>
                  
                  <a href="tel:+919701800140" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' }}>📞</div>
                    <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '500' }}>+91 9701800140</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
