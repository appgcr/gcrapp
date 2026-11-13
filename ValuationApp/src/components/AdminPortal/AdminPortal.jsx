import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, ClipboardList, PenSquare, Users, Settings, MessageCircle, Megaphone, LogOut } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import './AdminPortal.css';
import AdminDashboard from './AdminDashboard';
import AdminCases from './AdminCases';
import AdminStaff from './AdminStaff';
import AdminSettings from './AdminSettings';
import AttendanceLogs from '../EngineerPortal/AttendanceLogs'; // Using existing for Forms
import NotificationBell from '../Shared/NotificationBell';
import BranchSwitcher from './BranchSwitcher';
import { roleLabel } from '../../utils/session';
import ChatSystem from '../Shared/ChatSystem';
import GlobalChatWidget from '../Shared/GlobalChatWidget';
import BroadcastSheet from './BroadcastSheet';
import { GridIcon, DocIcon, CalendarIcon, PeopleIcon, GearIcon } from '../Shared/TabIcons';
import GcrLogo from '../Shared/GcrLogo';
import PullDownReach from '../Shared/PullDownReach';
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
        fetch(`${API_BASE_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: staff.id,
            title: 'Admin Announcement',
            message: finalMessage,
            isRead: false
          })
        })
      );
      
      const results = await Promise.all(promises);
      const delivered = results.filter(r => r.ok).length;
      if (delivered === 0) throw new Error('Server rejected the announcement');
      if (delivered < targetList.length) {
        toast.error(`Sent to ${delivered} of ${targetList.length}. Some could not be delivered.`);
      } else {
        toast.success(`Announcement sent to ${delivered} ${delivered === 1 ? 'person' : 'people'}`);
      }
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
  
  // Tapping a push notification opens the matching Cases tab
  useEffect(() => {
    const open = (e) => {
      const type = e.detail?.type;
      handleNavigate('cases', type === 'report_submitted' ? 'Pending' : '');
    };
    window.addEventListener('gcr_open_case', open);
    return () => window.removeEventListener('gcr_open_case', open);
  }, []);

  const activeTabRef = useRef(activeTab);
  const lastUnreadCountRef = useRef(0);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (showBroadcastModal) {
      // Fetch staff every time modal opens to ensure it's dynamically updated
      fetch(`${API_BASE_URL}/api/users`)
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
    // Unread chat count is always tracked (Assistive Touch badge); desktop/phone
    // notifications for new messages only when the admin has them switched on.
    const alertsOn = () => localStorage.getItem('admin_push_notifications') !== 'false'; // read live (Controls can change it)

    if (alertsOn() && Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }

    const checkMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/admin/users`);
        if (res.ok) {
          const data = await res.json();
          const currentUnread = data.reduce((acc, user) => acc + user.unreadCount, 0);
          
          setUnreadChats(currentUnread);
          if (alertsOn() && currentUnread > lastUnreadCountRef.current && activeTabRef.current !== 'chat') {
            if (Capacitor.isNativePlatform()) {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'New Message from Engineer',
                    body: 'You have a new unread message in the admin portal.',
                    id: Date.now() % 2000000000, // Android needs a 32-bit id (the raw time is too big and the alert never shows)
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

  // Assistive Touch quick actions
  const [unreadChats, setUnreadChats] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const onAction = (e) => {
      const action = e.detail?.action;
      if (action === 'new_case') handleNavigate('cases', `NEW_CASE:${Date.now()}`);
      else if (action === 'find_case') handleNavigate('cases', `FIND:${Date.now()}`);
      else if (action === 'review_queue') handleNavigate('cases', 'Pending');
      else if (action === 'live_map') handleNavigate('staff');
      else if (action === 'attendance') handleNavigate('forms');
      else if (action === 'broadcast') setShowBroadcastModal(true);
      else if (action === 'home') { handleNavigate('dashboard'); setRefreshKey((k) => k + 1); } // also leaves any sub-page
      else if (action === 'refresh') setRefreshKey((k) => k + 1); // remounts the page → fresh data
    };
    window.addEventListener('gcr_quick_action', onAction);
    return () => window.removeEventListener('gcr_quick_action', onAction);
  }, []);

  // Super Admin switched branch → reload the page's data and the alerts for that branch
  useEffect(() => {
    const onScope = () => { setRefreshKey((k) => k + 1); window.dispatchEvent(new CustomEvent('gcr_refresh_notifications')); };
    window.addEventListener('gcr_branch_scope', onScope);
    return () => window.removeEventListener('gcr_branch_scope', onScope);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard onNavigate={handleNavigate} />;
      case 'cases': return <AdminCases defaultFilter={caseFilter} currentUser={currentUser} />;
      case 'forms': return <AttendanceLogs />; // Repurposing attendance logs as Forms for now
      case 'staff': return <AdminStaff currentUser={currentUser} />;
      case 'chat': return <div className="admin-chat-host"><ChatSystem currentUser={currentUser} onBack={() => setActiveTab('dashboard')} /></div>;
      case 'settings': return <AdminSettings currentUser={currentUser} handleLogout={handleLogout} />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <PullDownReach scrollSelector=".admin-main-content" disabled={activeTab === 'chat'}>
    <div className="admin-portal-wrapper">
      {/* Enterprise Desktop Sidebar (Rendered on >= 1024px) */}
      <aside className="admin-desktop-sidebar">
        <div className="admin-sidebar-header">
          <GcrLogo size={38} />
          <div>
            <div className="admin-sidebar-brand">GOURU VALUATIONS</div>
            <div className="admin-sidebar-sub">Enterprise Credit Suite</div>
          </div>
        </div>

        <div className="admin-sidebar-nav">
          <button 
            className={`admin-sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          <button 
            className={`admin-sidebar-item ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => handleNavigate('cases')}
          >
            <ClipboardList size={18} />
            <span>Valuation Cases</span>
          </button>
          <button 
            className={`admin-sidebar-item ${activeTab === 'forms' ? 'active' : ''}`}
            onClick={() => setActiveTab('forms')}
          >
            <PenSquare size={18} />
            <span>Attendance & Logs</span>
          </button>
          <button 
            className={`admin-sidebar-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={18} />
            <span>Field Engineers</span>
          </button>
          <button 
            className={`admin-sidebar-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle size={18} />
            <span>Staff Messages</span>
          </button>
          <button 
            className={`admin-sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Portal Settings</span>
          </button>
        </div>

        <div className="admin-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div className="admin-sidebar-avatar">
              {(currentUser?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-sidebar-user-name">{currentUser?.name || 'Super Admin'}</div>
              <div className="admin-sidebar-user-role">{roleLabel(currentUser)}{currentUser?.branchInfo ? ` · ${currentUser.branchInfo.name}` : ''}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-sidebar-logout-btn" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-desktop-main">
        {activeTab !== 'chat' && (
          <header className="admin-header gcr-navbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Gouru Valuations"
                aria-label="Go to dashboard"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
              >
                <GcrLogo size={32} />
              </button>
              <div className="admin-header-stack">
                <div className="admin-header-title">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {activeTab === 'cases' && 'Cases'}
                  {activeTab === 'forms' && 'Attendance'}
                  {activeTab === 'staff' && 'Staff'}
                  {activeTab === 'settings' && 'Settings'}
                </div>
                {activeTab !== 'settings' && <BranchSwitcher currentUser={currentUser} />}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <button
                className="gcr-nav-icon"
                onClick={() => setShowBroadcastModal(true)}
                title="New announcement"
                aria-label="New announcement"
              >
                <Megaphone strokeWidth={2} />
              </button>
              <NotificationBell userId="ADMIN" currentUserId={currentUser?.id} />
            </div>
          </header>
        )}

        <GlobalChatWidget currentUser={currentUser} unreadChats={unreadChats} />

        <main className="admin-main-content" style={activeTab === 'chat' ? { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : {}}>
          <React.Fragment key={refreshKey}>{renderContent()}</React.Fragment>
        </main>
      </div>

      {showBroadcastModal && (
        <BroadcastSheet
          onClose={() => setShowBroadcastModal(false)}
          message={broadcastMessage}
          setMessage={setBroadcastMessage}
          image={broadcastImage}
          setImage={setBroadcastImage}
          target={broadcastTarget}
          setTarget={setBroadcastTarget}
          staff={availableStaff}
          isBroadcasting={isBroadcasting}
          isUploadingImage={isUploadingImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageUpload}
          onSend={handleSendBroadcast}
        />
      )}

      <nav className="admin-nav ios-tabbar" aria-label="Main">
        {[
          { key: 'dashboard', label: 'Dashboard', Icon: GridIcon, go: () => handleNavigate('dashboard') },
          { key: 'cases', label: 'Cases', Icon: DocIcon, go: () => handleNavigate('cases') },
          { key: 'forms', label: 'Attendance', Icon: CalendarIcon, go: () => setActiveTab('forms') },
          { key: 'staff', label: 'Staff', Icon: PeopleIcon, go: () => setActiveTab('staff') },
          { key: 'settings', label: 'Settings', Icon: GearIcon, go: () => setActiveTab('settings') },
        ].map(({ key, label, Icon, go }) => (
          <button
            key={key}
            className={`admin-nav-item ios-tab ${activeTab === key ? 'active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={go}
          >
            <Icon active={activeTab === key} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
    </PullDownReach>
  );
}
