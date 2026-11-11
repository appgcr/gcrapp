import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, FilePlus2, CheckCircle2, Hourglass, LogIn, LogOut, Megaphone, Sunrise, Layers, AlertTriangle, MapPin, Clock, RotateCcw } from 'lucide-react';
import IconTile from './IconTile';
import './NotificationBell.css';

// iOS Notification Center–style panel + banner toasts.
// Admin: generated from live cases and Clock-In/Clock-Out records (read state kept on device).
// Engineer: server notifications from /api/notifications/:userId.

const kindOf = (n) => {
  const t = (n.title || '').toLowerCase();
  if (t.includes('announcement')) return { icon: Megaphone, color: 'orange' };
  if (t.includes('approved')) return { icon: CheckCircle2, color: 'green' };
  if (t.includes('pending')) return { icon: Hourglass, color: 'orange' };
  if (t.includes('new request')) return { icon: FilePlus2, color: 'blue' };
  if (t.includes('clock-in')) return { icon: LogIn, color: 'green' };
  if (t.includes('clock-out')) return { icon: LogOut, color: 'gray' };
  if (t.startsWith('good morning')) return { icon: Sunrise, color: 'orange' };
  if (t.includes('updates while you were away')) return { icon: Layers, color: 'indigo' };
  if (t.includes('overdue') || t.includes('waiting')) return { icon: AlertTriangle, color: 'red' };
  if (t.includes('inspection')) return { icon: MapPin, color: 'blue' };
  if (t.includes('checked in') || t.includes('check')) return { icon: Clock, color: 'green' };
  if (t.includes('returned') || t.includes('rejected')) return { icon: RotateCcw, color: 'purple' };
  if (t.includes('assigned') || t.includes('review') || t.includes('submitted')) return { icon: FilePlus2, color: 'blue' };
  return { icon: Bell, color: 'red' };
};

const relTime = (d) => {
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
const cleanTitle = (title = '') => title.replace(/^[^\p{L}\p{N}]+/u, '').trim(); // drop leading emoji

export default function NotificationBell({ userId, currentUserId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const hasInitialLoaded = useRef(false);
  const prevUnreadIdsRef = useRef(new Set());

  const playSound = () => {
    if (localStorage.getItem('gcr_alert_sound') === 'false') return; // muted in Assistive Touch › Controls
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    } catch { /* ignore */ }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      if (userId === 'ADMIN') {
        const [casesRes, attRes, srvAdminRes, srvMineRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/cases`),
          fetch(`${API_BASE_URL}/api/attendance`),
          fetch(`${API_BASE_URL}/api/notifications/ADMIN`),
          currentUserId ? fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(currentUserId)}`) : Promise.resolve(null),
        ]);
        const cases = await casesRes.json();
        const attendance = await attRes.json();
        // Server alerts for admins: morning summary, overdue warnings, report submitted, etc.
        // ('case_created' is skipped — the "New Request" item below already covers it)
        const serverItems = [];
        for (const r of [srvAdminRes, srvMineRes]) {
          if (r && r.ok) {
            const rows = await r.json();
            rows.filter(n => n.type !== 'case_created' && n.type !== 'chat_message').forEach(n => serverItems.push({
              _id: n._id, title: n.title, message: n.message, createdAt: n.createdAt, serverRead: !!n.isRead, server: true,
            }));
          }
        }

        const generated = [];
        cases.forEach(c => {
          const who = c.clientName ? ` · ${c.clientName}` : '';
          if (c.status === 'Approved') {
            generated.push({ _id: `case-app-${c.id}`, title: 'Case Approved', message: `Case ${c.fileNumber || `#${c.id}`}${who} was approved.`, createdAt: c.createdAt });
          } else if (!c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED') {
            generated.push({ _id: `case-new-${c.id}`, title: 'New Request', message: `Case ${c.fileNumber || `#${c.id}`}${who} needs a valuer.`, createdAt: c.createdAt });
          } else if (c.status === 'Pending') {
            const eng = c.assignedEngineerName && c.assignedEngineerName !== 'Unknown' ? c.assignedEngineerName : 'an engineer';
            generated.push({ _id: `case-pend-${c.id}`, title: 'Case Assigned', message: `Case ${c.fileNumber || `#${c.id}`}${who} is with ${eng} for inspection.`, createdAt: c.createdAt });
          }
        });

        // Only real check-ins / check-outs. Live GPS "Location Update" pings are NOT notifications.
        attendance
          .filter(a => a.attendanceType === 'Clock-In' || a.attendanceType === 'Clock-Out')
          .forEach(a => {
            const isIn = a.attendanceType === 'Clock-In';
            generated.push({
              _id: `att-${a.id || a._id}`,
              title: isIn ? 'Staff Clock-In' : 'Staff Clock-Out',
              message: `${a.name || 'An engineer'} ${isIn ? 'checked in' : 'checked out'}${a.address ? ` near ${a.address.split(',')[0]}` : ''}.`,
              createdAt: a.timestamp
            });
          });

        generated.push(...serverItems);
        generated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const recent = generated.slice(0, 30);
        const readIds = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
        const mapped = recent.map(n => ({ ...n, isRead: n.serverRead || readIds.includes(n._id) }));
        const currentUnreadIds = new Set(mapped.filter(n => !n.isRead).map(n => n._id));

        if (hasInitialLoaded.current) {
          const fresh = mapped.filter(n => !n.isRead && !prevUnreadIdsRef.current.has(n._id));
          if (fresh.length > 0) {
            playSound();
            fresh.slice(0, 3).forEach(n => {
              const toastId = Date.now() + Math.random();
              setToasts(t => [...t, { ...n, toastId }]);
              setTimeout(() => setToasts(t => t.filter(x => x.toastId !== toastId)), 5000);
            });
          }
        }
        prevUnreadIdsRef.current = currentUnreadIds;
        setNotifications(mapped);
        hasInitialLoaded.current = true;
      } else {
        const res = await fetch(`${API_BASE_URL}/api/notifications/${userId}`);
        if (res.ok) {
          // Chat messages live in Chat (and as phone alerts), not in this list
          setNotifications((await res.json()).filter(n => n.type !== 'chat_message'));
          hasInitialLoaded.current = true;
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [userId, currentUserId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    // A push arrived while the app is open → refresh now
    window.addEventListener('gcr_refresh_notifications', fetchNotifications);
    return () => { clearInterval(interval); window.removeEventListener('gcr_refresh_notifications', fetchNotifications); };
  }, [fetchNotifications]);

  // Assistive Touch › Notifications opens this panel
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('gcr_open_notifications', open);
    return () => window.removeEventListener('gcr_open_notifications', open);
  }, []);

  // Close on Escape; lock page scroll while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [isOpen]);

  const markAsRead = async (id) => {
    if (userId === 'ADMIN') {
      const readIds = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('admin_read_notifications', JSON.stringify(readIds));
      }
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      // Server-stored admin alerts are also marked read on the server
      if (/^[a-f0-9]{24}$/i.test(String(id))) {
        fetch(`${API_BASE_URL}/api/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
      }
    } else {
      try {
        await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, { method: 'PUT' });
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const markAllAsRead = () => {
    if (userId === 'ADMIN') {
      const readIds = notifications.map(n => n._id);
      localStorage.setItem('admin_read_notifications', JSON.stringify(readIds));
      notifications.filter(n => n.server && !n.isRead).forEach(n => {
        fetch(`${API_BASE_URL}/api/notifications/${n._id}/read`, { method: 'PUT' }).catch(() => {});
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } else {
      notifications.filter(n => !n.isRead).forEach(n => markAsRead(n._id));
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const today = notifications.filter(n => isToday(n.createdAt));
  const earlier = notifications.filter(n => !isToday(n.createdAt));

  const renderCard = (n) => {
    const [textMessage, imageUrl] = (n.message || '').split('|IMG|');
    const { icon, color } = kindOf(n);
    return (
      <button
        key={n._id}
        className={`nc-card ${n.isRead ? '' : 'is-unread'}`}
        onClick={() => !n.isRead && markAsRead(n._id)}
        aria-label={`${cleanTitle(n.title)}. ${textMessage}${n.isRead ? '' : '. Unread, tap to mark as read'}`}
      >
        <IconTile icon={icon} color={color} size={38} />
        <div className="nc-body">
          <div className="nc-top">
            <span className="nc-title">{cleanTitle(n.title)}</span>
            <span className="nc-time">{relTime(n.createdAt)}</span>
          </div>
          <p className="nc-msg">{textMessage}</p>
          {imageUrl && <img className="nc-img" src={imageUrl} alt="Attachment" />}
        </div>
        {!n.isRead && <span className="nc-dot" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="notification-container">
      <button
        className="admin-header-icon notification-bell"
        onClick={() => setIsOpen(o => !o)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell size={24} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && createPortal(
        <div className="nc-backdrop" onClick={() => setIsOpen(false)}>
          <div className="nc-panel" role="dialog" aria-modal="true" aria-label="Notifications" onClick={(e) => e.stopPropagation()}>
            <div className="nc-head">
              <h2>Notifications</h2>
              <div className="nc-head-actions">
                {unreadCount > 0 && <button className="nc-pill" onClick={markAllAsRead}>Mark all read</button>}
                <button className="nc-close" onClick={() => setIsOpen(false)} aria-label="Close notifications"><X size={18} strokeWidth={2.6} /></button>
              </div>
            </div>

            <div className="nc-list">
              {notifications.length === 0 ? (
                <div className="nc-empty">
                  <IconTile icon={Bell} color="gray" size={48} />
                  <strong>No Notifications</strong>
                  <span>You're all caught up.</span>
                </div>
              ) : (
                <>
                  {today.length > 0 && <div className="nc-group">Today</div>}
                  {today.map(renderCard)}
                  {earlier.length > 0 && <div className="nc-group">Earlier</div>}
                  {earlier.map(renderCard)}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* iOS-style banners for new notifications */}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => {
            const [textMessage, imageUrl] = (t.message || '').split('|IMG|');
            const { icon, color } = kindOf(t);
            return (
              <div key={t.toastId} className="nc-banner" role="status">
                <IconTile icon={icon} color={color} size={38} />
                <div className="nc-body">
                  <div className="nc-top">
                    <span className="nc-title">{cleanTitle(t.title)}</span>
                    <span className="nc-time">now</span>
                  </div>
                  <p className="nc-msg">{textMessage}{imageUrl ? ' · Photo' : ''}</p>
                </div>
                <button className="nc-banner-close" onClick={() => setToasts(prev => prev.filter(x => x.toastId !== t.toastId))} aria-label="Dismiss">
                  <X size={14} strokeWidth={2.6} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
