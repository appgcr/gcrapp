import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader2, X, Plus, Building2, Undo2, Download, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { isSuperAdmin } from '../../utils/session';

if (typeof window !== 'undefined' && pdfjs && pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

/**
 * Fees: what each approved valuation earns, what the banks have paid, and what is still due.
 * Invoices are made automatically when a report is approved.
 */
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const ymd = (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
function periodRange(p) {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60000);
  const y = ist.getUTCFullYear(); const m = ist.getUTCMonth();
  if (p === 'month') return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: ymd(now) };
  if (p === 'last') { const s = new Date(Date.UTC(y, m - 1, 1)); const e = new Date(Date.UTC(y, m, 0)); return { from: s.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) }; }
  if (p === 'fy') { const fy = m >= 3 ? y : y - 1; return { from: `${fy}-04-01`, to: ymd(now) }; }
  return {};
}
const STATUS = { paid: ['Paid', 'ok'], partial: ['Part paid', 'warn'], unpaid: ['Unpaid', 'due'], none: ['No invoice', 'muted'] };

export default function AdminFees({ currentUser }) {
  const [period, setPeriod] = useState('fy');
  const [status, setStatus] = useState('');
  const [bank, setBank] = useState('');
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pay, setPay] = useState(null);       // case being marked paid
  const [feeEdit, setFeeEdit] = useState(null);
  const [pdfFor, setPdfFor] = useState(null);
  const [firmOpen, setFirmOpen] = useState(false);

  const load = useCallback(() => {
    const r = periodRange(period);
    const qs = new URLSearchParams({ ...r, ...(status ? { status } : {}), ...(bank ? { bank } : {}) });
    fetch(`${API_BASE_URL}/api/billing?${qs}`).then((x) => x.json()).then((d) => setData(d.items ? d : { items: [], totals: {}, byBank: [] })).catch(() => setData({ items: [], totals: {}, byBank: [] }));
  }, [period, status, bank]);
  useEffect(() => { load(); }, [load]);

  const banks = useMemo(() => [...new Set((data?.byBank || []).map((b) => b.bank))], [data]);
  const t = data?.totals || {};

  const call = async (id, url, opts, ok) => {
    setBusyId(id);
    try {
      const r = await fetch(`${API_BASE_URL}${url}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      if (ok) toast.success(ok);
      load();
      return d;
    } catch (err) { toast.error(err.message); return null; } finally { setBusyId(null); }
  };

  return (
    <div className="fee">
      <div className="fee-top">
        <div>
          <h2>Fees</h2>
          <p>Invoices are made when a report is approved.</p>
        </div>
        <button type="button" className="fee-firm" onClick={() => setFirmOpen(true)}><Building2 size={16} /> Firm details</button>
      </div>

      <div className="fee-chips">
        {[['month', 'This month'], ['last', 'Last month'], ['fy', 'This year (FY)'], ['all', 'All']].map(([k, l]) => (
          <button type="button" key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>

      <div className="fee-tiles">
        <div><span>Billed</span><b>{inr(t.billed)}</b><small>{t.count || 0} reports</small></div>
        <div><span>Received</span><b className="ok">{inr(t.received)}</b><small>&nbsp;</small></div>
        <div><span>Outstanding</span><b className="due">{inr(t.outstanding)}</b><small>{t.unpaid || 0} unpaid</small></div>
      </div>
      {(t.feeMissing > 0) && <div className="fee-warn">{t.feeMissing} invoice{t.feeMissing > 1 ? 's have' : ' has'} no fee — set the bank's fees in Settings → Banks, or tap the fee on a row.</div>}

      {(data?.byBank || []).filter((b) => b.outstanding > 0).length > 0 && (
        <div className="fee-banks">
          <div className="fee-h">Due by bank</div>
          {data.byBank.filter((b) => b.outstanding > 0).map((b) => (
            <button type="button" key={b.bank} className={bank === b.bank ? 'on' : ''} onClick={() => setBank(bank === b.bank ? '' : b.bank)}>
              <span>{b.bank}</span><b>{inr(b.outstanding)}</b>
            </button>
          ))}
        </div>
      )}

      <div className="fee-filter">
        {[['', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part paid'], ['paid', 'Paid'], ['none', 'No invoice']].map(([k, l]) => (
          <button type="button" key={k || 'all'} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>
        ))}
        {banks.length > 1 && (
          <select value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Bank">
            <option value="">All banks</option>
            {banks.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {!data ? <div className="fee-empty"><Loader2 className="spin" size={20} /></div>
        : data.items.length === 0 ? <div className="fee-empty">No approved reports in this period.</div>
        : data.items.map((c) => {
          const b = c.billing; const [label, tone] = STATUS[c.status] || STATUS.none;
          const due = b ? Math.max(0, b.total - (b.received || 0)) : 0;
          return (
            <div className="fee-row" key={c.id}>
              <div className="fee-row-top">
                <div className="fee-who">
                  <b>{c.clientName}</b>
                  <small>{c.fileNumber} · {c.bankName}{c.bankBranch ? ` – ${c.bankBranch}` : ''}</small>
                  <small>{b?.invoiceNo ? `${b.invoiceNo} · ` : ''}{c.approvedAt ? new Date(c.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small>
                </div>
                <span className={`fee-pill ${tone}`}>{label}</span>
              </div>
              {b ? (
                <div className="fee-money">
                  <button type="button" className="fee-amt" onClick={() => setFeeEdit({ id: c.id, fee: b.fee, name: c.clientName })} title="Change fee">
                    {b.feeSet ? inr(b.total) : 'Set fee'} <Pencil size={12} />
                    {b.gst > 0 && <small>{inr(b.fee)} + GST {inr(b.gst)}</small>}
                  </button>
                  {b.received > 0 && <span className="fee-rcv">Received {inr(b.received)}{due > 0 ? ` · Due ${inr(due)}` : ''}</span>}
                </div>
              ) : null}
              <div className="fee-actions">
                {!b && <button type="button" disabled={busyId === c.id} onClick={() => call(c.id, `/api/billing/${c.id}/invoice`, { method: 'POST' }, 'Invoice created')}><Plus size={14} /> Create invoice</button>}
                {b && <button type="button" onClick={() => setPdfFor(c)}><FileText size={14} /> Invoice</button>}
                {b && due > 0 && b.feeSet && <button type="button" className="pri" onClick={() => setPay({ ...c, due })}>Mark paid</button>}
                {b && (b.payments || []).length > 0 && <button type="button" disabled={busyId === c.id} onClick={() => { if (window.confirm('Undo the last payment entry?')) call(c.id, `/api/billing/${c.id}/payment`, { method: 'DELETE' }, 'Payment removed'); }}><Undo2 size={14} /> Undo</button>}
              </div>
            </div>
          );
        })}

      {pay && <PaySheet c={pay} onClose={() => setPay(null)} onSave={async (body) => { const ok = await call(pay.id, `/api/billing/${pay.id}/payment`, { method: 'POST', body: JSON.stringify(body) }, 'Payment recorded'); if (ok) setPay(null); }} />}
      {feeEdit && <FeeSheet f={feeEdit} onClose={() => setFeeEdit(null)} onSave={async (fee) => { const ok = await call(feeEdit.id, `/api/billing/${feeEdit.id}/fee`, { method: 'PUT', body: JSON.stringify({ fee }) }, 'Fee saved'); if (ok) setFeeEdit(null); }} />}
      {pdfFor && <InvoiceViewer c={pdfFor} onClose={() => setPdfFor(null)} />}
      {firmOpen && <FirmSheet canEdit={isSuperAdmin(currentUser)} onClose={() => setFirmOpen(false)} />}

      <style>{CSS}</style>
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return createPortal(
    <div className="fee-bg" onClick={onClose}>
      <div className="fee-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="fee-sheet-h"><b>{title}</b><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
      <style>{CSS}</style>
    </div>, document.body);
}

function PaySheet({ c, onClose, onSave }) {
  const [amount, setAmount] = useState(String(c.due));
  const [mode, setMode] = useState('NEFT');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  return (
    <Sheet title="Record payment" onClose={onClose}>
      <div className="fee-sub">{c.clientName} · {c.billing.invoiceNo} · due {inr(c.due)}</div>
      <label className="fee-f"><span>Amount (₹)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></label>
      <label className="fee-f"><span>Paid by</span>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>{['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label className="fee-f"><span>Reference</span><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / cheque no (optional)" /></label>
      <label className="fee-f"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <button type="button" className="fee-save" disabled={!(Number(amount) > 0)} onClick={() => onSave({ amount: Number(amount), mode, ref, date })}>Save payment</button>
    </Sheet>
  );
}

function FeeSheet({ f, onClose, onSave }) {
  const [fee, setFee] = useState(f.fee ? String(f.fee) : '');
  return (
    <Sheet title="Fee for this report" onClose={onClose}>
      <div className="fee-sub">{f.name} · before GST</div>
      <label className="fee-f"><span>Fee (₹)</span><input inputMode="decimal" autoFocus value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 3000" /></label>
      <button type="button" className="fee-save" disabled={fee === ''} onClick={() => onSave(Number(fee))}>Save fee</button>
    </Sheet>
  );
}

function InvoiceViewer({ c, onClose }) {
  const [blob, setBlob] = useState(null);
  const [err, setErr] = useState('');
  const [pages, setPages] = useState(1);
  const [w, setW] = useState(Math.min(520, window.innerWidth - 48));
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/billing/${c.id}/invoice.pdf`).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not make the invoice.'); return r.blob(); })
      .then(setBlob).catch((e) => setErr(e.message));
    const onR = () => setW(Math.min(520, window.innerWidth - 48));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [c.id]);
  const name = `Invoice_${String(c.billing.invoiceNo).replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
  const download = () => {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  return (
    <Sheet title={c.billing.invoiceNo} onClose={onClose}>
      {err ? <div className="fee-empty">{err}</div> : !blob ? <div className="fee-empty"><Loader2 className="spin" size={20} /></div> : (
        <>
          <div className="fee-pdf">
            <Document file={blob} onLoadSuccess={(d) => setPages(d.numPages)} loading={<Loader2 className="spin" size={20} />}>
              {Array.from({ length: pages }, (_, i) => <Page key={i} pageNumber={i + 1} width={w} renderTextLayer={false} renderAnnotationLayer={false} />)}
            </Document>
          </div>
          <button type="button" className="fee-save" onClick={download}><Download size={16} /> Download PDF</button>
        </>
      )}
    </Sheet>
  );
}

const FIRM_FIELDS = [
  ['name', 'Firm name'], ['address', 'Address', 'area'], ['phone', 'Phone'], ['email', 'Email'],
  ['gstin', 'GSTIN', null, 'Leave empty if not GST registered — no GST is added then'], ['gstPercent', 'GST %'], ['pan', 'PAN'], ['sac', 'SAC code'],
  ['accountName', 'Account name'], ['bankName', 'Bank'], ['accountNo', 'Account no'], ['ifsc', 'IFSC'], ['upi', 'UPI ID'],
  ['prefix', 'Invoice prefix', null, 'e.g. GV → GV/2026-27/0001'], ['terms', 'Note on invoice', 'area'],
];
function FirmSheet({ canEdit, onClose }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`${API_BASE_URL}/api/billing/settings`).then((r) => r.json()).then(setF).catch(() => setF({})); }, []);
  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/billing/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      toast.success('Firm details saved'); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Firm details on invoices" onClose={onClose}>
      {!f ? <div className="fee-empty"><Loader2 className="spin" size={20} /></div> : (
        <>
          {!canEdit && <div className="fee-sub">Only the Super Admin can change these.</div>}
          {FIRM_FIELDS.map(([k, label, kind, hint]) => (
            <label className="fee-f" key={k}><span>{label}</span>
              {kind === 'area'
                ? <textarea rows={2} value={f[k] ?? ''} disabled={!canEdit} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                : <input value={f[k] ?? ''} disabled={!canEdit} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
              {hint && <em>{hint}</em>}
            </label>
          ))}
          {canEdit && <button type="button" className="fee-save" disabled={busy} onClick={save}>{busy ? <Loader2 className="spin" size={16} /> : 'Save'}</button>}
        </>
      )}
    </Sheet>
  );
}

const CSS = `
.fee { max-width: 860px; margin: 0 auto; padding-bottom: 24px; }
.fee-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.fee-top h2 { margin: 0; font-size: 22px; color: #0f172a; }
.fee-top p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
.fee-firm { display: flex; align-items: center; gap: 6px; border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 8px 12px; font-size: 13px; font-weight: 700; color: #1d4ed8; cursor: pointer; white-space: nowrap; }
.fee-chips, .fee-filter { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; -webkit-overflow-scrolling: touch; }
.fee-chips button, .fee-filter button { flex-shrink: 0; border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 7px 13px; font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; }
.fee-chips button.on, .fee-filter button.on { background: #0f172a; color: #fff; border-color: #0f172a; }
.fee-filter select { flex-shrink: 0; border: 1px solid #e2e8f0; border-radius: 999px; padding: 7px 10px; font-size: 13px; background: #fff; }
.fee-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.fee-tiles div { background: #fff; border-radius: 14px; padding: 12px; border: 1px solid #eef2f7; min-width: 0; }
.fee-tiles span { display: block; font-size: 12px; color: #64748b; }
.fee-tiles b { display: block; font-size: 18px; color: #0f172a; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fee-tiles b.ok { color: #15803d; } .fee-tiles b.due { color: #c2410c; }
.fee-tiles small { font-size: 11.5px; color: #94a3b8; }
.fee-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 12px; padding: 9px 12px; font-size: 12.5px; margin-bottom: 12px; }
.fee-banks { background: #fff; border-radius: 14px; border: 1px solid #eef2f7; padding: 6px 12px; margin-bottom: 12px; }
.fee-h { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .04em; padding: 6px 0; }
.fee-banks button { width: 100%; display: flex; justify-content: space-between; gap: 8px; border: 0; border-top: 1px solid #f1f5f9; background: none; padding: 9px 0; font-size: 14px; color: #0f172a; cursor: pointer; text-align: left; }
.fee-banks button.on { color: #1d4ed8; font-weight: 700; }
.fee-banks b { color: #c2410c; white-space: nowrap; }
.fee-row { background: #fff; border-radius: 14px; border: 1px solid #eef2f7; padding: 12px; margin-bottom: 10px; }
.fee-row-top { display: flex; justify-content: space-between; gap: 10px; }
.fee-who { display: flex; flex-direction: column; min-width: 0; }
.fee-who b { font-size: 15px; color: #0f172a; }
.fee-who small { font-size: 12px; color: #64748b; margin-top: 1px; }
.fee-pill { flex-shrink: 0; align-self: flex-start; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
.fee-pill.ok { background: #dcfce7; color: #15803d; } .fee-pill.warn { background: #fef3c7; color: #b45309; }
.fee-pill.due { background: #ffedd5; color: #c2410c; } .fee-pill.muted { background: #f1f5f9; color: #64748b; }
.fee-money { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.fee-amt { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; border: 0; background: none; padding: 0; font-size: 18px; font-weight: 800; color: #0f172a; cursor: pointer; }
.fee-amt small { font-size: 11.5px; font-weight: 500; color: #64748b; }
.fee-rcv { font-size: 12.5px; color: #15803d; font-weight: 600; }
.fee-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.fee-actions button { display: flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 7px 12px; font-size: 12.5px; font-weight: 700; color: #334155; cursor: pointer; }
.fee-actions button.pri { background: #16a34a; border-color: #16a34a; color: #fff; }
.fee-empty { display: flex; justify-content: center; padding: 28px; color: #64748b; font-size: 14px; }
.fee-bg { position: fixed; inset: 0; z-index: 3000; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; }
.fee-sheet { width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; background: #fff; border-radius: 18px 18px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
.fee-sheet-h { display: flex; justify-content: space-between; align-items: center; font-size: 16px; color: #0f172a; margin-bottom: 4px; }
.fee-sheet-h button { border: 0; background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; }
.fee-sub { font-size: 12.5px; color: #64748b; margin-bottom: 10px; }
.fee-f { display: block; margin-top: 10px; }
.fee-f span { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px; }
.fee-f input, .fee-f select, .fee-f textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; font-size: 16px; font-family: inherit; background: #fff; }
.fee-f em { display: block; font-style: normal; font-size: 11.5px; color: #94a3b8; margin-top: 3px; }
.fee-save { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 16px; border: 0; border-radius: 12px; padding: 13px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; }
.fee-save:disabled { opacity: .5; }
.fee-pdf { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #f1f5f9; border-radius: 12px; padding: 8px; overflow: hidden; }
.fee-pdf canvas { max-width: 100%; height: auto !important; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
body.dark-theme .fee-top h2, body.dark-theme .fee-who b, body.dark-theme .fee-amt, body.dark-theme .fee-tiles b:not(.ok):not(.due) { color: #fff; }
body.dark-theme .fee-row, body.dark-theme .fee-tiles div, body.dark-theme .fee-banks, body.dark-theme .fee-sheet { background: #1c1c1e; border-color: #3a3a3c; }
body.dark-theme .fee-banks button { color: #fff; border-color: #2c2c2e; }
`;
