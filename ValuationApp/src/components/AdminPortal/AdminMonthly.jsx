import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { saveBlobToDevice } from '../../utils/fileDownload';

/** One month at a glance: work done, time taken, engineers, banks and money. */
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const cr = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : inr(n));
const thisMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const shift = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };

export default function AdminMonthly() {
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    fetch(`${API_BASE_URL}/api/insights/monthly?month=${month}`).then((r) => r.json()).then((x) => setD(x.work ? x : { error: x.error || 'Could not load.' })).catch(() => setD({ error: 'Could not load.' }));
  }, [month]);

  const exportCsv = async () => {
    if (!d || d.error) return;
    const q = (v) => { let t = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [
      [`Gouru Valuations — ${d.label}`], [],
      ['Requests', d.work.requests], ['Submitted', d.work.submitted], ['Approved', d.work.approved], ['Returned', d.work.returned], ['Return rate %', d.work.returnRate],
      ['Value approved (Rs)', Math.round(d.work.valueApproved)], ['Median days request→approved', d.time.medianTurnaroundDays ?? ''], ['Median days request→submitted', d.time.medianFieldDays ?? ''],
      ['Fees billed (Rs)', d.money.billed], ['Received this month (Rs)', d.money.receivedInMonth], ['Outstanding now (Rs)', d.money.outstandingNow], [],
      ['Engineer', 'Approved', 'Submitted', 'Returned', 'Flagged at submit', 'Median days to submit'],
      ...d.engineers.map((e) => [e.name, e.approved, e.submitted, e.returned, e.flagged, e.medianDays ?? '']), [],
      ['Bank', 'Requests', 'Approved', 'Value (Rs)', 'Billed (Rs)', 'Received (Rs)'],
      ...d.banks.map((b) => [b.bank, b.requests, b.approved, Math.round(b.value), b.billed, b.received]),
    ];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
    await saveBlobToDevice(blob, `Gouru_Monthly_${d.month}.csv`, { successMsg: 'Monthly report exported' });
  };

  return (
    <div className="mth">
      <div className="mth-top">
        <button type="button" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
        <h2>{d?.label || '…'}</h2>
        <button type="button" onClick={() => setMonth(shift(month, 1))} disabled={month >= thisMonth()} aria-label="Next month"><ChevronRight size={20} /></button>
        <button type="button" className="mth-x" onClick={exportCsv} disabled={!d || d.error}><FileSpreadsheet size={16} /> Excel</button>
      </div>
      {!d ? <div className="mth-empty"><Loader2 className="spin" size={22} /></div> : d.error ? <div className="mth-empty">{d.error}</div> : (
        <>
          <div className="mth-tiles">
            <Tile label="Requests" v={d.work.requests} />
            <Tile label="Approved" v={d.work.approved} tone="ok" />
            <Tile label="Returned" v={d.work.returned} sub={`${d.work.returnRate}% of submitted`} tone={d.work.returnRate > 20 ? 'bad' : ''} />
            <Tile label="Open now" v={d.work.openNow} />
            <Tile label="Days to approve" v={d.time.medianTurnaroundDays ?? '—'} sub="middle case, from request" />
            <Tile label="Days in field" v={d.time.medianFieldDays ?? '—'} sub="request → submitted" />
            <Tile label="Value approved" v={cr(d.work.valueApproved)} />
            <Tile label="Fees billed" v={inr(d.money.billed)} />
            <Tile label="Received" v={inr(d.money.receivedInMonth)} tone="ok" sub="payments this month" />
            <Tile label="Outstanding" v={inr(d.money.outstandingNow)} tone={d.money.outstandingNow ? 'bad' : ''} sub="all invoices, today" />
          </div>

          <div className="mth-h">Engineers</div>
          {d.engineers.length === 0 ? <div className="mth-none">No reports approved this month.</div> : (
            <div className="mth-table">
              <div className="mth-tr mth-th"><span>Engineer</span><span>Approved</span><span>Returned</span><span>Days</span></div>
              {d.engineers.map((e) => (
                <div className="mth-tr" key={e.name}><span>{e.name}{e.flagged ? <small> · {e.flagged} flagged</small> : null}</span><b>{e.approved}</b><span className={e.returned ? 'bad' : ''}>{e.returned}</span><span>{e.medianDays ?? '—'}</span></div>
              ))}
            </div>
          )}

          <div className="mth-h">Banks</div>
          {d.banks.length === 0 ? <div className="mth-none">No requests this month.</div> : (
            <div className="mth-table">
              <div className="mth-tr mth-th"><span>Bank</span><span>Requests</span><span>Approved</span><span>Billed</span></div>
              {d.banks.map((b) => (
                <div className="mth-tr" key={b.bank}><span>{b.bank}</span><span>{b.requests}</span><b>{b.approved}</b><span>{b.billed ? inr(b.billed) : '—'}</span></div>
              ))}
            </div>
          )}
        </>
      )}
      <style>{`
        .mth { max-width: 860px; margin: 0 auto; padding-bottom: 24px; }
        .mth-top { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .mth-top h2 { flex: 1; text-align: center; margin: 0; font-size: 20px; color: #0f172a; }
        .mth-top button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; height: 36px; min-width: 36px; display: grid; place-items: center; cursor: pointer; color: #334155; }
        .mth-top button:disabled { opacity: .4; }
        .mth-top .mth-x { display: flex; gap: 6px; padding: 0 12px; font-weight: 700; font-size: 13px; color: #1d4ed8; }
        .mth-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .mth-t { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; padding: 12px; min-width: 0; }
        .mth-t span { display: block; font-size: 12px; color: #64748b; }
        .mth-t b { display: block; font-size: 20px; color: #0f172a; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mth-t b.ok { color: #15803d; } .mth-t b.bad { color: #c2410c; }
        .mth-t small { font-size: 11px; color: #94a3b8; }
        .mth-h { margin: 18px 0 8px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #64748b; }
        .mth-table { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; overflow: hidden; }
        .mth-tr { display: grid; grid-template-columns: minmax(0, 1fr) 64px 64px 72px; gap: 6px; padding: 10px 12px; border-top: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; align-items: center; }
        .mth-tr > *:not(:first-child) { text-align: right; }
        .mth-tr small { color: #b45309; font-size: 11.5px; }
        .mth-tr .bad { color: #c2410c; font-weight: 700; }
        .mth-tr > span:first-child { overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 420px) { .mth-tr { grid-template-columns: minmax(0, 1fr) 54px 56px 64px; font-size: 13px; padding: 9px 10px; } .mth-top h2 { font-size: 17px; } }
        .mth-th { border-top: 0; background: #f8fafc; font-size: 11.5px; font-weight: 800; color: #64748b; }
        .mth-none, .mth-empty { padding: 18px; text-align: center; color: #64748b; font-size: 14px; display: flex; justify-content: center; }
        body.dark-theme .mth-top h2, body.dark-theme .mth-t b:not(.ok):not(.bad), body.dark-theme .mth-tr { color: #fff; }
        body.dark-theme .mth-t, body.dark-theme .mth-table { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .mth-th { background: #2c2c2e; }
      `}</style>
    </div>
  );
}

function Tile({ label, v, sub, tone = '' }) {
  return <div className="mth-t"><span>{label}</span><b className={tone}>{v}</b>{sub && <small>{sub}</small>}</div>;
}
