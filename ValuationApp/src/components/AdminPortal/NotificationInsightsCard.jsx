import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import IconTile from '../Shared/IconTile';

// Admin Settings → "Alert Insights": which alerts people actually read.
// Read = tapped the phone notification OR opened it in the in-app bell.

const PERIODS = [7, 30, 90];

const headersFor = (user) => {
  const h = {};
  if (user?.id) h['x-user-id'] = user.id;
  const jwt = localStorage.getItem('token');
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
};

const fmtDelay = (m) => {
  if (m === null || m === undefined) return '—';
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr` : `${Math.round(h / 24)} d`;
};

const rateColor = (r) => (r >= 60 ? '#34c759' : r >= 30 ? '#ff9500' : '#ff3b30');

export default function NotificationInsightsCard({ currentUser }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`${API_BASE_URL}/api/notifications/stats?days=${days}`, { headers: headersFor(currentUser) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(false); });
    return () => { alive = false; };
  }, [days, currentUser?.id]);

  return (
    <div className="admin-card ni-card">
      <div className="ni-head">
        <IconTile icon={BarChart3} color="indigo" size={28} />
        <div className="ni-head-text">
          <div className="ni-title">Alert Insights</div>
          <div className="ni-sub">Which alerts people read — keep the useful ones, cut the noise</div>
        </div>
      </div>

      <div className="ni-periods" role="tablist" aria-label="Period">
        {PERIODS.map((d) => (
          <button key={d} role="tab" aria-selected={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>

      {data === null && <div className="ni-msg">Loading…</div>}
      {data === false && <div className="ni-msg">Insights are unavailable right now.</div>}

      {data && (
        <>
          <div className="ni-summary">
            <div><strong>{data.total.sent}</strong><span>alerts sent</span></div>
            <div><strong>{data.total.read}</strong><span>read</span></div>
            <div><strong style={{ color: data.total.sent ? rateColor(data.total.readRate) : undefined }}>{data.total.sent ? `${data.total.readRate}%` : '—'}</strong><span>read rate</span></div>
          </div>

          {data.types.length === 0 ? (
            <div className="ni-msg">No alerts in the last {data.days} days yet.</div>
          ) : (
            <div className="ni-list">
              <div className="ni-row ni-row-head"><span>Alert</span><span>Sent</span><span>Read</span><span>Usually read in</span></div>
              {data.types.map((t) => (
                <div key={t.type} className="ni-row">
                  <div className="ni-name">
                    <span className="ni-label">{t.label}</span>
                    <div className="ni-bar" aria-hidden="true"><span style={{ width: `${t.readRate}%`, background: rateColor(t.readRate) }} /></div>
                    {(t.muted > 0 || t.held > 0) && (
                      <span className="ni-note">
                        {t.muted > 0 ? `${t.muted} muted by people` : ''}{t.muted > 0 && t.held > 0 ? ' · ' : ''}{t.held > 0 ? `${t.held} waiting for morning` : ''}
                      </span>
                    )}
                  </div>
                  <span className="ni-num">{t.sent}</span>
                  <span className="ni-num" style={{ color: rateColor(t.readRate) }}>{t.readRate}%</span>
                  <span className="ni-num ni-delay">{fmtDelay(t.medianMinutesToRead)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="ni-foot">
            Phone-tap tracking starts once push notifications are switched on; in-app reads are counted now.
          </div>
        </>
      )}

      <style>{`
        .ni-card { padding: 0 !important; overflow: hidden; margin-top: 16px; font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); }
        .ni-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; }
        .ni-head-text { flex: 1; min-width: 0; }
        .ni-title { font-size: 16px; font-weight: 700; color: #000; letter-spacing: -0.2px; }
        .ni-sub { font-size: 12px; color: #8e8e93; margin-top: 1px; }
        .ni-periods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 2px; margin: 0 16px 12px; background: #eeeef0; border-radius: 9px; }
        .ni-periods button { border: none; background: transparent; border-radius: 7px; padding: 6px 0; font: inherit; font-size: 13px; color: #3c3c43; cursor: pointer; }
        .ni-periods button.active { background: #fff; color: #000; font-weight: 600; box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
        .ni-msg { padding: 8px 16px 18px; font-size: 14px; color: #8e8e93; }
        .ni-summary { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 0.5px solid rgba(60,60,67,0.18); border-bottom: 0.5px solid rgba(60,60,67,0.18); }
        .ni-summary > div { display: flex; flex-direction: column; align-items: center; padding: 12px 4px; }
        .ni-summary > div + div { border-left: 0.5px solid rgba(60,60,67,0.18); }
        .ni-summary strong { font-size: 22px; font-weight: 700; color: #000; font-variant-numeric: tabular-nums; letter-spacing: -0.4px; }
        .ni-summary span { font-size: 12px; color: #8e8e93; }
        .ni-row { display: grid; grid-template-columns: minmax(0, 1fr) 40px 48px 64px; gap: 8px; align-items: center; padding: 10px 16px; border-top: 0.5px solid rgba(60,60,67,0.12); }
        .ni-row-head { border-top: none; padding-top: 12px; padding-bottom: 4px; font-size: 11px; font-weight: 600; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.3px; }
        .ni-row-head span:not(:first-child), .ni-num { text-align: right; }
        .ni-name { min-width: 0; }
        .ni-label { display: block; font-size: 14px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ni-bar { height: 4px; border-radius: 2px; background: #f2f2f7; margin-top: 5px; overflow: hidden; }
        .ni-bar span { display: block; height: 100%; border-radius: 2px; }
        .ni-note { display: block; font-size: 11px; color: #8e8e93; margin-top: 3px; }
        .ni-num { font-size: 14px; font-weight: 600; color: #000; font-variant-numeric: tabular-nums; }
        .ni-delay { font-weight: 500; color: #6d6d72; font-size: 13px; }
        .ni-foot { padding: 10px 16px 14px; font-size: 12px; color: #8e8e93; border-top: 0.5px solid rgba(60,60,67,0.18); }
      `}</style>
    </div>
  );
}
