import { API_BASE_URL } from './config/api';
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Home, Bell, LayoutGrid, ClipboardList, PenSquare, Settings, ArrowLeft, LogOut, MessageCircle } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import AppLock from './components/Auth/AppLock';
import LoginScreen from './components/Auth/LoginScreen';
import PermissionsSetup, { permissionsSetupDone } from './components/Auth/PermissionsSetup';
import LaunchSplash from './components/Shared/LaunchSplash';
const EngineerDashboard = lazy(() => import('./components/EngineerPortal/EngineerDashboard'));
const CaseListView = lazy(() => import('./components/EngineerPortal/CaseListView'));
const CaseDetailsView = lazy(() => import('./components/EngineerPortal/CaseDetailsView'));
const AttendanceView = lazy(() => import('./components/EngineerPortal/AttendanceView'));
const AttendanceLogs = lazy(() => import('./components/EngineerPortal/AttendanceLogs'));
const SettingsView = lazy(() => import('./components/EngineerPortal/SettingsView'));
const AdminPortal = lazy(() => import('./components/AdminPortal/AdminPortal'));
const ChatSystem = lazy(() => import('./components/Shared/ChatSystem'));
import NotificationBell from './components/Shared/NotificationBell';
import GcrLogo from './components/Shared/GcrLogo';
import PullToRefresh from './components/Shared/PullToRefresh';
const LiveLocationReporter = lazy(() => import('./components/EngineerPortal/LiveLocationReporter'));
const GlobalChatWidget = lazy(() => import('./components/Shared/GlobalChatWidget'));
import PushRegistration, { unregisterPush } from './components/Shared/PushRegistration';
import { GridIcon, DocIcon, CalendarIcon, ChatIcon, GearIcon } from './components/Shared/TabIcons';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import { isAdminRole } from './utils/session';
const PublicSite = lazy(() => import('./components/Public/PublicSite'));
const BankPortal = lazy(() => import('./components/BankPortal/BankPortal'));

// Each portal (admin, engineer, bank, website) is loaded only when it is needed, so the
// app starts by loading just the login screen. This is shown for the moment a part loads.
function PartLoading() {
  return (
    <div className="gcr-part-loading" role="status" aria-label="Loading">
      <span />
      <style>{`.gcr-part-loading{display:flex;justify-content:center;align-items:center;min-height:40vh}
        .gcr-part-loading span{width:28px;height:28px;border-radius:50%;border:3px solid rgba(0,122,255,.2);border-top-color:#007aff;animation:gcrSpin .8s linear infinite}
        @keyframes gcrSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Public website pages (web only; the phone app opens straight to the login)
const LEGAL = { '/privacy': 'privacy', '/terms': 'terms', '/delete-account': 'delete-account' };
const cleanPath = () => (window.location.pathname.replace(/\/+$/, '') || '/');
const isBankRole = (u) => u?.role === 'BANK';

export default function App() {
  const [activeTab, setActiveTab] = useState('forms'); // forms (attendance), cases, dashboard, settings
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  // The entire user list is no longer loaded into state; LoginScreen queries the backend API directly.
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('sbi_valuation_current_user_v3');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [isAppLocked, setIsAppLocked] = useState(!!currentUser && !isBankRole(currentUser));

  // Which public page the browser is on (/, /login, /privacy, /terms, /delete-account)
  const [path, setPath] = useState(cleanPath);
  useEffect(() => {
    const onPop = () => setPath(cleanPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to) => {
    if (to !== window.location.pathname) window.history.pushState({}, '', to);
    setPath(to.replace(/\/+$/, '') || '/');
  };

  // "Allow access" screen: once after first sign-in, or reopened from Settings
  const [permScreen, setPermScreen] = useState(null); // null | 'first' | 'settings'
  useEffect(() => {
    if (currentUser?.id && !isBankRole(currentUser) && !permissionsSetupDone(currentUser.id)) setPermScreen('first');
  }, [currentUser?.id]);
  useEffect(() => {
    const open = () => setPermScreen('settings');
    window.addEventListener('gcr_open_permissions', open);
    return () => window.removeEventListener('gcr_open_permissions', open);
  }, []);
  
  // Background Notification State
  const activeTabRef = useRef(activeTab);
  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser || isAdminRole(currentUser) || isBankRole(currentUser)) return;
    
    // Lock only after the app has really been away for a while. Short interruptions —
    // a permission pop-up, the camera app for a selfie, the Face ID sheet, a quick call —
    // must not lock the app, or the screen reloads and the engineer loses their work.
    const LOCK_AFTER_MS = 60 * 1000;
    let wentAwayAt = null;
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        wentAwayAt = Date.now();
      } else if (wentAwayAt && Date.now() - wentAwayAt > LOCK_AFTER_MS) {
        wentAwayAt = null;
        setIsAppLocked(true);
      } else {
        wentAwayAt = null;
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [currentUser]);

  // Tell the server the app was opened today, so morning summaries can arrive at
  // this person's usual start time (server keeps only the first open per day)
  useEffect(() => {
    if (!currentUser?.id) return;
    const headers = { 'Content-Type': 'application/json', 'x-user-id': currentUser.id };
    const jwt = localStorage.getItem('token');
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}/activity`, { method: 'POST', headers }).catch(() => {});
  }, [currentUser?.id]);

  // Tapping a push notification opens the related case (engineer app)
  useEffect(() => {
    const open = (e) => {
      const caseId = e.detail?.caseId;
      setActiveTab('cases');
      setSelectedCaseId(caseId || null);
    };
    window.addEventListener('gcr_open_case', open);
    return () => window.removeEventListener('gcr_open_case', open);
  }, []);

  // Engineer Assistive Touch quick actions
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const onAction = (e) => {
      if (isAdminRole(currentUser)) return; // admin portal handles its own
      const { action, caseId } = e.detail || {};
      if (action === 'attendance') { setActiveTab('forms'); setSelectedCaseId(null); }
      else if (action === 'my_cases') { setActiveTab('cases'); setSelectedCaseId(null); }
      else if (action === 'home') { setActiveTab('dashboard'); setSelectedCaseId(null); }
      else if (action === 'open_case' && caseId) { setActiveTab('cases'); setSelectedCaseId(caseId); }
      else if (action === 'refresh') setRefreshKey((k) => k + 1);
    };
    window.addEventListener('gcr_quick_action', onAction);
    return () => window.removeEventListener('gcr_quick_action', onAction);
  }, [currentUser?.role]);

  // Engineer: unread office messages → red badge on the Chat tab
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    if (!currentUser?.id || isAdminRole(currentUser) || isBankRole(currentUser)) return undefined;
    const check = () => {
      if (document.hidden) return;
      fetch(`${API_BASE_URL}/api/chat/conversations`).then((r) => (r.ok ? r.json() : [])).then((d) => setChatUnread(Array.isArray(d) ? d.reduce((n, c) => n + (c.unread || 0), 0) : 0)).catch(() => {});
    };
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, [currentUser?.id, activeTab]);

  // Lets the floating Assistive Touch menu lock the app on demand
  useEffect(() => {
    const lock = () => { if (currentUser) setIsAppLocked(true); };
    window.addEventListener('gcr_lock_app', lock);
    return () => window.removeEventListener('gcr_lock_app', lock);
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAppLocked(false);
    localStorage.setItem('sbi_valuation_current_user_v3', JSON.stringify(user));
    if (cleanPath() === '/login') navigate('/');
  };

  const handleLogout = () => {
    unregisterPush(currentUser?.id); // stop this phone receiving the old user's alerts
    setCurrentUser(null);
    setIsAppLocked(false);
    localStorage.removeItem('sbi_valuation_current_user_v3');
    localStorage.removeItem('token');
    if (!Capacitor.isNativePlatform()) navigate('/login');
  };

  // Privacy policy, terms and account deletion are always reachable (store listings link to them)
  if (LEGAL[path]) {
    return <Suspense fallback={<PartLoading />}><PublicSite page={LEGAL[path]} onNavigate={navigate} loggedIn={!!currentUser} /></Suspense>;
  }

  if (!currentUser) {
    // Website visitors see the public site first; the phone app goes straight to login
    if (!Capacitor.isNativePlatform() && path !== '/login') {
      return <Suspense fallback={<PartLoading />}><PublicSite page="home" onNavigate={navigate} /></Suspense>;
    }
    return <><LaunchSplash /><LoginScreen onLogin={handleLogin} /></>;
  }

  // Bank employees: their own simple portal (requests + reports only)
  if (isBankRole(currentUser)) {
    return <Suspense fallback={<PartLoading />}><BankPortal currentUser={currentUser} handleLogout={handleLogout} /></Suspense>;
  }

  if (isAppLocked) {
    return <><LaunchSplash /><AppLock onUnlock={() => setIsAppLocked(false)} onFallback={handleLogout} /></>;
  }

  const permissionsOverlay = permScreen && (
    <PermissionsSetup currentUser={currentUser} fromSettings={permScreen === 'settings'} onDone={() => setPermScreen(null)} />
  );

  if (isAdminRole(currentUser)) {
    return (
      <>
        {/* Confirmations & errors (was missing on the admin side, so they never showed) */}
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#1c1c1e', color: '#fff', borderRadius: '14px', fontSize: '14px' } }} />
        <PushRegistration currentUser={currentUser} />
        <Suspense fallback={<PartLoading />}><AdminPortal currentUser={currentUser} handleLogout={handleLogout} /></Suspense>
        {permissionsOverlay}
      </>
    );
  }

  // Handle back button from case details
  const handleBack = () => {
    if (selectedCaseId) {
      setSelectedCaseId(null);
    }
  };

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} disabled={activeTab === 'chat' || !!permScreen}>
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' } }} />
      {permissionsOverlay}
      {/* Shares live GPS with the admin map while the engineer is on duty */}
      <PushRegistration currentUser={currentUser} />
      <Suspense fallback={null}>
        <LiveLocationReporter currentUser={currentUser} />
        {/* Assistive Touch with field-work actions */}
        <GlobalChatWidget currentUser={currentUser} unreadChats={chatUnread} />
      </Suspense>
      {/* Enterprise App Top Header */}
      {activeTab !== 'chat' && (
        <header className="top-header eng-navbar">
        <div className="eng-nav-left">
          {selectedCaseId ? (
            <button className="eng-back" onClick={handleBack} aria-label="Back to cases">
              <ArrowLeft size={22} /> <span>Cases</span>
            </button>
          ) : (
            <>
              <GcrLogo size={30} />
              <div className="eng-nav-stack">
                <span className="eng-nav-title">{({ forms: 'Today', cases: 'My Cases', dashboard: 'Dashboard', settings: 'Settings', logs: 'Attendance' })[activeTab] || 'Gouru Valuations'}</span>
                <span className="eng-nav-sub">{currentUser.branchInfo ? `${currentUser.branchInfo.name} Branch` : 'Field Engineer'}</span>
              </div>
            </>
          )}
        </div>

        <nav className="engineer-desktop-nav">
          <button
            className={`desktop-nav-link ${activeTab === 'forms' ? 'active' : ''}`}
            onClick={() => { setActiveTab('forms'); setSelectedCaseId(null); }}
          >
            <PenSquare size={16} />
            <span>Attendance</span>
          </button>
          <button
            className={`desktop-nav-link ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => { setActiveTab('cases'); }}
          >
            <ClipboardList size={16} />
            <span>Assigned Cases</span>
          </button>
          <button
            className={`desktop-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedCaseId(null); }}
          >
            <LayoutGrid size={16} />
            <span>Field Dashboard</span>
          </button>
          <button
            className={`desktop-nav-link ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => { setActiveTab('chat'); setSelectedCaseId(null); }}
          >
            <MessageCircle size={16} />
            <span>Direct Chat</span>
          </button>
          <button
            className={`desktop-nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setSelectedCaseId(null); }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="eng-nav-actions">
          <NotificationBell userId={currentUser.id} />
        </div>
      </header>
      )}

      {/* Main Scrollable Content */}
      <main key={refreshKey} className="main-content" style={activeTab === 'chat' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000 } : {}}>
        <Suspense fallback={<PartLoading />}>
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
          <AttendanceView 
            currentUser={currentUser} 
            onOpenCase={(id) => { setSelectedCaseId(id); setActiveTab('cases'); }}
          />
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
        </Suspense>
      </main>

      {/* Persistent Mobile Bottom Tab Bar */}
      {activeTab !== 'chat' && (
      <nav className="bottom-tab-bar ios-tabbar" aria-label="Main">
        {[
          { key: 'forms', label: 'Today', Icon: CalendarIcon, go: () => { setActiveTab('forms'); setSelectedCaseId(null); } },
          { key: 'cases', label: 'Cases', Icon: DocIcon, go: () => setActiveTab('cases') },
          { key: 'dashboard', label: 'Dashboard', Icon: GridIcon, go: () => { setActiveTab('dashboard'); setSelectedCaseId(null); } },
          { key: 'chat', label: 'Chat', Icon: ChatIcon, go: () => { setActiveTab('chat'); setSelectedCaseId(null); } },
          { key: 'settings', label: 'Settings', Icon: GearIcon, go: () => { setActiveTab('settings'); setSelectedCaseId(null); } },
        ].map(({ key, label, Icon, go }) => (
          <button
            key={key}
            className={`tab-item ios-tab ${activeTab === key ? 'active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={go}
          >
            <span className="ios-tab-icon-wrap">
              <Icon active={activeTab === key} />
              {key === 'chat' && chatUnread > 0 && <span className="ios-tab-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      )}
    </div>
    </PullToRefresh>
  );
}
