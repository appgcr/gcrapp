import React, { useEffect, useState } from 'react';
import {
  BellRing, FilePlus2, RotateCcw, CheckCircle2, MapPin, Clock, FileCheck2, Inbox, AlertTriangle, Sunrise, Megaphone, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import IconTile from './IconTile';

// Settings → "My Alerts": each person chooses which alerts buzz their phone.
// Required alerts (work would stop without them) are always on.
// Switched-off alerts still appear in the in-app bell — only the phone stays quiet.

const ICONS = {
  case_assigned: [FilePlus2, 'blue'],
  report_feedback: [RotateCcw, 'purple'],
  report_approved: [CheckCircle2, 'green'],
  inspection_reminder: [MapPin, 'blue'],
  attendance_reminders: [Clock, 'green'],
  report_submitted: [FileCheck2, 'orange'],
  case_created: [Inbox, 'teal'],
  overdue: [AlertTriangle, 'red'],
  morning_digest: [Sunrise, 'orange'],
  announcement: [Megaphone, 'orange'],
};

const headersFor = (user) => {
  const h = { 'Content-Type': 'application/json' };
  if (user?.id) h['x-user-id'] = user.id;
  const jwt = localStorage.getItem('token');
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
};

export default function NotificationPrefsCard({ currentUser, compact = false }) {
  const [cats, setCats] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}/notification-prefs`, { headers: headersFor(currentUser) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => setCats(d.categories))
      .catch(() => setCats(false));
  }, [currentUser?.id]);

  const toggle = async (key, value) => {
    const prev = cats;
    setCats(cats.map((c) => (c.key === key ? { ...c, enabled: value } : c)));
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}/notification-prefs`, {
        method: 'PUT', headers: headersFor(currentUser), body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save');
    } catch (err) {
      setCats(prev);
      toast.error(err.message);
    }
  };

  return (
    <div className={`admin-card np-card ${compact ? 'np-compact' : ''}`}>
      <div className="np-head">
        <IconTile icon={BellRing} color="red" size={28} />
        <div>
          <div className="np-title">My Alerts</div>
          <div className="np-sub">Choose what buzzes your phone. Everything still shows in the bell.</div>
        </div>
      </div>

      {cats === null && <div className="np-msg">Loading…</div>}
      {cats === false && <div className="np-msg">Alert settings are unavailable right now.</div>}

      {Array.isArray(cats) && cats.map((c) => {
        const [Icon, color] = ICONS[c.key] || [BellRing, 'gray'];
        return (
          <div key={c.key} className="np-row">
            <IconTile icon={Icon} color={c.enabled ? color : 'gray'} size={30} />
            <div className="np-text">
              <div className="np-row-title">{c.label}</div>
              <div className="np-row-sub">{c.description}</div>
            </div>
            {c.required ? (
              <span className="np-always" title="Needed for your work, can't be turned off"><Lock size={12} /> Always on</span>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={c.enabled}
                aria-label={c.label}
                className={`np-switch ${c.enabled ? 'on' : ''}`}
                onClick={() => toggle(c.key, !c.enabled)}
              >
                <span />
              </button>
            )}
          </div>
        );
      })}

      <style>{`
        .np-card { padding: 0 !important; overflow: hidden; margin-top: 16px; margin-bottom: 16px; font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); background: #fff; border-radius: 14px; }
        .np-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 0.5px solid rgba(60,60,67,0.18); }
        .np-title { font-size: 16px; font-weight: 700; color: #000; letter-spacing: -0.2px; }
        .np-sub { font-size: 12px; color: #8e8e93; margin-top: 1px; }
        .np-msg { padding: 16px; font-size: 14px; color: #8e8e93; }
        .np-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; position: relative; }
        .np-row + .np-row::before { content: ''; position: absolute; top: 0; left: 58px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.18); }
        .np-text { flex: 1; min-width: 0; }
        .np-row-title { font-size: 15px; color: #000; letter-spacing: -0.2px; }
        .np-row-sub { font-size: 12px; color: #8e8e93; margin-top: 2px; line-height: 1.35; }
        .np-always { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #8e8e93; white-space: nowrap; }
        .np-switch {
          flex-shrink: 0; width: 51px; height: 31px; border-radius: 16px; border: none; padding: 0; cursor: pointer;
          background: rgba(120,120,128,0.16); position: relative; transition: background 0.2s ease;
        }
        .np-switch span {
          position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16); transition: transform 0.22s cubic-bezier(0.3, 0.7, 0.4, 1.2);
        }
        .np-switch.on { background: #34c759; }
        .np-switch.on span { transform: translateX(20px); }
        .np-switch:focus-visible { outline: 2px solid #007aff; outline-offset: 2px; }
        .dark-theme .np-card { background: #1c1c1e; }
        .dark-theme .np-title, .dark-theme .np-row-title { color: #fff; }
      `}</style>
    </div>
  );
}
