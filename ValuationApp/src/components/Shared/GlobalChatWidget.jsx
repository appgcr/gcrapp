import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, ChevronLeft, Bell, Home, Search, SlidersHorizontal,
  MessageCircle, FilePlus2, Megaphone, MapPinned, ClipboardCheck,
  Lock, RefreshCw, ArrowUpToLine, EyeOff, Maximize, Minimize,
  BellRing, Moon, Volume2, VolumeX, AlarmClock, CalendarCheck, MoreHorizontal,
  Navigation, Phone, MapPin, FolderOpen, Sun,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import ChatSystem from './ChatSystem';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from './authHeaders';
import { isAdminRole, isSuperAdmin } from '../../utils/session';

// GCR Assistive Touch — modelled on iPhone (Settings › Accessibility › Touch › AssistiveTouch).
//
//  Button  · tap = open menu · double-tap = Back to Top · long-press = Messages
//          · drag anywhere, snaps to the nearest side · fades when idle · red badge for unread chats
//  Menu    · the same top-level layout as iPhone:
//                         Notifications
//              Work                        Device
//              Search        Home          Controls
//          · Work / Device / Controls open sub-menus; the centre becomes a Back arrow
//          · tap outside or press Esc to close

const BTN = 50;
const EDGE = 8;
const PANEL = 300;
const DOUBLE_TAP_MS = 260;
const LONG_PRESS_MS = 550;
const STORAGE_POS = 'gcr_assistive_pos';
const STORAGE_ENABLED = 'gcr_whatsapp_float_enabled'; // Settings switch key

const clampY = (y) => Math.max(EDGE + 60, Math.min(y, window.innerHeight - BTN - EDGE - 70));
const snapX = (x) => (x + BTN / 2 < window.innerWidth / 2 ? EDGE : window.innerWidth - BTN - EDGE);

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_POS) || 'null');
    if (saved && typeof saved.y === 'number') {
      return { x: saved.side === 'left' ? EDGE : window.innerWidth - BTN - EDGE, y: clampY(saved.y) };
    }
  } catch { /* ignore */ }
  return { x: window.innerWidth - BTN - EDGE, y: clampY(window.innerHeight - 200) };
}

const quick = (a) => window.dispatchEvent(new CustomEvent('gcr_quick_action', { detail: typeof a === 'string' ? { action: a } : a }));

export default function GlobalChatWidget({ currentUser, unreadChats = 0 }) {
  const [isEnabled, setIsEnabled] = useState(() => localStorage.getItem(STORAGE_ENABLED) !== 'false');
  const [hiddenForSession, setHiddenForSession] = useState(() => { try { return sessionStorage.getItem('gcr_at_hidden') === '1'; } catch { return false; } });
  const [position, setPosition] = useState(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [menu, setMenu] = useState(null); // null | 'root' | 'work' | 'device' | 'controls'
  const [showMini, setShowMini] = useState(false);
  const [idle, setIdle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [controls, setControls] = useState({
    browserAlerts: localStorage.getItem('admin_push_notifications') !== 'false',
    sound: localStorage.getItem('gcr_alert_sound') !== 'false',
    quietHours: null,  // loaded from the server when Controls opens
    reminders: null,
  });

  const panelRef = useRef(null);
  const pointer = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const idleTimer = useRef(null);
  const tapTimer = useRef(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  const native = Capacitor.isNativePlatform?.();
  const isAdmin = isAdminRole(currentUser);
  const [nextVisit, setNextVisit] = useState(undefined); // engineer: undefined = loading, null = none
  const [dark, setDark] = useState(() => document.body.classList.contains('dark-theme'));

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 3000);
  }, []);

  useEffect(() => { wake(); return () => clearTimeout(idleTimer.current); }, [wake]);

  // Settings switch (also undoes a temporary "Hide")
  useEffect(() => {
    const handleToggle = (e) => {
      const on = typeof e?.detail === 'boolean' ? e.detail : localStorage.getItem(STORAGE_ENABLED) !== 'false';
      setIsEnabled(on);
      if (on) {
        setHiddenForSession(false);
        try { sessionStorage.removeItem('gcr_at_hidden'); } catch { /* ignore */ }
      }
    };
    window.addEventListener('gcr_whatsapp_toggle', handleToggle);
    window.addEventListener('storage', handleToggle);
    return () => {
      window.removeEventListener('gcr_whatsapp_toggle', handleToggle);
      window.removeEventListener('storage', handleToggle);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPosition((p) => ({ x: snapX(p.x), y: clampY(p.y) }));
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs); };
  }, []);

  // Esc: back out of a sub-menu first, then close (like iPhone)
  useEffect(() => {
    if (!menu && !showMini) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menu && menu !== 'root') setMenu('root');
      else { setMenu(null); setShowMini(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, showMini]);

  // Focus the first item whenever a (sub-)menu opens
  useEffect(() => {
    if (!menu) return undefined;
    const t = setTimeout(() => panelRef.current?.querySelector('[role="menuitem"]')?.focus(), 40);
    return () => clearTimeout(t);
  }, [menu]);

  // Controls: read the server-side switches when that page opens (admin only)
  useEffect(() => {
    if (menu !== 'controls' || !isAdmin) return;
    fetch(`${API_BASE_URL}/api/config/reminders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setControls((c) => ({ ...c, quietHours: !!s.quietHours?.enabled, reminders: !!s.enabled })))
      .catch(() => {});
  }, [menu]);

  // Engineer: find the next inspection when the menu opens (for Next Visit / Navigate / Call)
  useEffect(() => {
    if (isAdmin || menu !== 'root' || !currentUser?.id) return;
    let alive = true;
    fetch(`${API_BASE_URL}/api/cases?engineerId=${encodeURIComponent(currentUser.id)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!alive) return;
        const open = (Array.isArray(rows) ? rows : []).filter((c) => !['Approved', 'Rejected'].includes(c.status));
        const when = (c) => {
          if (!c.inspectionDate) return null;
          const d = new Date(`${String(c.inspectionDate).slice(0, 10)}T${(c.inspectionTime || '09:00').slice(0, 5)}`);
          return Number.isNaN(d.getTime()) ? null : d;
        };
        const soon = Date.now() - 2 * 3600 * 1000; // include a visit that started up to 2 hrs ago
        const upcoming = open.map((c) => ({ c, at: when(c) })).filter((x) => x.at && x.at.getTime() >= soon).sort((a, b) => a.at - b.at);
        const pick = upcoming[0] || (open[0] ? { c: open[0], at: when(open[0]) } : null);
        setNextVisit(pick);
      })
      .catch(() => alive && setNextVisit(null));
    return () => { alive = false; };
  }, [menu, isAdmin, currentUser?.id]);

  // ---------- actions ----------
  const close = () => { setMenu(null); wake(); };
  const scrollToTop = () => {
    document.querySelectorAll('.admin-main-content, .main-content').forEach((el) => {
      if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openMessages = () => { setMenu(null); setShowMini(true); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast.error('Full screen is not available here'); }
  };
  const hide = () => {
    setHiddenForSession(true);
    try { sessionStorage.setItem('gcr_at_hidden', '1'); } catch { /* ignore */ }
    toast('Assistive Touch hidden. Bring it back in Settings › Assistive Touch, or reopen the app.', { duration: 4500 });
  };
  const setServerSwitch = async (key, value) => {
    const body = key === 'quietHours' ? { quietHours: { enabled: value } } : { enabled: value };
    setControls((c) => ({ ...c, [key]: value }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/reminders`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      toast.success(`${key === 'quietHours' ? 'Quiet hours' : 'Automatic reminders'} ${value ? 'on' : 'off'}`, { duration: 1400 });
    } catch {
      setControls((c) => ({ ...c, [key]: !value }));
      toast.error('Could not change the setting');
    }
  };
  const setLocalSwitch = (key, storageKey, value, label) => {
    localStorage.setItem(storageKey, String(value));
    setControls((c) => ({ ...c, [key]: value }));
    if (key === 'browserAlerts' && value && window.Notification && Notification.permission === 'default') Notification.requestPermission();
    toast.success(`${label} ${value ? 'on' : 'off'}`, { duration: 1400 });
  };

  // ---------- menus (9 cells each; 4 = centre) ----------
  const item = (key, label, Icon, onClick, extra = {}) => ({ key, label, Icon, onClick, ...extra });
  const run = (fn) => () => { close(); fn(); };

  const deviceItem = native
    ? item('lock', 'Lock Screen', Lock, run(() => window.dispatchEvent(new CustomEvent('gcr_lock_app'))))
    : item('fs', isFullscreen ? 'Exit Full Screen' : 'Full Screen', isFullscreen ? Minimize : Maximize, run(toggleFullscreen));
  const refreshItem = item('refresh', 'Refresh', RefreshCw, run(() => { quick('refresh'); toast.success('Updated', { duration: 1200 }); }));
  const topItem = item('top', 'Back to Top', ArrowUpToLine, run(scrollToTop));
  const hideItem = item('hide', 'Hide Button', EyeOff, run(hide));
  const notifItem = item('notifications', 'Notifications', Bell, run(() => window.dispatchEvent(new Event('gcr_open_notifications'))));
  const homeItem = item('home', 'Home', Home, run(() => quick('home')));
  const moreCell = item('more', 'More', MoreHorizontal, () => setMenu('more'));

  // Engineer field actions use the next inspection
  const v = nextVisit;
  const visitLabel = v === undefined ? 'Loading…' : v ? (v.c.clientName || `Case #${v.c.id}`).split(' ').slice(-1)[0] : 'No visit';
  const address = v?.c ? (v.c.address || v.c.locationData || '') : '';
  const fieldMenu = [
    item('attendance', 'Attendance', CalendarCheck, run(() => quick('attendance'))),
    item('visit', v ? `Next: ${visitLabel}` : 'Next Visit', MapPin, run(() => v && quick({ action: 'open_case', caseId: v.c.id })), { loading: !v }),
    item('navigate', 'Navigate', Navigation, run(() => address && window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank', 'noopener')), { loading: !address }),
    item('call', 'Call Client', Phone, run(() => { if (v?.c?.clientPhone) window.location.href = `tel:${v.c.clientPhone}`; }), { loading: !v?.c?.clientPhone }),
    moreCell,
    item('messages', 'Message Admin', MessageCircle, openMessages, { badge: unreadChats }),
    item('mycases', 'My Cases', FolderOpen, run(() => quick('my_cases'))), homeItem, notifItem,
  ];

  const MENUS = isAdmin ? {
    // Work first: the admin's daily valuation actions on the first screen
    root: [
      item('messages', 'Messages', MessageCircle, openMessages, { badge: unreadChats }), item('new', 'New Case', FilePlus2, run(() => quick('new_case'))), item('review', 'Review Queue', ClipboardCheck, run(() => quick('review_queue'))),
      item('search', 'Search', Search, run(() => quick('find_case'))), moreCell, notifItem,
      item('map', 'Live Map', MapPinned, run(() => quick('live_map'))), homeItem, item('controls', 'Controls', SlidersHorizontal, () => setMenu('controls')),
    ],
    more: [
      item('broadcast', 'Announce', Megaphone, run(() => quick('broadcast'))), item('attendance', 'Attendance', CalendarCheck, run(() => quick('attendance'))), refreshItem,
      topItem, 'back', deviceItem,
      null, hideItem, null,
    ],
    controls: [
      null, item('browserAlerts', 'Desktop Alerts', BellRing, () => setLocalSwitch('browserAlerts', 'admin_push_notifications', !controls.browserAlerts, 'Desktop alerts'), { on: controls.browserAlerts }), null,
      item('sound', controls.sound ? 'Sound' : 'Muted', controls.sound ? Volume2 : VolumeX, () => setLocalSwitch('sound', 'gcr_alert_sound', !controls.sound, 'Alert sound'), { on: controls.sound }), 'back',
      // Quiet hours & reminders are company-wide → only the Super Admin can switch them
      isSuperAdmin(currentUser) ? item('quiet', 'Quiet Hours', Moon, () => controls.quietHours !== null && setServerSwitch('quietHours', !controls.quietHours), { on: controls.quietHours, loading: controls.quietHours === null }) : null,
      null, isSuperAdmin(currentUser) ? item('reminders', 'Reminders', AlarmClock, () => controls.reminders !== null && setServerSwitch('reminders', !controls.reminders), { on: controls.reminders, loading: controls.reminders === null }) : null, null,
    ],
  } : {
    root: fieldMenu,
    more: [
      refreshItem, topItem, item('dark', dark ? 'Light Mode' : 'Dark Mode', dark ? Sun : Moon, () => {
        document.body.classList.toggle('dark-theme');
        setDark(document.body.classList.contains('dark-theme'));
      }, { on: dark }),
      item('sound', controls.sound ? 'Sound' : 'Muted', controls.sound ? Volume2 : VolumeX, () => setLocalSwitch('sound', 'gcr_alert_sound', !controls.sound, 'Alert sound'), { on: controls.sound }), 'back', deviceItem,
      null, hideItem, null,
    ],
  };

  const onPanelKey = (e) => {
    const items = [...(panelRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    const i = items.indexOf(document.activeElement);
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  };

  // ---------- button gestures ----------
  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {          // long-press → Messages
      if (!pointer.current.moved) {
        longPressed.current = true;
        if (navigator.vibrate) navigator.vibrate(25);
        clearTimeout(tapTimer.current); tapTimer.current = null;
        openMessages();
      }
    }, LONG_PRESS_MS);
    wake();
  };

  const handlePointerMove = (e) => {
    const p = pointer.current;
    if (!p.active) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.moved && Math.hypot(dx, dy) < 6) return;
    p.moved = true;
    clearTimeout(pressTimer.current);
    setIsDragging(true);
    setPosition({
      x: Math.max(EDGE, Math.min(p.originX + dx, window.innerWidth - BTN - EDGE)),
      y: Math.max(EDGE, Math.min(p.originY + dy, window.innerHeight - BTN - EDGE)),
    });
  };

  const handlePointerUp = (e) => {
    const p = pointer.current;
    if (!p.active) return;
    p.active = false;
    clearTimeout(pressTimer.current);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    if (p.moved) {
      setPosition((pos) => {
        const next = { x: snapX(pos.x), y: clampY(pos.y) };
        try { localStorage.setItem(STORAGE_POS, JSON.stringify({ side: next.x === EDGE ? 'left' : 'right', y: next.y })); } catch { /* ignore */ }
        return next;
      });
      setIsDragging(false);
    } else if (!longPressed.current) {
      if (tapTimer.current) {                         // second tap → Back to Top
        clearTimeout(tapTimer.current); tapTimer.current = null;
        if (navigator.vibrate) navigator.vibrate(10);
        scrollToTop();
      } else {                                        // single tap → menu (after the double-tap window)
        tapTimer.current = setTimeout(() => {
          tapTimer.current = null;
          if (navigator.vibrate) navigator.vibrate(12);
          setShowMini(false);
          setMenu('root');
        }, DOUBLE_TAP_MS);
      }
    }
    wake();
  };

  if (!isEnabled || hiddenForSession) return null;

  const origin = `${Math.round(position.x + BTN / 2 - (window.innerWidth - PANEL) / 2)}px ${Math.round(position.y + BTN / 2 - (window.innerHeight - PANEL) / 2)}px`;
  const cells = menu ? MENUS[menu] : [];

  return (
    <>
      {menu && (
        <div className="gcr-at-backdrop" onClick={() => setMenu(null)}>
          <div
            ref={panelRef}
            className={`gcr-at-panel ${menu !== 'root' ? 'is-sub' : ''}`}
            key={menu}
            role="menu"
            aria-label={menu === 'root' ? 'Assistive Touch' : `Assistive Touch – ${menu}`}
            style={menu === 'root' ? { transformOrigin: origin } : undefined}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onPanelKey}
          >
            {cells.map((c, i) => {
              if (c === 'back') {
                return (
                  <button key="back" role="menuitem" className="gcr-at-item" onClick={() => setMenu('root')} aria-label="Back">
                    <span className="gcr-at-glyph"><ChevronLeft size={34} strokeWidth={2} /></span>
                  </button>
                );
              }
              if (!c) return <span key={`gap${i}`} aria-hidden="true" />;
              const { Icon } = c;
              const isToggle = Object.prototype.hasOwnProperty.call(c, 'on'); // switches look like Control Center toggles
              return (
                <button
                  key={c.key}
                  role="menuitem"
                  className={`gcr-at-item ${isToggle ? 'is-toggle' : ''} ${c.on ? 'is-on' : ''}`}
                  onClick={c.onClick}
                  disabled={c.loading}
                  aria-pressed={isToggle ? !!c.on : undefined}
                  aria-label={c.badge ? `${c.label}, ${c.badge} unread` : c.label}
                >
                  <span className="gcr-at-glyph">
                    <Icon size={isToggle ? 22 : 30} strokeWidth={1.7} />
                    {c.badge > 0 && <span className="gcr-at-badge">{c.badge > 99 ? '99+' : c.badge}</span>}
                  </span>
                  <span className="gcr-at-label">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showMini && (
        <div className="gcr-at-mini">
          {/* The chat draws its own header (with a back/close button) */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <ChatSystem currentUser={currentUser} otherUserId={isAdmin ? undefined : 'ADMIN'} isMini={true} onBack={() => setShowMini(false)} />
          </div>
        </div>
      )}

      {!menu && (
        <div
          role="button"
          aria-label={`Assistive Touch${unreadChats ? `, ${unreadChats} unread messages` : ''}. Tap for menu, double-tap for top, hold for messages`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenu('root'); } }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onMouseEnter={wake}
          className="gcr-at-button"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            opacity: idle && !isDragging && !unreadChats ? 0.38 : 1,
            cursor: isDragging ? 'grabbing' : 'pointer',
            transition: isDragging ? 'opacity 0.2s' : 'left 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), top 0.25s, opacity 0.4s, transform 0.12s',
          }}
        >
          <span className="gcr-at-ring gcr-at-ring-1" />
          <span className="gcr-at-ring gcr-at-ring-2" />
          <span className="gcr-at-ring gcr-at-dot" />
          {unreadChats > 0 && <span className="gcr-at-badge gcr-at-badge-btn">{unreadChats > 99 ? '99+' : unreadChats}</span>}
        </div>
      )}

      <style>{`
        .gcr-at-button {
          position: fixed; width: ${BTN}px; height: ${BTN}px; border-radius: 14px;
          background: rgba(20, 20, 24, 0.62);
          -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
          z-index: 10000; touch-action: none; user-select: none; -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
        }
        .gcr-at-button:active { transform: scale(0.92); }
        .gcr-at-button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
        .gcr-at-ring { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
        .gcr-at-ring-1 { width: 36px; height: 36px; background: rgba(255, 255, 255, 0.22); }
        .gcr-at-ring-2 { width: 28px; height: 28px; background: rgba(255, 255, 255, 0.38); }
        .gcr-at-dot    { width: 20px; height: 20px; background: rgba(255, 255, 255, 0.95); }

        .gcr-at-backdrop {
          position: fixed; inset: 0; z-index: 10001; background: rgba(0, 0, 0, 0.12);
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: gcrAtFade 0.18s ease-out;
        }
        /* iPhone panel: near-black frosted square, white glyphs, no icon backgrounds */
        .gcr-at-panel {
          width: min(${PANEL}px, 100%); aspect-ratio: 1 / 1; border-radius: 34px;
          background: rgba(10, 10, 12, 0.78);
          -webkit-backdrop-filter: blur(24px) saturate(150%); backdrop-filter: blur(24px) saturate(150%);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
          display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
          padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif;
          animation: gcrAtPop 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.12);
        }
        .gcr-at-panel.is-sub { animation: gcrAtSub 0.2s ease-out; }
        .gcr-at-item {
          background: none; border: none; border-radius: 18px; color: #fff; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          font-family: inherit; padding: 4px; -webkit-tap-highlight-color: transparent; position: relative;
        }
        .gcr-at-item:hover, .gcr-at-item:focus-visible { background: rgba(255, 255, 255, 0.1); outline: none; }
        .gcr-at-item:active { background: rgba(255, 255, 255, 0.18); }
        .gcr-at-item:disabled { opacity: 0.4; cursor: default; }
        .gcr-at-glyph { position: relative; display: inline-flex; align-items: center; justify-content: center; height: 34px; }
        .gcr-at-label { font-size: 12px; font-weight: 500; line-height: 1.15; text-align: center; letter-spacing: -0.1px; }

        /* Controls: round toggles like Control Center (white when on) */
        .gcr-at-item.is-toggle .gcr-at-glyph {
          width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 255, 255, 0.16); transition: background 0.18s, color 0.18s;
        }
        .gcr-at-item.is-toggle.is-on .gcr-at-glyph { background: #fff; color: #0a84ff; }
        .gcr-at-item.is-toggle:hover, .gcr-at-item.is-toggle:focus-visible { background: rgba(255, 255, 255, 0.06); }

        .gcr-at-badge {
          position: absolute; top: -4px; right: -10px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
          border-radius: 9px; background: #ff3b30; color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
          border: 1.5px solid rgba(10, 10, 12, 0.9); font-variant-numeric: tabular-nums;
        }
        .gcr-at-badge-btn { top: -5px; right: -5px; border-color: #fff; }

        .gcr-at-mini {
          position: fixed; bottom: 90px; right: 20px; width: calc(100% - 40px); max-width: 380px;
          height: 60vh; max-height: 600px; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          z-index: 9999; display: flex; flex-direction: column; overflow: hidden; animation: gcrAtSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .gcr-at-mini-head {
          padding: 12px 16px; background: #1c1c1e; color: #fff; display: flex; justify-content: space-between; align-items: center;
          font-weight: 600; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        }
        .gcr-at-mini-head button { background: none; border: none; color: #fff; cursor: pointer; display: flex; }

        @keyframes gcrAtFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gcrAtPop { from { opacity: 0; transform: scale(0.15); } to { opacity: 1; transform: scale(1); } }
        @keyframes gcrAtSub { from { opacity: 0.4; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes gcrAtSlide { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .gcr-at-panel, .gcr-at-backdrop, .gcr-at-mini { animation: none; } }
      `}</style>
    </>
  );
}
