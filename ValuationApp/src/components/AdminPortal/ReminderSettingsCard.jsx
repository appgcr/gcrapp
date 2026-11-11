import React, { useEffect, useState } from 'react';
import { BellRing, Sunrise, LogIn, MapPin, AlertTriangle, LogOut, CalendarOff, Coffee, Moon, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import IconTile from '../Shared/IconTile';

// Admin Settings → "Automatic Reminders" (iOS Settings style).
// Changes save instantly to the server, like iPhone Settings.

const authHeaders = (user) => {
  const h = { 'Content-Type': 'application/json' };
  if (user?.id) h['x-user-id'] = user.id;
  const jwt = localStorage.getItem('token');
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
};

const fmt12 = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (Number.isNaN(h)) return '';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`rs-switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

export default function ReminderSettingsCard({ currentUser, embedded = false }) {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config/reminders`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(setS)
      .catch(() => setS(false));
  }, []);

  // Optimistic save of a partial change; reverts if the server refuses
  const save = async (patch, apply) => {
    const prev = s;
    const next = apply(structuredClone(s));
    setS(next);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/reminders`, {
        method: 'PUT', headers: authHeaders(currentUser), body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setS(data);
    } catch (err) {
      setS(prev);
      toast.error(`Reminder settings not saved: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (s === null) {
    return <div className="admin-card rs-card"><div className="rs-loading">Loading reminders…</div></div>;
  }
  if (s === false) {
    return <div className="admin-card rs-card"><div className="rs-loading">Reminder settings are unavailable right now.</div></div>;
  }

  const off = !s.enabled;
  const rows = [
    {
      key: 'morningDigest', icon: Sunrise, color: 'orange', title: 'Admin morning summary',
      sub: 'To you: cases to review, unassigned, inspections today',
      control: 'time',
    },
    {
      key: 'engineerDigest', icon: Coffee, color: 'teal', title: 'Engineer morning summary',
      sub: "To each engineer: their open cases and today's inspections",
      control: 'time',
    },
    {
      key: 'checkIn', icon: LogIn, color: 'green', title: 'Check-in reminder',
      sub: "To engineers with open cases who haven't checked in",
      control: 'time',
    },
    {
      key: 'inspection', icon: MapPin, color: 'blue', title: 'Inspection reminder',
      sub: 'To the engineer, before each booked inspection',
      control: 'lead',
    },
    {
      key: 'overdue', icon: AlertTriangle, color: 'red', title: 'Overdue cases',
      sub: `To you: unassigned over ${s.overdue.unassignedHours} hrs, review waiting over ${s.overdue.reviewHours} hrs`,
      control: 'overdue',
    },
    {
      key: 'checkOut', icon: LogOut, color: 'indigo', title: 'Check-out reminder',
      sub: 'To engineers still checked in at the end of the day',
      control: 'time',
    },
  ];

  return (
    <div className="admin-card rs-card">
      <div className="rs-head">
        {!embedded && <IconTile icon={BellRing} color="red" size={28} />}
        <div className="rs-head-text">
          <div className="rs-title">{embedded ? 'Send reminders' : 'Automatic Reminders'}</div>
          <div className="rs-head-sub">Sent by the server as notifications · India time</div>
        </div>
        <Switch on={s.enabled} label="All automatic reminders" onChange={(v) => save({ enabled: v }, (x) => { x.enabled = v; return x; })} />
      </div>

      <div className={`rs-list ${off ? 'is-off' : ''}`}>
        {rows.map((r) => {
          const cfg = s[r.key];
          return (
            <div key={r.key} className="rs-row">
              <IconTile icon={r.icon} color={cfg.enabled && !off ? r.color : 'gray'} size={30} />
              <div className="rs-text">
                <div className="rs-row-title">{r.title}</div>
                <div className="rs-row-sub">{r.sub}</div>
                {cfg.enabled && !off && (
                  <div className="rs-controls">
                    {r.control === 'time' && (
                      <label className="rs-chip">
                        <span className="sr-only">{r.title} time</span>
                        <input
                          type="time"
                          value={cfg.time}
                          onChange={(e) => e.target.value && save({ [r.key]: { time: e.target.value } }, (x) => { x[r.key].time = e.target.value; return x; })}
                        />
                        <span aria-hidden="true">{fmt12(cfg.time)}</span>
                      </label>
                    )}
                    {r.control === 'lead' && (
                      <label className="rs-chip">
                        <span className="sr-only">Minutes before inspection</span>
                        <select
                          value={cfg.minutesBefore}
                          onChange={(e) => { const v = Number(e.target.value); save({ inspection: { minutesBefore: v } }, (x) => { x.inspection.minutesBefore = v; return x; }); }}
                        >
                          {[15, 30, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`} before</option>)}
                        </select>
                      </label>
                    )}
                    {r.control === 'overdue' && (
                      <>
                        <label className="rs-chip">
                          <span className="rs-chip-label">Unassigned</span>
                          <select
                            value={cfg.unassignedHours}
                            onChange={(e) => { const v = Number(e.target.value); save({ overdue: { unassignedHours: v } }, (x) => { x.overdue.unassignedHours = v; return x; }); }}
                          >
                            {[4, 8, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hrs</option>)}
                          </select>
                        </label>
                        <label className="rs-chip">
                          <span className="rs-chip-label">Review</span>
                          <select
                            value={cfg.reviewHours}
                            onChange={(e) => { const v = Number(e.target.value); save({ overdue: { reviewHours: v } }, (x) => { x.overdue.reviewHours = v; return x; }); }}
                          >
                            {[12, 24, 48, 72, 96].map((h) => <option key={h} value={h}>{h} hrs</option>)}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Switch
                on={cfg.enabled}
                disabled={off}
                label={r.title}
                onChange={(v) => save({ [r.key]: { enabled: v } }, (x) => { x[r.key].enabled = v; return x; })}
              />
            </div>
          );
        })}

        <div className="rs-section">Smart timing</div>

        <div className="rs-row">
          <IconTile icon={Sparkles} color={s.personalTiming && !off ? 'purple' : 'gray'} size={30} />
          <div className="rs-text">
            <div className="rs-row-title">Personal timing</div>
            <div className="rs-row-sub">
              Morning summaries arrive 15 min before each person usually starts (learned from check-ins and app opens).
              Uses the times above until there are 3 days of history.
            </div>
          </div>
          <Switch on={!!s.personalTiming} disabled={off} label="Personal timing" onChange={(v) => save({ personalTiming: v }, (x) => { x.personalTiming = v; return x; })} />
        </div>

        <div className="rs-row">
          <IconTile icon={Moon} color={s.quietHours?.enabled && !off ? 'indigo' : 'gray'} size={30} />
          <div className="rs-text">
            <div className="rs-row-title">Quiet hours</div>
            <div className="rs-row-sub">
              Non-urgent alerts don't buzz phones at night; they're delivered together when quiet hours end.
              Urgent ones (case for today, report returned, announcements) always go through.
            </div>
            {s.quietHours?.enabled && !off && (
              <div className="rs-controls">
                {['start', 'end'].map((f) => (
                  <label key={f} className="rs-chip">
                    <span className="rs-chip-label">{f === 'start' ? 'From' : 'Until'}</span>
                    <input
                      type="time"
                      value={s.quietHours[f]}
                      onChange={(e) => e.target.value && save({ quietHours: { [f]: e.target.value } }, (x) => { x.quietHours[f] = e.target.value; return x; })}
                    />
                    <span aria-hidden="true">{fmt12(s.quietHours[f])}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <Switch on={!!s.quietHours?.enabled} disabled={off} label="Quiet hours" onChange={(v) => save({ quietHours: { enabled: v } }, (x) => { x.quietHours.enabled = v; return x; })} />
        </div>

        <div className="rs-row">
          <IconTile icon={CalendarOff} color="gray" size={30} />
          <div className="rs-text">
            <div className="rs-row-title">Quiet on Sundays</div>
            <div className="rs-row-sub">Only booked inspections are reminded on Sundays</div>
          </div>
          <Switch on={s.skipSundays} disabled={off} label="Quiet on Sundays" onChange={(v) => save({ skipSundays: v }, (x) => { x.skipSundays = v; return x; })} />
        </div>
      </div>

      <div className="rs-foot">
        {saving ? 'Saving…' : s.updatedBy ? `Last changed by ${s.updatedBy}` : 'Summaries go out between 7 AM and 10:30 AM; other reminders between 7 AM and 8 PM, except inspections.'}
      </div>

      <style>{`
        .rs-card { padding: 0 !important; overflow: hidden; margin-top: 16px; font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); }
        .rs-loading { padding: 18px 16px; font-size: 14px; color: #8e8e93; }
        .rs-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 0.5px solid rgba(60,60,67,0.18); }
        .rs-head-text { flex: 1; min-width: 0; }
        .rs-title { font-size: 16px; font-weight: 700; color: #000; letter-spacing: -0.2px; }
        .rs-head-sub { font-size: 12px; color: #8e8e93; margin-top: 1px; }
        .rs-list.is-off { opacity: 0.45; pointer-events: none; }
        .rs-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; position: relative; }
        .rs-row + .rs-row::before { content: ''; position: absolute; top: 0; left: 58px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.18); }
        .rs-row > .rs-switch { margin-top: 2px; }
        .rs-text { flex: 1; min-width: 0; }
        .rs-row-title { font-size: 15px; color: #000; letter-spacing: -0.2px; }
        .rs-section { padding: 16px 16px 6px; font-size: 13px; color: #6d6d72; text-transform: uppercase; letter-spacing: 0.2px; border-top: 0.5px solid rgba(60,60,67,0.18); background: #f8f8fa; }
        .rs-section + .rs-row::before { display: none; }
        .rs-row-sub { font-size: 12px; color: #8e8e93; margin-top: 2px; line-height: 1.35; }
        .rs-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .rs-chip {
          position: relative; display: inline-flex; align-items: center; gap: 6px;
          background: rgba(118,118,128,0.12); border-radius: 8px; padding: 6px 11px;
          font-size: 15px; color: #000; font-variant-numeric: tabular-nums; cursor: pointer;
        }
        .rs-chip-label { font-size: 13px; color: #8e8e93; }
        .rs-chip input[type="time"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; border: none; }
        .rs-chip select {
          appearance: none; -webkit-appearance: none; border: none; background: transparent;
          font: inherit; color: #007aff; cursor: pointer; padding: 0; outline: none;
        }
        .rs-chip:focus-within { outline: 2px solid #007aff; outline-offset: 1px; }
        .rs-foot { padding: 10px 16px 14px; font-size: 12px; color: #8e8e93; border-top: 0.5px solid rgba(60,60,67,0.18); }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        .rs-switch {
          flex-shrink: 0; width: 51px; height: 31px; border-radius: 16px; border: none; padding: 0; cursor: pointer;
          background: rgba(120,120,128,0.16); position: relative; transition: background 0.2s ease;
        }
        .rs-switch span {
          position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16); transition: transform 0.22s cubic-bezier(0.3, 0.7, 0.4, 1.2);
        }
        .rs-switch.on { background: #34c759; }
        .rs-switch.on span { transform: translateX(20px); }
        .rs-switch:disabled { cursor: default; }
        .rs-switch:focus-visible { outline: 2px solid #007aff; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
