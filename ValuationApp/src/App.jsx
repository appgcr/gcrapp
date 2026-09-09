import { API_BASE_URL } from './config/api';
import React, { useState, useEffect, useRef } from 'react';
import { Home, Bell, LayoutGrid, ClipboardList, PenSquare, Settings, ArrowLeft, LogOut, MessageCircle } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import AppLock from './components/Auth/AppLock';
import LoginScreen from './components/Auth/LoginScreen';
import EngineerDashboard from './components/EngineerPortal/EngineerDashboard';
import CaseListView from './components/EngineerPortal/CaseListView';
import CaseDetailsView from './components/EngineerPortal/CaseDetailsView';
import AttendanceView from './components/EngineerPortal/AttendanceView';
import AttendanceLogs from './components/EngineerPortal/AttendanceLogs';
import SettingsView from './components/EngineerPortal/SettingsView';
import AdminPortal from './components/AdminPortal/AdminPortal';
import ChatSystem from './components/Shared/ChatSystem';
import NotificationBell from './components/Shared/NotificationBell';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [activeTab, setActiveTab] = useState('forms'); // forms (attendance), cases, dashboard, settings
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  // The entire user list is no longer loaded into state; LoginScreen queries the backend API directly.
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('sbi_valuation_current_user_v3');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [isAppLocked, setIsAppLocked] = useState(!!currentUser);
  
  // Background Notification State
  const activeTabRef = useRef(activeTab);
  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'SUPER_ADMIN') return;
    
    // Request permission natively
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }

    const checkMessages = async () => {
      try {
        const res = await fetch(`https://gcr-9ys1.onrender.com/api/chat/${currentUser.id}/ADMIN`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            const latestMsg = data[data.length - 1];
            
            if (
              lastMessageIdRef.current && 
              lastMessageIdRef.current !== latestMsg._id && 
              latestMsg.senderId === 'ADMIN' && 
              activeTabRef.current !== 'chat'
            ) {
              // Fire Native Notification
              if (Capacitor.isNativePlatform()) {
                LocalNotifications.schedule({
                  notifications: [{
                    title: 'New Message from Admin',
                    body: latestMsg.text.substring(0, 60) + (latestMsg.text.length > 60 ? '...' : ''),
                    id: new Date().getTime(),
                    schedule: { at: new Date(Date.now() + 100) },
                    smallIcon: 'ic_stat_icon_config_sample'
                  }]
                });
              } else if ('Notification' in window && Notification.permission === 'granted') {
                // Web Fallback
                new Notification('New Message from Admin', { body: latestMsg.text });
              }
            }
            lastMessageIdRef.current = latestMsg._id;
          }
        }
      } catch (err) {
        console.error("Global Chat Poller Error:", err);
      }
    };

    // Poll every 3 seconds for new background messages
    const interval = setInterval(checkMessages, 3000);
    
    // Web Notification Permission
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, [currentUser]);



  useEffect(() => {
    if (!currentUser) return;
    
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        setIsAppLocked(true);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAppLocked(false);
    localStorage.setItem('sbi_valuation_current_user_v3', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAppLocked(false);
    localStorage.removeItem('sbi_valuation_current_user_v3');
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (isAppLocked) {
    return <AppLock onUnlock={() => setIsAppLocked(false)} onFallback={handleLogout} />;
  }

  if (currentUser.role === 'SUPER_ADMIN') {
    return <AdminPortal currentUser={currentUser} handleLogout={handleLogout} />;
  }

  // Handle back button from case details
  const handleBack = () => {
    if (selectedCaseId) {
      setSelectedCaseId(null);
    }
  };

  return (
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' } }} />
      {/* Native App Top Header */}
      {activeTab !== 'chat' && (
        <header className="top-header">
        <div className="header-title">
          {selectedCaseId ? (
            <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={20} color="#001233" style={{ marginRight: '8px' }} />
            </button>
          ) : (
            <img src="/gcr-logo.png" alt="GCR Logo" style={{ height: '24px', width: 'auto' }} />
          )}
          <span>Valuation Portal</span>
        </div>
        <div className="header-actions">
          <NotificationBell userId={currentUser.id} />
          {currentUser.role === 'SUPER_ADMIN' && (
            <button 
              onClick={handleLogout} 
              style={{ 
                background: '#fee2e2', 
                border: '1px solid #fecaca', 
                borderRadius: '6px', 
                padding: '6px 10px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '12px', 
                fontWeight: '600',
                color: '#b91c1c', 
                cursor: 'pointer' 
              }}
              title="Log Out"
            >
              <LogOut size={14} /> Log Out
            </button>
          )}
        </div>
      </header>
      )}

      {/* Main Scrollable Content */}
      <main className="main-content" style={activeTab === 'chat' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: 'env(safe-area-inset-top, 44px) 0 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, backgroundColor: '#f1f5f9' } : {}}>
        {activeTab === 'dashboard' && !selectedCaseId && (
          <EngineerDashboard onOpenCase={(id) => { setSelectedCaseId(id); setActiveTab('cases'); }} currentUser={currentUser} />
        )}
        
        {activeTab === 'cases' && !selectedCaseId && (
          <CaseListView onOpenCase={(id) => setSelectedCaseId(id)} currentUser={currentUser} />
        )}

        {activeTab === 'cases' && selectedCaseId && (
          <CaseDetailsView caseId={selectedCaseId} />
        )}

        {activeTab === 'forms' && (
          <AttendanceView currentUser={currentUser} />
        )}

        {activeTab === 'logs' && (
          <AttendanceLogs />
        )}

        {activeTab === 'settings' && (
          <SettingsView currentUser={currentUser} handleLogout={handleLogout} />
        )}

        {activeTab === 'chat' && (
          <ChatSystem currentUser={currentUser} otherUserId="ADMIN" onBack={() => setActiveTab('dashboard')} />
        )}
      </main>

      {/* Persistent Bottom Tab Bar */}
      {activeTab !== 'chat' && (
      <nav className="bottom-tab-bar">
        {/* 1. Attendance (was Forms) */}
        <button className={`tab-item ${activeTab === 'forms' ? 'active' : ''}`} onClick={() => { setActiveTab('forms'); setSelectedCaseId(null); }}>
          <PenSquare size={24} />
          <span>Attendance</span>
        </button>

        {/* 2. Cases (or Logs for Admin) */}
        {currentUser.role === 'SUPER_ADMIN' ? (
          <button className={`tab-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => { setActiveTab('logs'); setSelectedCaseId(null); }}>
            <ClipboardList size={24} />
            <span>Logs</span>
          </button>
        ) : (
          <button className={`tab-item ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
            <ClipboardList size={24} />
            <span>Cases</span>
          </button>
        )}

        {/* 3. Dashboard */}
        <button className={`tab-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSelectedCaseId(null); }}>
          <LayoutGrid size={24} />
          <span>Dashboard</span>
        </button>
        
        {/* 4. Chat */}
        <button className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setSelectedCaseId(null); }}>
          <MessageCircle size={24} />
          <span>Chat</span>
        </button>

        {/* 5. Settings */}
        <button className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setSelectedCaseId(null); }}>
          <Settings size={24} />
          <span>Settings</span>
        </button>
      </nav>
      )}
    </div>
  );
}
