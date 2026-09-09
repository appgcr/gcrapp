import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Shield, HelpCircle, LogOut, ChevronRight, Camera, User, Calendar, MapPin, FileText, CheckCircle2, ChevronDown } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';

export default function SettingsView({ currentUser, handleLogout }) {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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
      bio: 'Technical Valuation Engineer at GCR Panel.'
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
      setIsEditingProfile(false); // Close the form after saving
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

  return (
    <div className="settings-view animate-fade-in" style={{ paddingBottom: '80px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>Settings</h1>

      {/* Interactive Profile Picture Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={handleProfilePicUpload}
        />
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          
          <div 
            onClick={() => { if (profilePic) setShowProfilePreview(true); }}
            style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              backgroundColor: 'var(--primary)', color: '#fff', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '36px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: profilePic ? 'pointer' : 'default', overflow: 'hidden'
            }}
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              profileData.name.charAt(0).toUpperCase()
            )}
          </div>
          
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{
              position: 'absolute', bottom: '0', right: '0',
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: '#fff', border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Camera size={16} />
          </button>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>{profileData.name}</h2>
        <p className="text-muted" style={{ fontSize: '14px', margin: 0 }}>
          {currentUser?.role === 'SUPER_ADMIN' ? 'Administrator' : 'Field Engineer'} • ID: {currentUser?.id || 'ENG-001'}
        </p>
      </div>

      {/* Collapsible Personal Details Section */}
      <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
        
        <div 
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-app)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={20} color="var(--primary)" />
            <span style={{ fontSize: '15px', fontWeight: '600' }}>Personal Details</span>
          </div>
          <div style={{ transform: isEditingProfile ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
            <ChevronDown size={20} color="var(--text-muted)" />
          </div>
        </div>

        {isEditingProfile && (
          <div style={{ borderTop: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <User size={14} /> Full Name
              </label>
              <input 
                type="text" 
                name="name"
                value={profileData.name} 
                onChange={handleInputChange}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: '500', outline: 'none', color: 'var(--text-primary)' }} 
              />
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ padding: '16px', borderRight: '1px solid var(--border-color)', flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <User size={14} /> Age
                </label>
                <input 
                  type="number" 
                  name="age"
                  value={profileData.age} 
                  onChange={handleInputChange}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: '500', outline: 'none', color: 'var(--text-primary)' }} 
                />
              </div>
              <div style={{ padding: '16px', flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <Calendar size={14} /> Date of Birth
                </label>
                <input 
                  type="date" 
                  name="dob"
                  value={profileData.dob} 
                  onChange={handleInputChange}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: '500', outline: 'none', color: 'var(--text-primary)' }} 
                />
              </div>
            </div>

            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <MapPin size={14} /> Address
              </label>
              <input 
                type="text" 
                name="address"
                value={profileData.address} 
                onChange={handleInputChange}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: '500', outline: 'none', color: 'var(--text-primary)' }} 
              />
            </div>

            <div style={{ padding: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <FileText size={14} /> Bio
              </label>
              <textarea 
                name="bio"
                value={profileData.bio}
                onChange={handleInputChange}
                rows="3"
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: '500', outline: 'none', color: 'var(--text-primary)', resize: 'none' }} 
              />
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn-primary" 
                onClick={handleSaveProfile}
                style={{ width: '100%', backgroundColor: isSaved ? 'var(--success)' : 'var(--primary)' }}
              >
                {isSaved ? <><CheckCircle2 size={18} /> Saved successfully!</> : 'Save Personal Details'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preferences Section */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', paddingLeft: '8px' }}>Preferences</h3>
      <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isDarkMode ? <Moon size={20} color="var(--primary)" /> : <Sun size={20} color="var(--primary)" />}
            <span style={{ fontSize: '15px', fontWeight: '500' }}>Dark Mode</span>
          </div>
          {/* Native-style iOS toggle switch (Fixed state) */}
          <div 
            onClick={toggleTheme}
            style={{ 
              width: '50px', height: '30px', borderRadius: '15px', 
              backgroundColor: isDarkMode ? '#25d366' : '#e2e8f0',
              position: 'relative', cursor: 'pointer', transition: 'all 0.3s' 
            }}
          >
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#fff',
              position: 'absolute', top: '2px', left: isDarkMode ? '22px' : '2px',
              transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>
      </div>

      {/* Account Section */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', paddingLeft: '8px' }}>Account & Security</h3>
      <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '32px' }}>
        
        <div 
          onClick={handleRegisterBiometrics}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={20} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: '500' }}>Register Biometrics (Passkey)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Setup Fingerprint or Face ID for login</div>
            </div>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>

        {currentUser?.role === 'SUPER_ADMIN' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={20} color="var(--primary)" />
              <span style={{ fontSize: '15px', fontWeight: '500' }}>Change Password</span>
            </div>
            <ChevronRight size={20} color="var(--text-muted)" />
          </div>
        )}

        <div 
          onClick={() => setShowHelpModal(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HelpCircle size={20} color="var(--primary)" />
            <span style={{ fontSize: '15px', fontWeight: '500' }}>Help & Support</span>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>
      </div>

      {/* Logout Button (Only for SUPER_ADMIN) */}
      {currentUser.role === 'SUPER_ADMIN' && (
        <button 
          onClick={handleLogout}
          style={{
            width: '100%', padding: '16px', borderRadius: '12px',
            backgroundColor: '#fee2e2', color: '#dc2626',
            border: 'none', fontSize: '16px', fontWeight: '600',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            cursor: 'pointer'
          }}
        >
          <LogOut size={20} />
          Log Out Securely
        </button>
      )}

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p className="text-muted" style={{ fontSize: '12px' }}>App Version 3.1.0 • Developed by MSTechHive</p>
      </div>

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
