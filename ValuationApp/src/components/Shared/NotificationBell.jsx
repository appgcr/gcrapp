import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Check } from 'lucide-react';
import './NotificationBell.css';

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const hasInitialLoaded = useRef(false);
  const prevUnreadIdsRef = useRef(new Set());

  const playSound = () => {
    try {
      // Crisp, standard notification pop sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio play prevented by browser policy'));
    } catch (e) {
      console.log('Audio error', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (userId === 'ADMIN') {
        const [casesRes, attRes] = await Promise.all([
          fetch('https://gcr-9ys1.onrender.com/api/cases'),
          fetch('https://gcr-9ys1.onrender.com/api/attendance')
        ]);
        const cases = await casesRes.json();
        const attendance = await attRes.json();
        
        const generated = [];
        
        cases.forEach(c => {
          if (c.status === 'Approved') {
            generated.push({ _id: `case-app-${c.id}`, title: 'Case Approved', message: `Case ${c.id} was approved.`, createdAt: c.createdAt || Date.now() });
          } else if (!c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED') {
            generated.push({ _id: `case-new-${c.id}`, title: 'New Request', message: `New Form ${c.id} submitted.`, createdAt: c.createdAt || Date.now() });
          } else if (c.status === 'Pending') {
            generated.push({ _id: `case-pend-${c.id}`, title: 'Task Pending', message: `Case ${c.id} is pending review.`, createdAt: c.createdAt || Date.now() });
          }
        });
        
        attendance.forEach(a => {
          generated.push({
            _id: `att-${a.id || a._id || Math.random()}`,
            title: `Staff ${a.attendanceType === 'Clock-In' ? 'Clock-In' : 'Clock-Out'}`,
            message: `${a.name} (${a.id}) has ${a.attendanceType === 'Clock-In' ? 'clocked in' : 'clocked out'}.`,
            createdAt: a.timestamp
          });
        });
        
        generated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const recentNotifications = generated.slice(0, 20); // Keep top 20
        
        const readIds = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
        
        const mappedData = recentNotifications.map(n => ({
          ...n,
          isRead: readIds.includes(n._id)
        }));
        
        const currentUnreadIds = new Set(mappedData.filter(n => !n.isRead).map(n => n._id));
        
        if (hasInitialLoaded.current) {
          const newUnread = mappedData.filter(n => !n.isRead && !prevUnreadIdsRef.current.has(n._id));
          
          if (newUnread.length > 0) {
            playSound();
            newUnread.forEach(n => {
              const toastId = Date.now() + Math.random();
              setToasts(t => [...t, { ...n, toastId }]);
              setTimeout(() => {
                setToasts(t => t.filter(x => x.toastId !== toastId));
              }, 5000);
            });
          }
        }
        
        prevUnreadIdsRef.current = currentUnreadIds;
        setNotifications(mappedData);
        hasInitialLoaded.current = true;
      } else {
        // Fallback for non-admin if needed
        const res = await fetch(`https://gcr-9ys1.onrender.com/api/notifications/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
          hasInitialLoaded.current = true;
        }
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // sync with 10s dashboard polling
    return () => clearInterval(interval);
  }, [userId]);

  const markAsRead = async (id) => {
    if (userId === 'ADMIN') {
      const readIds = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('admin_read_notifications', JSON.stringify(readIds));
      }
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } else {
      try {
        await fetch(`https://gcr-9ys1.onrender.com/api/notifications/${id}/read`, { method: 'PUT' });
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
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="notification-container">
      {/* The Bell Icon */}
      <button className="admin-header-icon notification-bell" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={24} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Notifications</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              {unreadCount > 0 && <button onClick={markAllAsRead} style={{ fontSize: '11px', color: '#0346c8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Mark all read</button>}
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
            </div>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet.</div>
            ) : (
              notifications.map(n => {
                const parts = n.message.split('|IMG|');
                const textMessage = parts[0];
                const imageUrl = parts[1];
                
                return (
                  <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`} onClick={() => !n.isRead && markAsRead(n._id)}>
                    <div className="notification-content">
                      <h4>{n.title}</h4>
                      <p>{textMessage}</p>
                      {imageUrl && (
                        <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0', maxHeight: '120px' }}>
                          <img src={imageUrl} alt="Attached" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <span className="notification-time">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    {!n.isRead && (
                      <div className="notification-read-btn">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Toasts (WhatsApp / Instagram style) rendered via Portal */}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => {
            const parts = t.message.split('|IMG|');
            const textMessage = parts[0];
            const imageUrl = parts[1];
            
            return (
              <div key={t.toastId} className="toast-message">
                <div className="toast-icon">
                  <Bell size={20} color="#fff" />
                </div>
                <div className="toast-text">
                  <h4>{t.title}</h4>
                  <p>{textMessage}</p>
                  {imageUrl && <div style={{ fontSize: '10px', color: '#0346c8', marginTop: '4px', fontWeight: '600' }}>📸 View attachment in panel</div>}
                </div>
                <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.toastId !== t.toastId))}>
                  <X size={14} />
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
