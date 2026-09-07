import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, LayoutDashboard, ClipboardList, PenSquare, Users, Settings, MessageCircle, Megaphone, X, Send, ImagePlus, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import './AdminPortal.css';
import AdminDashboard from './AdminDashboard';
import AdminCases from './AdminCases';
import AdminStaff from './AdminStaff';
import AdminSettings from './AdminSettings';
import AttendanceLogs from '../EngineerPortal/AttendanceLogs'; // Using existing for Forms
import NotificationBell from '../Shared/NotificationBell';
import ChatSystem from '../Shared/ChatSystem';
import GlobalChatWidget from '../Shared/GlobalChatWidget';
import { toast } from 'react-hot-toast';

export default function AdminPortal({ currentUser, handleLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [caseFilter, setCaseFilter] = useState('');
  
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState(['ALL']); // Array for multiple selection
  const [availableStaff, setAvailableStaff] = useState([]);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploadingImage(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      // Use robust Base64 so the preview always works and can be reliably broadcasted
      setBroadcastImage(reader.result);
      setIsUploadingImage(false);
      toast.success("Image attached successfully");
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  // Function to handle sending the broadcast message
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() && !broadcastImage) return toast.error('Message cannot be empty');
    
    setIsBroadcasting(true);
    try {
      // Append image URL safely into the message using a separator
      const finalMessage = broadcastImage ? `${broadcastMessage}|IMG|${broadcastImage}` : broadcastMessage;
      
      // Use the pre-fetched availableStaff and filter based on target array
      let targetList = availableStaff;
      if (!broadcastTarget.includes('ALL')) {
        targetList = availableStaff.filter(s => broadcastTarget.includes(s.id));
      }
      
      if (targetList.length === 0) {
        setIsBroadcasting(false);
        return toast.error('No recipients found');
      }
      
      // 2. Loop through staff and send a notification to each
      const promises = targetList.map(staff => 
        fetch('https://gcr-9ys1.onrender.com/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: staff.id,
            title: '📢 Admin Announcement',
            message: finalMessage,
            isRead: false
          })
        })
      );
      
      await Promise.all(promises);
      toast.success(`Message sent to ${targetList.length} staff member${targetList.length !== 1 ? 's' : ''}!`);
      setShowBroadcastModal(false);
      setBroadcastMessage('');
      setBroadcastImage('');
      setBroadcastTarget(['ALL']);
    } catch (error) {
      console.error('Broadcast error:', error);
      toast.error('Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };
  
  const activeTabRef = useRef(activeTab);
  const lastUnreadCountRef = useRef(0);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (showBroadcastModal) {
      // Fetch staff every time modal opens to ensure it's dynamically updated
      fetch('https://gcr-9ys1.onrender.com/api/users')
        .then(res => res.json())
        .then(data => {
          setAvailableStaff(data.filter(u => u.role === 'ENGINEER'));
        })
        .catch(err => console.error('Failed to fetch staff for broadcast:', err));
    }
  }, [showBroadcastModal]);

  useEffect(() => {
    if (!currentUser) return;
    
    // Check if push notes are enabled in localStorage (default true)
    const pushEnabled = localStorage.getItem('admin_push_notifications') !== 'false';
    if (!pushEnabled) return;

    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }

    const checkMessages = async () => {
      try {
        const res = await fetch('https://gcr-9ys1.onrender.com/api/chat/admin/users');
        if (res.ok) {
          const data = await res.json();
          const currentUnread = data.reduce((acc, user) => acc + user.unreadCount, 0);
          
          if (currentUnread > lastUnreadCountRef.current && activeTabRef.current !== 'chat') {
            if (Capacitor.isNativePlatform()) {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'New Message from Engineer',
                    body: 'You have a new unread message in the admin portal.',
                    id: new Date().getTime(),
                    schedule: { at: new Date(Date.now() + 1000) },
                    sound: null,
                    attachments: null,
                    actionTypeId: '',
                    extra: null
                  }
                ]
              });
            } else {
              if (Notification.permission === 'granted') {
                new Notification('New Message', { body: 'You have a new unread message from an engineer.' });
              } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    new Notification('New Message', { body: 'You have a new unread message from an engineer.' });
                  }
                });
              }
            }
          }
          lastUnreadCountRef.current = currentUnread;
        }
      } catch (err) {
        console.error('Error polling admin chats in background:', err);
      }
    };

    // Check immediately, then every 3 seconds
    checkMessages();
    const interval = setInterval(checkMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleNavigate = (tab, filter = '') => {
    setCaseFilter(filter);
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard onViewAll={() => handleNavigate('cases')} onNavigate={handleNavigate} />;
      case 'cases': return <AdminCases defaultFilter={caseFilter} />;
      case 'forms': return <AttendanceLogs />; // Repurposing attendance logs as Forms for now
      case 'staff': return <AdminStaff />;
      case 'chat': return <ChatSystem currentUser={currentUser} onBack={() => setActiveTab('dashboard')} />;
      case 'settings': return <AdminSettings currentUser={currentUser} handleLogout={handleLogout} />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="admin-portal-wrapper">
      {activeTab !== 'chat' && (
        <header className="admin-header">
          <div style={{ 
            width: '28px', 
            height: '28px', 
            backgroundColor: '#0346c8', 
            color: 'white', 
            borderRadius: '6px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: '800', 
            fontSize: '10px',
            letterSpacing: '0.5px'
          }}>GCR</div>
          <div className="admin-header-title">Admin Portal</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="admin-header-icon" 
              onClick={() => setShowBroadcastModal(true)}
              title="Broadcast to All Staff"
              style={{ color: '#f59e0b', background: '#fef3c7' }}
            >
              <Megaphone size={22} />
            </button>
            <NotificationBell userId="ADMIN" />
          </div>
        </header>
      )}

      <GlobalChatWidget setActiveTab={setActiveTab} currentUser={currentUser} />

      <main className="admin-main-content" style={activeTab === 'chat' ? { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : {}}>
        {renderContent()}
      </main>

      {showBroadcastModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px', background: 'linear-gradient(135deg, #0346c8 0%, #3b82f6 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff', fontWeight: '800', fontSize: '18px', letterSpacing: '0.5px' }}>
                <Megaphone size={24} color="#fef08a" /> Global Broadcast
              </div>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={isBroadcasting}>
                <X size={18} color="#fff" />
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>Send to</label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px', backgroundColor: '#f8fafc' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderRadius: '8px', background: broadcastTarget.includes('ALL') ? '#eff6ff' : 'transparent', transition: 'all 0.2s' }}>
                    <input 
                      type="checkbox" 
                      checked={broadcastTarget.includes('ALL')} 
                      onChange={(e) => {
                        if (e.target.checked) setBroadcastTarget(['ALL']);
                        else setBroadcastTarget([]);
                      }} 
                      style={{ width: '16px', height: '16px', accentColor: '#0346c8', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>📢 All Staff Members</span>
                  </label>
                  {availableStaff.map(staff => (
                    <label key={staff.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderRadius: '8px', background: broadcastTarget.includes(staff.id) && !broadcastTarget.includes('ALL') ? '#eff6ff' : 'transparent', transition: 'all 0.2s' }}>
                      <input 
                        type="checkbox" 
                        checked={broadcastTarget.includes('ALL') || broadcastTarget.includes(staff.id)} 
                        disabled={broadcastTarget.includes('ALL')}
                        onChange={(e) => {
                          let newTarget = broadcastTarget.filter(t => t !== 'ALL');
                          if (e.target.checked) newTarget.push(staff.id);
                          else newTarget = newTarget.filter(t => t !== staff.id);
                          if (newTarget.length === 0) newTarget = ['ALL']; // Default back to ALL if empty
                          setBroadcastTarget(newTarget);
                        }} 
                        style={{ width: '16px', height: '16px', accentColor: '#0346c8', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500', color: '#334155', fontSize: '14px' }}>👤 {staff.name || staff.id}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <textarea 
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder="What's the announcement? (e.g., Happy Vinayaka Chavithi!)..."
                style={{ width: '100%', height: '140px', padding: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '16px', fontSize: '15px', color: '#334155', resize: 'none', outline: 'none', marginBottom: '16px', transition: 'border-color 0.2s' }}
                disabled={isBroadcasting}
              />
              
              {broadcastImage && (
                <div style={{ position: 'relative', width: '100%', height: '160px', marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <img src={broadcastImage} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setBroadcastImage('')} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(15, 23, 42, 0.7)', color: 'white', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBroadcasting || isUploadingImage}
                  style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#f8fafc', color: '#64748b', fontWeight: '700', border: '2px dashed #cbd5e1', cursor: isUploadingImage ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                >
                  {isUploadingImage ? <><Loader2 size={18} className="spin" /> Uploading...</> : <><ImagePlus size={18} color="#0346c8" /> Attach</>}
                </button>
                
                <button 
                  onClick={handleSendBroadcast} 
                  disabled={isBroadcasting || isUploadingImage}
                  style={{ flex: 1.5, padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, #0346c8 0%, #2563eb 100%)', color: 'white', fontWeight: '700', border: 'none', cursor: isBroadcasting ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (isBroadcasting || isUploadingImage) ? 0.7 : 1, boxShadow: '0 10px 15px -3px rgba(3, 70, 200, 0.3)' }}
                >
                  {isBroadcasting ? 'Broadcasting...' : <><Send size={18} /> Broadcast</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="admin-nav">
        <button className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavigate('dashboard')}>
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </button>
        <button className={`admin-nav-item ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => handleNavigate('cases')}>
          <ClipboardList size={22} />
          <span>Cases</span>
        </button>
        <button className={`admin-nav-item ${activeTab === 'forms' ? 'active' : ''}`} onClick={() => setActiveTab('forms')}>
          <PenSquare size={22} />
          <span>Attendance</span>
        </button>
        <button className={`admin-nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
          <Users size={22} />
          <span>Staff</span>
        </button>
        <button className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={22} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
