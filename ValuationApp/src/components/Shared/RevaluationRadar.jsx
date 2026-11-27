import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radar, Loader2, RefreshCw, CheckCircle2, X, RotateCcw, CalendarClock, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import askConfirm from './askConfirm';

// Revaluation Radar: properties Gouru valued that are due (or nearly due) for the bank's periodic revaluation.
// mode 'admin' (Super Admin / branch admin: start the new case) or 'bank' (bank staff: request it).
const REASONS = ['Loan closed', 'Property sold', 'Bank will do it later', 'Other'];

const money = (v) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : v ? `₹${Math.round(v).toLocaleString('en-IN')}` : '—');
const day = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

export function useRevaluationCount() {
  const [n, setN] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/revaluation/due`).then((r) => (r.ok ? r.json() : null)).then((d) => setN(d ? d.totals.count : null)).catch(() => setN(null));
  }, []);
  return n;
}

export default function RevaluationRadar({ mode = 'admin' }) {
  const bank = mode === 'bank';
  const [view, setView] = useState('todo'); // 'todo' | 'done'
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [why, setWhy] = useState(null); // case id whose "not needed" reasons are open

  const load = useCallback(() => {
    setData(null);
    fetch(`${API_BASE_URL}/api/revaluation/due?all=1`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Could not load.'); return d; })
      .then(setData).catch((e) => setData({ error: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (row, path, body, done) => {
    setBusy(row.id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/revaluation/${encodeURIComponent(row.id)}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      toast.success(done(d));
      setWhy(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const start = async (row) => {
    if (!(await askConfirm({
      title: bank ? 'Request revaluation?' : 'Start revaluation?',
      message: `${row.clientName} · ${row.fileNumber}. A new case is made with the same customer, property details and documents — only a fresh site visit is needed.`,
      confirmText: bank ? 'Request' : 'Start',
    }))) return;
    act(row, 'request', {}, (d) => `${d.case.fileNumber} created${bank ? ' — Gouru will schedule the visit' : ' — assign an engineer in New cases'}`);
  };

  const rows = data && data.rows ? data.rows : [];
  const todo = rows.filter((r) => !r.state);
  const done = rows.filter((r) => r.state);
  const t = data && data.totals;
  const list = view === 'todo' ? todo : done;

  return (
    <div className="rr">
      <div className="rr-head">
        <span className="rr-ic"><Radar size={20} /></span>
        <span className="rr-ht"><b>Revaluation Radar</b><small>{bank ? 'Properties you sent to Gouru that are due for the bank’s revaluation' : 'Properties Gouru valued that are due for the bank’s revaluation'}</small></span>
        <button type="button" className="rr-ref" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button>
      </div>

      {!data ? <div className="rr-empty"><Loader2 size={18} className="spin" /></div> : data.error ? <div className="rr-empty">{data.error}</div> : (
        <>
          <div className="rr-tiles">
            <div className={t.overdue ? 'bad' : ''}><b>{t.overdue}</b><span>Overdue</span></div>
            <div className={t.soon ? 'warn' : ''}><b>{t.soon}</b><span>Due in 60 days</span></div>
            <div><b>{money(t.value)}</b><span>Security value</span></div>
          </div>
          <div className="rr-tabs" role="tablist">
            <button role="tab" aria-selected={view === 'todo'} className={view === 'todo' ? 'on' : ''} onClick={() => setView('todo')}>To do ({todo.length})</button>
            <button role="tab" aria-selected={view === 'done'} className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Done ({done.length})</button>
          </div>

          {list.length === 0 ? (
            <div className="rr-empty">{view === 'todo' ? <><CheckCircle2 size={18} /> Nothing due right now. Gouru checks every day and reminds you on the 1st of each month.</> : 'Nothing here yet.'}</div>
          ) : (
            <div className="rr-list">
              {list.map((r) => (
                <div className="rr-row" key={r.id}>
                  <div className="rr-top">
                    <div className="rr-who"><b>{r.clientName || 'Customer'}</b><small>{[r.fileNumber, r.bankName + (r.bankBranch ? `, ${r.bankBranch}` : ''), !bank && r.branchName].filter(Boolean).join(' · ')}</small></div>
                    {!r.state && <span className={`rr-pill ${r.daysLeft < 0 ? 'bad' : 'warn'}`}>{r.daysLeft < 0 ? `Overdue ${-r.daysLeft} d` : r.daysLeft === 0 ? 'Due today' : `Due in ${r.daysLeft} d`}</span>}
                  </div>
                  <div className="rr-meta">
                    <span><CalendarClock size={13} /> Valued {day(r.valuedOn)} · every {r.years} yr{r.years === 1 ? '' : 's'}</span>
                    <span><IndianRupee size={13} /> {money(r.value)}</span>
                  </div>
                  {r.address && <div className="rr-addr">{r.address}</div>}

                  {r.state === 'requested' && <div className="rr-done ok"><CheckCircle2 size={14} /> Requested{r.reval && r.reval.newFileNumber ? ` as ${r.reval.newFileNumber}` : ''}{r.reval && r.reval.byName ? ` by ${r.reval.byName}` : ''}</div>}
                  {r.state === 'dismissed' && (
                    <div className="rr-done"><X size={14} /> Not needed{r.reval && r.reval.reason ? ` — ${r.reval.reason}` : ''}
                      {!bank && <button type="button" className="rr-link" disabled={busy === r.id} onClick={() => act(r, 'restore', {}, () => 'Back in To do')}><RotateCcw size={13} /> Undo</button>}
                    </div>
                  )}

                  {!r.state && (why === r.id ? (
                    <div className="rr-why">
                      <span>Why is it not needed?</span>
                      <div>{REASONS.map((x) => <button key={x} type="button" disabled={busy === r.id} onClick={() => act(r, 'dismiss', { reason: x }, () => 'Marked not needed')}>{x}</button>)}</div>
                      <button type="button" className="rr-link" onClick={() => setWhy(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="rr-btns">
                      <button type="button" className="rr-go" disabled={busy === r.id} onClick={() => start(r)}>{busy === r.id ? <Loader2 size={16} className="spin" /> : bank ? 'Request revaluation' : 'Start revaluation'}</button>
                      <button type="button" className="rr-no" disabled={busy === r.id} onClick={() => setWhy(r.id)}>Not needed</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="rr-note">{bank
            ? 'Banks re-value the properties they hold as security every few years. Request it here and Gouru makes the case with the old details and documents — only a fresh site visit is needed.'
            : 'The period per bank is set in Settings → Banks → Revaluation. Starting one makes a new case with the same customer, property details and documents; assign an engineer as usual.'}</p>
        </>
      )}
      <style>{`
        .rr { display: flex; flex-direction: column; gap: 12px; }
        .rr-head { display: flex; align-items: center; gap: 10px; }
        .rr-ic { width: 40px; height: 40px; border-radius: 12px; background: #0f766e; color: #fff; display: grid; place-items: center; flex: none; }
        .rr-ht { flex: 1; min-width: 0; display: flex; flex-direction: column; } .rr-ht b { font-size: 17px; color: #0f172a; } .rr-ht small { font-size: 12.5px; color: #64748b; line-height: 1.35; }
        .rr-ref { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #e2e8f0; background: #fff; color: #475569; display: grid; place-items: center; cursor: pointer; flex: none; }
        .rr-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .rr-tiles div { background: #fff; border: 1px solid #eef2f7; border-radius: 12px; padding: 10px 8px; text-align: center; }
        .rr-tiles b { display: block; font-size: 19px; color: #0f172a; } .rr-tiles span { font-size: 11.5px; color: #64748b; }
        .rr-tiles .bad b { color: #dc2626; } .rr-tiles .warn b { color: #d97706; }
        .rr-tabs { display: flex; gap: 4px; background: #e2e8f0; border-radius: 10px; padding: 3px; }
        .rr-tabs button { flex: 1; border: 0; background: none; border-radius: 8px; padding: 8px; font-weight: 600; font-size: 14px; color: #475569; cursor: pointer; font-family: inherit; }
        .rr-tabs button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15,23,42,.1); }
        .rr-list { display: flex; flex-direction: column; gap: 10px; }
        .rr-row { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
        .rr-top { display: flex; align-items: flex-start; gap: 8px; }
        .rr-who { flex: 1; min-width: 0; display: flex; flex-direction: column; } .rr-who b { font-size: 15px; color: #0f172a; } .rr-who small { font-size: 12.5px; color: #64748b; line-height: 1.35; }
        .rr-pill { flex: none; font-size: 12px; font-weight: 700; border-radius: 99px; padding: 3px 9px; }
        .rr-pill.bad { background: #fee2e2; color: #b91c1c; } .rr-pill.warn { background: #fef3c7; color: #92400e; }
        .rr-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: #475569; } .rr-meta span { display: inline-flex; align-items: center; gap: 4px; }
        .rr-addr { font-size: 12.5px; color: #64748b; line-height: 1.35; }
        .rr-btns { display: flex; gap: 8px; margin-top: 4px; }
        .rr-go { flex: 1.4; min-height: 42px; border: 0; border-radius: 12px; background: #0f766e; color: #fff; font-weight: 700; font-size: 14.5px; cursor: pointer; font-family: inherit; display: grid; place-items: center; }
        .rr-no { flex: 1; min-height: 42px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #475569; font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit; }
        .rr-go:disabled, .rr-no:disabled { opacity: .55; }
        .rr-why { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; font-size: 13px; color: #475569; }
        .rr-why div { display: flex; flex-wrap: wrap; gap: 6px; }
        .rr-why div button { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 99px; padding: 6px 12px; font-size: 13px; cursor: pointer; font-family: inherit; color: #0f172a; }
        .rr-link { align-self: flex-start; border: 0; background: none; color: #2563eb; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 0; display: inline-flex; align-items: center; gap: 4px; font-family: inherit; }
        .rr-done { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: #64748b; } .rr-done.ok { color: #047857; font-weight: 600; }
        .rr-done .rr-link { margin-left: auto; }
        .rr-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px 12px; color: #64748b; font-size: 14px; text-align: center; line-height: 1.45; }
        .rr-note { font-size: 12px; color: #64748b; line-height: 1.45; margin: 0; }
        body.dark-theme .rr-ht b, body.dark-theme .rr-tiles b, body.dark-theme .rr-who b { color: #fff; }
        body.dark-theme .rr-tiles div, body.dark-theme .rr-row, body.dark-theme .rr-ref, body.dark-theme .rr-no { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .rr-tabs { background: #2c2c2e; } body.dark-theme .rr-tabs button.on { background: #3a3a3c; color: #fff; }
      `}</style>
    </div>
  );
}

/** Full-screen sheet with the radar (admin dashboard) */
export function RevaluationSheet({ onClose }) {
  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <div className="fs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Revaluation Radar">
        <div className="fs-nav"><span /><span className="fs-title">Revaluation</span><button type="button" className="fs-link fs-strong" onClick={onClose}>Done</button></div>
        <RevaluationRadar mode="admin" />
      </div>
    </div>,
    document.body,
  );
}
