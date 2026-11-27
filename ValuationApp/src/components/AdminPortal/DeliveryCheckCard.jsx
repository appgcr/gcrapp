import React, { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Smartphone, Eye } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

// Super Admin: for a day and a kind of notification — who got it, did it reach their phone, did they open / see it.
const KINDS = [
  ['good_morning', 'Good morning (8 AM)'], ['good_evening', 'Thank-you (at check-out)'], ['daily_report', 'Daily report (8 PM)'], ['weekly_report', 'Weekly report'],
  ['checkin_reminder', 'Check-in reminder'], ['case_assigned', 'New case assigned'], ['announcement', 'Announcements'],
  ['login_approval', 'Sign-in approvals'], ['morning_digest', 'Morning summary'], ['revaluation_due', 'Revaluation Radar'],
];
const PHONE = {
  delivered: ['Reached phone', 'ok'], held: ['Waiting (quiet hours)', 'wait'], 'no-phone': ['No phone registered', 'bad'],
  'server-off': ['Server push off', 'bad'], failed: ['Phone delivery failed', 'bad'], off: ['They turned it off', 'bad'],
  unknown: ['Sent', 'wait'], pending: ['Sending…', 'wait'],
};
const todayYmd = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const shift = (ymd, d) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + d * 86400000).toISOString().slice(0, 10);
const time = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) : '');

export default function DeliveryCheckCard() {
  const [kind, setKind] = useState('good_morning');
  const [ymd, setYmd] = useState(todayYmd());
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    fetch(`${API_BASE_URL}/api/notifications/delivery?type=${kind}&date=${ymd}`).then((r) => r.json()).then(setD).catch(() => setD({ error: 'Could not load.' }));
  }, [kind, ymd]);
  const t = d && d.totals;
  return (
    <div className="dc">
      <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Which notification">
        {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div className="dc-nav">
        <button type="button" onClick={() => setYmd(shift(ymd, -1))} aria-label="Day before"><ChevronLeft size={18} /></button>
        <span>{new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <button type="button" onClick={() => setYmd(shift(ymd, 1))} disabled={ymd >= todayYmd()} aria-label="Next day"><ChevronRight size={18} /></button>
      </div>
      {!d ? <div className="dc-empty"><Loader2 size={18} className="spin" /></div> : d.error ? <div className="dc-empty">{d.error}</div> : (
        <>
          <div className="dc-tiles">
            <div><b>{t.people}</b><span>Sent to</span></div>
            <div className="ok"><b>{t.delivered}</b><span>Reached phone</span></div>
            <div className={t.notOnPhone ? 'bad' : ''}><b>{t.notOnPhone}</b><span>Not on phone</span></div>
            <div><b>{t.opened}</b><span>Opened / seen</span></div>
          </div>
          {d.rows.length === 0 ? <div className="dc-empty">None sent on this day.</div> : (
            <div className="dc-list">
              {d.rows.map((r, i) => {
                const [label, tone] = PHONE[r.phone] || [r.phone, 'wait'];
                return (
                  <div className="dc-row" key={i}>
                    <div className="dc-who"><b>{r.to}</b><small>{[r.role, r.branch, `sent ${time(r.at)}`].filter(Boolean).join(' · ')}</small></div>
                    <div className="dc-st">
                      <span className={`dc-pill ${tone}`}><Smartphone size={13} /> {label}</span>
                      {(r.openedAt || r.readAt) && <span className="dc-pill ok"><Eye size={13} /> {r.openedAt ? `Opened ${time(r.openedAt)}` : `Seen ${time(r.readAt)}`}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="dc-note">"No phone registered" means that person has not opened the latest Gouru app on their phone (or uses only the website): they still see it in the bell. "Server push off" means the Firebase key on the server is not working.</p>
        </>
      )}
      <style>{`
        .dc { display: flex; flex-direction: column; gap: 10px; }
        .dc select { width: 100%; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; font-size: 15px; background: #fff; font-family: inherit; }
        .dc-nav { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 14px; color: #0f172a; }
        .dc-nav button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer; }
        .dc-nav button:disabled { opacity: .4; }
        .dc-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .dc-tiles div { background: #fff; border: 1px solid #eef2f7; border-radius: 12px; padding: 10px 8px; text-align: center; }
        .dc-tiles b { display: block; font-size: 20px; color: #0f172a; } .dc-tiles span { font-size: 11.5px; color: #64748b; }
        .dc-tiles .ok b { color: #15803d; } .dc-tiles .bad b { color: #c2410c; }
        .dc-list { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; overflow: hidden; }
        .dc-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 12px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
        .dc-row:first-child { border-top: 0; }
        .dc-who { display: flex; flex-direction: column; min-width: 0; } .dc-who b { font-size: 14px; color: #0f172a; } .dc-who small { font-size: 12px; color: #64748b; }
        .dc-st { display: flex; gap: 6px; flex-wrap: wrap; }
        .dc-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 9px; }
        .dc-pill.ok { background: #dcfce7; color: #15803d; } .dc-pill.bad { background: #ffedd5; color: #c2410c; } .dc-pill.wait { background: #f1f5f9; color: #475569; }
        .dc-empty { display: flex; justify-content: center; padding: 20px; color: #64748b; }
        .dc-note { font-size: 12px; color: #64748b; line-height: 1.45; margin: 0; }
        body.dark-theme .dc select, body.dark-theme .dc-nav button, body.dark-theme .dc-tiles div, body.dark-theme .dc-list { background: #1c1c1e; border-color: #3a3a3c; color: #fff; }
        body.dark-theme .dc-tiles b, body.dark-theme .dc-who b, body.dark-theme .dc-nav { color: #fff; }
      `}</style>
    </div>
  );
}
