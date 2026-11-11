import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, LogIn, LogOut, MapPin, ShieldCheck, Share, FileText, Sheet, ChevronRight, X, ImageOff } from 'lucide-react';
import DateRangePicker, { toYMD, fromYMD } from '../Shared/DateRangePicker';
import { BackBar, IosSettingsStyles } from '../Shared/IosSettings';
import { buildRegister, exportRegisterPdf, exportRegisterXlsx } from '../../utils/attendanceReport';

// Admin → Attendance (iOS style)
//   Main: period picker · summary · every engineer (present / on duty / absent) · export
//   Detail: one engineer's day-by-day check-in / check-out timeline with selfies and places
// Only real Clock-In / Clock-Out records are used — live GPS pings are ignored.

const PERIODS = [
  { key: 'TODAY', label: 'Today' },
  { key: '7D', label: '7 Days' },
  { key: '1M', label: '30 Days' },
  { key: 'CUSTOM', label: 'Custom' },
];

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHours = (h) => {
  if (!h) return '0h';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
};
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function periodRange(mode, customStart, customEnd) {
  const today = dayStart(new Date());
  if (mode === 'TODAY') return { start: today, end: addDays(today, 1), days: 1 };
  if (mode === '7D') return { start: addDays(today, -6), end: addDays(today, 1), days: 7 };
  if (mode === '1M') return { start: addDays(today, -29), end: addDays(today, 1), days: 30 };
  const s = fromYMD(customStart) || today;
  const e = fromYMD(customEnd) || today;
  const start = s <= e ? s : e;
  const end = addDays(s <= e ? e : s, 1);
  return { start, end, days: Math.round((end - start) / 86400000) };
}

export default function AttendanceLogs() {
  const [records, setRecords] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('TODAY');
  const todayStr = toYMD(new Date());
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [selectedId, setSelectedId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportFor, setExportFor] = useState(null); // engineer id, or null for everyone
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => Promise.all([
      fetch(`${API_BASE_URL}/api/attendance`).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE_URL}/api/users`).then((r) => r.json()).catch(() => []),
    ]).then(([att, users]) => {
      if (!alive) return;
      setRecords((Array.isArray(att) ? att : []).filter((a) => a.attendanceType === 'Clock-In' || a.attendanceType === 'Clock-Out'));
      setEngineers((Array.isArray(users) ? users : []).filter((u) => u.role === 'ENGINEER'));
      setLoading(false);
    });
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const range = periodRange(mode, customStart, customEnd);

  // Per-engineer summary for the period
  const people = useMemo(() => {
    const inRange = records.filter((r) => { const t = new Date(r.timestamp); return t >= range.start && t < range.end; });
    const today = dayStart(new Date());
    return engineers.map((e) => {
      const mine = inRange.filter((r) => r.userId === e.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const daysPresent = new Set(mine.filter((r) => r.attendanceType === 'Clock-In').map((r) => toYMD(new Date(r.timestamp)))).size;
      const hours = mine.filter((r) => r.attendanceType === 'Clock-Out').reduce((t, r) => t + (Number(r.workDurationHours) || 0), 0);
      const todays = records.filter((r) => r.userId === e.id && new Date(r.timestamp) >= today).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const lastToday = todays[todays.length - 1];
      const firstInToday = todays.find((r) => r.attendanceType === 'Clock-In');
      const status = !todays.length ? 'absent' : lastToday.attendanceType === 'Clock-In' ? 'on' : 'out';
      return { ...e, name: e.name || e.username, mine, daysPresent, hours, status, firstInToday, lastToday };
    });
  }, [records, engineers, range.start.getTime(), range.end.getTime()]);

  const q = search.trim().toLowerCase();
  const list = people
    .filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q))
    .sort((a, b) => ({ on: 0, out: 1, absent: 2 }[a.status] - { on: 0, out: 1, absent: 2 }[b.status]) || a.name.localeCompare(b.name));

  const total = engineers.length;
  const presentCount = people.filter((p) => p.daysPresent > 0).length;
  const onDuty = people.filter((p) => p.status === 'on').length;
  const totalHours = people.reduce((t, p) => t + p.hours, 0);
  const checkIns = people.map((p) => p.firstInToday).filter(Boolean).map((r) => { const d = new Date(r.timestamp); return d.getHours() * 60 + d.getMinutes(); });
  const avgIn = checkIns.length ? Math.round(checkIns.reduce((a, b) => a + b, 0) / checkIns.length) : null;
  const avgInText = avgIn === null ? '—' : fmtTime(new Date(2000, 0, 1, Math.floor(avgIn / 60), avgIn % 60));
  const periodLabel = mode === 'TODAY' ? 'today' : `${range.days} days`;

  // ---------- export (check-ins / check-outs only) ----------
  const periodText = `${fmtDay(range.start)} – ${fmtDay(addDays(range.end, -1))}`;

  // scope: null = all engineers, otherwise one engineer
  const exportScope = () => {
    const one = exportFor ? people.find((p) => p.id === exportFor) : null;
    const subset = one ? [one] : people;
    const slug = (one ? one.name : 'All').replace(/[^A-Za-z0-9]+/g, '_');
    return { one, subset, file: `GCR_Attendance_${slug}_${toYMD(range.start)}_to_${toYMD(addDays(range.end, -1))}` };
  };

  const runExport = async (kind) => {
    const { one, subset, file } = exportScope();
    const reg = buildRegister(subset, records, range);
    if (!reg.rows.length) return alert('Nothing to export for this period.');
    const title = one ? `Attendance — ${one.name} (${one.id})` : 'Attendance Register';
    try {
      if (kind === 'pdf') exportRegisterPdf(reg, { title, filename: file });
      else await exportRegisterXlsx(reg, { title, filename: file });
      setShowExport(false);
    } catch (err) {
      console.error(err);
      alert('Could not create the file. Please try again.');
    }
  };

  const openExport = (id = null) => { setExportFor(id); setShowExport(true); };

  const statusBadge = (p) => {
    if (p.status === 'on') return <span className="at-badge on">On duty</span>;
    if (p.status === 'out') return <span className="at-badge out">Checked out</span>;
    return <span className="at-badge absent">Not in today</span>;
  };

  const exportSheet = showExport && (
    <div className="at-sheet-backdrop" onClick={() => setShowExport(false)}>
      <div className="at-sheet" role="dialog" aria-label="Export attendance" onClick={(e) => e.stopPropagation()}>
        <div className="at-sheet-group">
          <div className="at-sheet-title">
            {exportFor ? `${people.find((p) => p.id === exportFor)?.name || 'Engineer'} · ` : 'All engineers · '}{periodText}
          </div>
          <button onClick={() => runExport('pdf')}><FileText size={18} /> PDF report</button>
          <button onClick={() => runExport('xlsx')}><Sheet size={18} /> Excel (.xlsx)</button>
        </div>
        <button className="at-sheet-cancel" onClick={() => setShowExport(false)}>Cancel</button>
      </div>
    </div>
  );

  const periodPicker = (
    <>
      <div className="at-seg" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.key} role="tab" aria-selected={mode === p.key} className={mode === p.key ? 'active' : ''} onClick={() => setMode(p.key)}>{p.label}</button>
        ))}
      </div>
      {mode === 'CUSTOM' && (
        <div className="at-card at-picker">
          <DateRangePicker start={customStart} end={customEnd} max={todayStr} onChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }} />
        </div>
      )}
    </>
  );

  // ---------- detail page ----------
  const selected = people.find((p) => p.id === selectedId);
  if (selected) {
    const byDay = new Map();
    selected.mine.forEach((r) => {
      const k = toYMD(new Date(r.timestamp));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    });
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return (
      <div className="ios-settings ios-subpage at-page" key="detail">
        <div className="at-detail-nav">
          <BackBar label="Attendance" onBack={() => setSelectedId(null)} title={selected.name} />
          <button
            className="at-export at-export-top"
            onClick={() => openExport(selected.id)}
            disabled={selected.mine.length === 0}
            title={selected.mine.length ? `Export ${selected.name}'s attendance` : 'No check-ins in this period'}
            aria-haspopup="dialog"
          >
            <Share size={17} /> Export
          </button>
        </div>
        <div className="at-detail-head">
          {statusBadge(selected)}
          <span className="at-muted">{selected.id}{selected.phone ? ` · ${selected.phone}` : ''}</span>
        </div>
        {periodPicker}
        <div className="at-card at-stats">
          <div><strong>{selected.daysPresent}<span>/{range.days}</span></strong><em>days present</em></div>
          <div><strong>{fmtHours(selected.hours)}</strong><em>worked</em></div>
          <div><strong>{selected.mine.filter((r) => r.faceVerified).length}</strong><em>face-verified</em></div>
        </div>

        {days.length === 0 ? (
          <div className="at-card at-empty">No check-ins in this period.</div>
        ) : days.map(([ymd, rows]) => {
          const worked = rows.filter((r) => r.attendanceType === 'Clock-Out').reduce((t, r) => t + (Number(r.workDurationHours) || 0), 0);
          return (
            <section key={ymd} className="at-day">
              <div className="ios-section at-day-head"><span>{fmtDay(fromYMD(ymd))}</span><span>{fmtHours(worked)}</span></div>
              <div className="at-card at-timeline">
                {rows.map((r) => {
                  const isIn = r.attendanceType === 'Clock-In';
                  return (
                    <div key={r.id || r._id} className="at-event">
                      <span className={`at-dot ${isIn ? 'in' : 'out'}`}>{isIn ? <LogIn size={14} /> : <LogOut size={14} />}</span>
                      <div className="at-event-main">
                        <div className="at-event-title">{isIn ? 'Checked in' : 'Checked out'} · {fmtTime(r.timestamp)}
                          {r.faceVerified && <span className="at-face"><ShieldCheck size={13} /> Face verified</span>}
                        </div>
                        {(r.address || (r.lat && r.lng)) && (
                          <a className="at-place" href={`https://www.google.com/maps?q=${encodeURIComponent(r.lat && r.lng ? `${r.lat},${r.lng}` : r.address)}`} target="_blank" rel="noopener noreferrer">
                            <MapPin size={13} /> {r.address ? r.address.split(',').slice(0, 2).join(',') : `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`}
                          </a>
                        )}
                        {!isIn && Number(r.workDurationHours) > 0 && <div className="at-muted">Worked {fmtHours(Number(r.workDurationHours))}</div>}
                      </div>
                      {r.imageUrl ? (
                        <button className="at-selfie" onClick={() => setPhoto(r.imageUrl)} aria-label="View check-in photo">
                          <img src={r.imageUrl} alt="" />
                        </button>
                      ) : (
                        <span className="at-selfie at-noimg" title="No photo"><ImageOff size={16} /></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {exportSheet}
        {photo && (
          <div className="at-photo" onClick={() => setPhoto(null)} role="dialog" aria-label="Check-in photo">
            <img src={photo} alt="Check-in selfie" />
            <button aria-label="Close photo"><X size={20} /></button>
          </div>
        )}
        <IosSettingsStyles />
        <AttendanceStyles />
      </div>
    );
  }

  // ---------- main page ----------
  return (
    <div className="ios-settings at-page animate-fade-in">
      <div className="at-top">
        <div className="at-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder="Search engineer" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search engineers" />
        </div>
        <button className="at-export" onClick={() => openExport(null)} aria-haspopup="dialog"><Share size={17} /> Export</button>
      </div>

      {periodPicker}

      <div className="at-card at-stats at-stats-4">
        <div><strong>{presentCount}<span>/{total}</span></strong><em>present {periodLabel}</em></div>
        <div><strong className="green">{onDuty}</strong><em>on duty now</em></div>
        <div><strong>{fmtHours(totalHours)}</strong><em>hours worked</em></div>
        <div><strong>{avgInText}</strong><em>avg check-in today</em></div>
      </div>

      <div className="ios-section">Engineers</div>
      {loading ? (
        <div className="at-card at-empty">Loading…</div>
      ) : list.length === 0 ? (
        <div className="at-card at-empty">{q ? `No engineer matches “${search}”.` : 'No engineers added yet.'}</div>
      ) : (
        <div className="at-card at-list">
          {list.map((p) => (
            <button key={p.id} className="at-row" onClick={() => setSelectedId(p.id)}>
              <span className={`at-avatar ${p.status}`}>{initials(p.name)}</span>
              <span className="at-row-main">
                <span className="at-row-name">{p.name}</span>
                <span className="at-row-sub">
                  {mode === 'TODAY'
                    ? (p.firstInToday ? `In ${fmtTime(p.firstInToday.timestamp)}${p.status === 'out' ? ` · Out ${fmtTime(p.lastToday.timestamp)}` : ''}` : 'No check-in yet')
                    : `${p.daysPresent} of ${range.days} days · ${fmtHours(p.hours)}`}
                </span>
              </span>
              {statusBadge(p)}
              <ChevronRight size={18} className="ios-chev" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <p className="ios-footnote">Only check-ins and check-outs are listed. Live location pings are on the Staff map.</p>

      {exportSheet}

      <IosSettingsStyles />
      <AttendanceStyles />
    </div>
  );
}

function AttendanceStyles() {
  return (
    <style>{`
      .at-page { max-width: 760px; }
      .at-top { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
      .at-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; background: rgba(118,118,128,0.12); border-radius: 10px; color: #8e8e93; }
      .at-search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: #000; }
      .at-detail-nav { position: relative; }
      .at-export-top { position: absolute; top: 0; right: 0; }
      .at-export:disabled { opacity: 0.4; cursor: default; }
      .at-export { flex-shrink: 0; height: 40px; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border: none; border-radius: 10px; background: rgba(0,122,255,0.1); color: #007aff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }

      .at-seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px; margin-bottom: 12px; background: #e3e3e8; border-radius: 9px; }
      .at-seg button { border: none; background: transparent; border-radius: 7px; padding: 7px 2px; font: inherit; font-size: 13px; color: #3c3c43; cursor: pointer; white-space: nowrap; }
      .at-seg button.active { background: #fff; color: #000; font-weight: 600; box-shadow: 0 3px 8px rgba(0,0,0,0.12); }

      .at-card { background: #fff; border-radius: 12px; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.04); }
      .at-picker { padding: 12px; margin-bottom: 12px; }
      .at-empty { padding: 28px 16px; text-align: center; color: #8e8e93; font-size: 15px; }
      .at-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .at-stats-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      @media (min-width: 700px) { .at-stats-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      .at-stats > div { display: flex; flex-direction: column; gap: 2px; padding: 13px 14px; position: relative; min-width: 0; }
      .at-stats > div + div::before { content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; border-left: 0.5px solid rgba(60,60,67,0.18); }
      .at-stats-4 > div:nth-child(3)::before { display: none; }
      .at-stats-4 > div:nth-child(n+3) { border-top: 0.5px solid rgba(60,60,67,0.18); }
      @media (min-width: 700px) { .at-stats-4 > div:nth-child(3)::before { display: block; } .at-stats-4 > div:nth-child(n+3) { border-top: none; } }
      .at-stats strong { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: #000; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .at-stats strong span { font-size: 15px; color: #8e8e93; font-weight: 600; }
      .at-stats strong.green { color: #248a3d; }
      .at-stats em { font-style: normal; font-size: 12px; color: #8e8e93; }

      .at-list { overflow: hidden; }
      .at-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; background: #fff; border: none; text-align: left; font: inherit; cursor: pointer; position: relative; }
      .at-row:active { background: #e5e5ea; }
      .at-row + .at-row::before { content: ''; position: absolute; top: 0; left: 68px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.2); }
      .at-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 15px; background: linear-gradient(180deg, #a3a8b8, #7d8396); }
      .at-avatar.on { background: linear-gradient(180deg, #4cd964, #28a745); }
      .at-avatar.out { background: linear-gradient(180deg, #5ac8fa, #007aff); }
      .at-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .at-row-name { font-size: 16px; font-weight: 500; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .at-row-sub { font-size: 13px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .at-badge { flex-shrink: 0; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
      .at-badge.on { background: rgba(52,199,89,0.15); color: #248a3d; }
      .at-badge.out { background: rgba(0,122,255,0.12); color: #0062cc; }
      .at-badge.absent { background: rgba(142,142,147,0.15); color: #636366; }
      .at-muted { font-size: 13px; color: #8e8e93; }

      .at-detail-head { display: flex; align-items: center; gap: 10px; margin: -6px 4px 14px; flex-wrap: wrap; }
      .at-stats + .at-day, .at-stats + .at-empty { margin-top: 4px; }
      .at-day-head { display: flex; justify-content: space-between; text-transform: none; font-size: 14px; color: #3c3c43; font-weight: 600; }
      .at-timeline { overflow: hidden; }
      .at-event { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; position: relative; }
      .at-event + .at-event::before { content: ''; position: absolute; top: 0; left: 52px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.18); }
      .at-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
      .at-dot.in { background: #34c759; }
      .at-dot.out { background: #8e8e93; }
      .at-event-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .at-event-title { font-size: 15px; color: #000; font-weight: 500; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .at-face { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #248a3d; background: rgba(52,199,89,0.14); padding: 2px 7px; border-radius: 999px; }
      .at-place { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #007aff; text-decoration: none; overflow-wrap: anywhere; }
      .at-selfie { width: 48px; height: 48px; border-radius: 10px; overflow: hidden; flex-shrink: 0; border: none; padding: 0; cursor: pointer; background: #f2f2f7; }
      .at-selfie img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .at-noimg { display: flex; align-items: center; justify-content: center; color: #c7c7cc; cursor: default; }

      .at-photo { position: fixed; inset: 0; z-index: 10050; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; padding: 20px; }
      .at-photo img { max-width: 100%; max-height: 100%; border-radius: 14px; object-fit: contain; }
      .at-photo button { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }

      /* iOS action sheet */
      .at-sheet-backdrop { position: fixed; inset: 0; z-index: 10050; background: rgba(0,0,0,0.3); display: flex; align-items: flex-end; justify-content: center; padding: 8px; animation: atFade 0.18s ease-out; }
      .at-sheet { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 8px; padding-bottom: env(safe-area-inset-bottom, 0px); animation: atUp 0.28s cubic-bezier(0.2, 0.9, 0.25, 1); }
      .at-sheet-group { background: rgba(250,250,252,0.94); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); border-radius: 14px; overflow: hidden; }
      .at-sheet-title { padding: 13px 16px; text-align: center; font-size: 13px; color: #8e8e93; border-bottom: 0.5px solid rgba(60,60,67,0.2); }
      .at-sheet button { width: 100%; height: 56px; border: none; background: transparent; font: inherit; font-size: 18px; color: #007aff; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
      .at-sheet-group button + button { border-top: 0.5px solid rgba(60,60,67,0.2); }
      .at-sheet button:active { background: rgba(0,0,0,0.05); }
      .at-sheet-cancel { background: #fff !important; border-radius: 14px; font-weight: 600 !important; }
      @media (min-width: 768px) { .at-sheet-backdrop { align-items: center; } }
      @keyframes atFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes atUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    `}</style>
  );
}
