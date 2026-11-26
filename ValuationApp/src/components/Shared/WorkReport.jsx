import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Loader2, Clock, MapPin, FileText, CheckCircle2, RotateCcw, FolderOpen, Users, Inbox, UserX, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveBlobToDevice } from '../../utils/fileDownload';
import { API_BASE_URL } from '../../config/api';

// India calendar date helpers (the report is always India time)
const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const shift = (ymd, days) => { const d = new Date(`${ymd}T12:00:00+05:30`); d.setUTCDate(d.getUTCDate() + days); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d); };
const hrs = (h) => { const m = Math.round((h || 0) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

function Tile({ icon: Icon, label, value, tone }) {
  return (
    <div className={`wr-tile ${tone || ''}`}>
      <span className="wr-tile-ic"><Icon size={16} /></span>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

function EngineerTable({ rows, period, onOpen }) {
  if (!rows.length) return <div className="wr-empty">No engineers.</div>;
  const sorted = [...rows].sort((a, b) => (b.submitted - a.submitted) || (b.hours - a.hours));
  return (
    <div className="wr-table" role="table">
      <div className="wr-tr wr-th" role="row">
        <span>Engineer</span><span>{period === 'week' ? 'Days' : 'In – Out'}</span><span>Hours</span><span>Visits</span><span>Reports</span><span>Approved</span><span>Open</span>
      </div>
      {sorted.map((r) => (
        <button type="button" className={`wr-tr ${!r.daysPresent ? 'wr-absent' : ''}`} role="row" key={r.id} onClick={() => onOpen(r)}>
          <span className="wr-name">{r.name}{r.missedCheckOut && <em title="Forgot to check out">no check-out</em>}</span>
          <span>{period === 'week' ? `${r.daysPresent}` : (r.daysPresent ? `${r.firstIn || '—'} – ${r.onDutyNow ? 'on duty' : (r.lastOut || '—')}` : 'Absent')}</span>
          <span>{r.daysPresent ? hrs(r.hours) : '—'}</span>
          <span>{r.siteVisits}</span>
          <span>{r.submitted}{r.returned ? <em className="wr-ret">↩{r.returned}</em> : null}</span>
          <span>{r.approved}</span>
          <span>{r.openNow}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Daily / weekly work report. Engineers see their own; a branch admin their branch (tap an engineer for theirs);
 * the Super Admin every branch. Opens from the 8 PM notification, the dashboard, or anywhere via
 * window.dispatchEvent(new CustomEvent('gcr_open_work_report', { detail: { period, date } })).
 */
export default function WorkReport({ initialPeriod = 'day', initialDate = '', onClose }) {
  const [period, setPeriod] = useState(initialPeriod === 'week' ? 'week' : 'day');
  const [ymd, setYmd] = useState(initialDate || todayYmd());
  const [userId, setUserId] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setData(null); setErr('');
    const q = new URLSearchParams({ period, date: ymd, ...(userId ? { userId } : {}) });
    fetch(`${API_BASE_URL}/api/work-report?${q}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not load the report.'); return j; })
      .then(setData).catch((e) => setErr(e.message));
  }, [period, ymd, userId]);
  useEffect(() => { load(); }, [load]);
  // The same report as a polished PDF (to keep, print or share on WhatsApp)
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const q = new URLSearchParams({ period, date: ymd, ...(userId ? { userId } : {}) });
      const r = await fetch(`${API_BASE_URL}/api/work-report/pdf?${q}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not make the PDF.');
      const name = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || `Gouru_${period === 'week' ? 'Weekly' : 'Daily'}_Report_${ymd}.pdf`;
      await saveBlobToDevice(await r.blob(), name, { successMsg: 'Report PDF saved' });
    } catch (e2) { toast.error(e2.message); } finally { setPdfBusy(false); }
  };
  const step = period === 'week' ? 7 : 1;
  const atToday = shift(ymd, step) > todayYmd();   // nothing to show in the future
  const t = data?.totals;
  const e = data?.engineer;

  return createPortal(
    <div className="wr-bg" onClick={onClose}>
      <div className="wr-sheet" role="dialog" aria-modal="true" aria-label="Work report" onClick={(ev) => ev.stopPropagation()}>
        <div className="wr-top">
          {userId ? <button type="button" className="wr-back" onClick={() => setUserId('')}><ChevronLeft size={18} /> All</button> : <span />}
          <b>{period === 'week' ? 'Weekly report' : 'Daily report'}</b>
          <button type="button" className="wr-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="wr-seg" role="tablist">
          {['day', 'week'].map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p === 'day' ? 'Day' : 'Week'}</button>
          ))}
        </div>
        <div className="wr-nav">
          <button type="button" onClick={() => setYmd(shift(ymd, -step))} aria-label="Earlier"><ChevronLeft size={18} /></button>
          <span>{data?.label || '…'}</span>
          <button type="button" onClick={() => setYmd(shift(ymd, step))} disabled={atToday} aria-label="Later"><ChevronRight size={18} /></button>
        </div>

        {err ? <div className="wr-empty">{err}</div> : !data ? <div className="wr-empty"><Loader2 size={20} className="spin" /></div> : (
          <>
            <div className="wr-title">{data.kind === 'engineer' ? (e?.name || '') : data.kind === 'branch' ? `${data.branch?.name || 'Branch'} branch` : 'All branches'}
              <button type="button" className="wr-pdf" onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? <Loader2 size={15} className="spin" /> : <Download size={15} />} PDF</button>
            </div>
            {data.kind === 'engineer' && e && (
              <>
                <div className="wr-tiles">
                  <Tile icon={Clock} label={period === 'week' ? `${e.daysPresent} day${e.daysPresent === 1 ? '' : 's'} present` : (e.daysPresent ? `In ${e.firstIn || '—'} · Out ${e.onDutyNow ? 'on duty' : (e.lastOut || '—')}` : 'Not checked in')} value={e.daysPresent ? hrs(e.hours) : '—'} tone="blue" />
                  <Tile icon={MapPin} label="Site visits" value={e.siteVisits} tone="green" />
                  <Tile icon={FileText} label="Reports submitted" value={e.submitted} tone="indigo" />
                  <Tile icon={CheckCircle2} label="Approved" value={e.approved} tone="green" />
                  <Tile icon={RotateCcw} label="Returned to fix" value={e.returned} tone={e.returned ? 'orange' : ''} />
                  <Tile icon={FolderOpen} label="Open cases now" value={e.openNow} />
                </div>
                {e.missedCheckOut && <div className="wr-note">A check-out was missed and closed automatically.</div>}
              </>
            )}
            {data.kind !== 'engineer' && t && (
              <>
                <div className="wr-tiles">
                  <Tile icon={Users} label={period === 'week' ? 'Engineers who worked' : 'Engineers present'} value={`${t.present}/${t.engineers}`} tone="blue" />
                  <Tile icon={MapPin} label="Site visits" value={t.siteVisits} tone="green" />
                  <Tile icon={FileText} label="Reports submitted" value={t.submitted} tone="indigo" />
                  <Tile icon={CheckCircle2} label="Approved" value={t.approved} tone="green" />
                  <Tile icon={Inbox} label="Waiting review" value={t.waitingReview} tone={t.waitingReview ? 'orange' : ''} />
                  <Tile icon={UserX} label="Not assigned" value={t.unassigned} tone={t.unassigned ? 'red' : ''} />
                </div>
                <div className="wr-meta">{t.newCases} new case{t.newCases === 1 ? '' : 's'} · {t.returned} returned to fix · {hrs(t.hours)} on duty in all · {t.open} open</div>
                {data.kind === 'all' && data.branches?.length > 0 && (
                  <>
                    <div className="wr-sec">Branches</div>
                    <div className="wr-table">
                      <div className="wr-tr wr-th wr-b"><span>Branch</span><span>Present</span><span>Visits</span><span>Reports</span><span>Approved</span><span>Review</span></div>
                      {data.branches.map((b) => (
                        <div className="wr-tr wr-b" key={b.id}>
                          <span className="wr-name">{b.name}</span><span>{b.totals.present}/{b.totals.engineers}</span><span>{b.totals.siteVisits}</span>
                          <span>{b.totals.submitted}</span><span>{b.totals.approved}</span><span>{b.totals.waitingReview}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="wr-sec">Engineers</div>
                <EngineerTable rows={data.engineers || []} period={period} onOpen={(r) => setUserId(r.id)} />
                <div className="wr-foot">Tap an engineer for their own report. Times are India time.</div>
              </>
            )}
          </>
        )}
        <style>{`
          .wr-bg { position: fixed; inset: 0; z-index: 10040; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; }
          @media (min-width: 768px) { .wr-bg { align-items: center; } }
          .wr-sheet { width: 100%; max-width: 720px; max-height: 94vh; overflow-y: auto; background: #f2f2f7; border-radius: 18px 18px 0 0; padding: 12px 16px calc(20px + env(safe-area-inset-bottom)); }
          @media (min-width: 768px) { .wr-sheet { border-radius: 18px; } }
          .wr-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 10px; }
          .wr-top b { font-size: 17px; }
          .wr-pdf { float: right; display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 999px; padding: 6px 12px; background: #0f2a5c; color: #fde68a; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
          .wr-pdf:disabled { opacity: .6; }
          .wr-x { justify-self: end; border: 0; background: #e5e7eb; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }
          .wr-back { justify-self: start; border: 0; background: transparent; color: #2563eb; font: inherit; font-weight: 600; display: flex; align-items: center; cursor: pointer; padding: 0; }
          .wr-seg { display: flex; background: #e5e7eb; border-radius: 10px; padding: 3px; margin-bottom: 10px; }
          .wr-seg button { flex: 1; border: 0; background: transparent; border-radius: 8px; padding: 7px; font: inherit; font-weight: 600; color: #334155; cursor: pointer; }
          .wr-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); color: #0f172a; }
          .wr-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
          .wr-nav span { font-weight: 700; color: #0f172a; }
          .wr-nav button { border: 0; background: #fff; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #2563eb; }
          .wr-nav button:disabled { opacity: .35; cursor: default; }
          .wr-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 2px 2px 10px; text-transform: capitalize; }
          .wr-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          @media (max-width: 420px) { .wr-tiles { grid-template-columns: repeat(2, 1fr); } }
          .wr-tile { background: #fff; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
          .wr-tile b { font-size: 22px; color: #0f172a; }
          .wr-tile small { font-size: 12px; color: #64748b; line-height: 1.3; }
          .wr-tile-ic { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: #f1f5f9; color: #475569; }
          .wr-tile.blue .wr-tile-ic { background: #dbeafe; color: #1d4ed8; } .wr-tile.green .wr-tile-ic { background: #dcfce7; color: #15803d; }
          .wr-tile.indigo .wr-tile-ic { background: #e0e7ff; color: #4338ca; } .wr-tile.orange .wr-tile-ic { background: #ffedd5; color: #c2410c; }
          .wr-tile.red .wr-tile-ic { background: #fee2e2; color: #b91c1c; }
          .wr-meta { font-size: 13px; color: #64748b; margin: 10px 4px 0; }
          .wr-note { margin-top: 10px; font-size: 13px; color: #9a3412; background: #fff7ed; border-radius: 10px; padding: 8px 12px; }
          .wr-sec { font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #64748b; margin: 18px 4px 6px; }
          .wr-table { background: #fff; border-radius: 14px; overflow-x: auto; }
          .wr-tr { width: 100%; min-width: 560px; display: grid; grid-template-columns: 1.6fr 1.3fr .8fr .7fr .8fr .8fr .6fr; gap: 6px; align-items: center; padding: 10px 14px; border: 0; border-bottom: 1px solid #f1f5f9; background: transparent; font: inherit; font-size: 13.5px; color: #0f172a; text-align: left; cursor: pointer; }
          .wr-tr.wr-b { grid-template-columns: 1.6fr .9fr .8fr .8fr .8fr .8fr; cursor: default; }
          .wr-tr:last-child { border-bottom: 0; }
          .wr-th { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; cursor: default; }
          button.wr-tr:hover { background: #f8fafc; }
          .wr-name { font-weight: 600; display: flex; flex-direction: column; }
          .wr-name em, .wr-ret { font-style: normal; font-size: 11px; color: #c2410c; font-weight: 600; }
          .wr-ret { margin-left: 4px; }
          .wr-absent { color: #94a3b8; }
          .wr-empty { text-align: center; color: #64748b; padding: 30px 10px; }
          .wr-foot { font-size: 12px; color: #94a3b8; margin: 10px 4px 0; }
          body.dark-theme .wr-sheet { background: #000; } body.dark-theme .wr-tile, body.dark-theme .wr-table, body.dark-theme .wr-nav button { background: #1c1c1e; }
          body.dark-theme .wr-tile b, body.dark-theme .wr-title, body.dark-theme .wr-nav span, body.dark-theme .wr-tr { color: #fff; }
          body.dark-theme .wr-seg { background: #2c2c2e; } body.dark-theme .wr-seg button.on { background: #3a3a3c; color: #fff; }
          body.dark-theme .wr-tr { border-color: #2c2c2e; } body.dark-theme .wr-x { background: #2c2c2e; color: #fff; }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}

/** Mounted once in the app: opens the report when a notification (or a button) asks for it */
export function WorkReportHost() {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const onOpen = (ev) => setOpen({ period: ev?.detail?.period || 'day', date: ev?.detail?.date || '' });
    window.addEventListener('gcr_open_work_report', onOpen);
    return () => window.removeEventListener('gcr_open_work_report', onOpen);
  }, []);
  if (!open) return null;
  return <WorkReport initialPeriod={open.period} initialDate={open.date} onClose={() => setOpen(null)} />;
}

export const openWorkReport = (period = 'day', date = '') => window.dispatchEvent(new CustomEvent('gcr_open_work_report', { detail: { period, date } }));
