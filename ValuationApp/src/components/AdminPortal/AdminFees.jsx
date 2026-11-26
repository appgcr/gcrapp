import askConfirm from '../Shared/askConfirm';
import SendInvoice from './SendInvoice';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader2, X, Plus, Building2, Undo2, Download, Pencil, Ban, FileSpreadsheet, Landmark, QrCode, Info, Lock, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { isSuperAdmin } from '../../utils/session';
import { saveBlobToDevice } from '../../utils/fileDownload';

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
const STATUS = { paid: ['Paid', 'ok'], partial: ['Part paid', 'warn'], unpaid: ['Unpaid', 'due'], none: ['No invoice', 'muted'], cancelled: ['Cancelled', 'muted'] };

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
  const [payOpen, setPayOpen] = useState(false);
  const [cancelFor, setCancelFor] = useState(null);

  const load = useCallback(() => {
    const r = periodRange(period);
    const qs = new URLSearchParams({ ...r, ...(status ? { status } : {}), ...(bank ? { bank } : {}) });
    fetch(`${API_BASE_URL}/api/billing?${qs}`).then((x) => x.json()).then((d) => setData(d.items ? d : { items: [], totals: {}, byBank: [] })).catch(() => setData({ items: [], totals: {}, byBank: [] }));
  }, [period, status, bank]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const r = periodRange(period);
      const qs = new URLSearchParams({ ...r, ...(status ? { status } : {}), ...(bank ? { bank } : {}) });
      const res = await fetch(`${API_BASE_URL}/api/billing/export.csv?${qs}`);
      if (!res.ok) throw new Error('Could not export.');
      const blob = await res.blob();
      await saveBlobToDevice(blob, `Gouru_Fees_${r.from || 'all'}_${r.to || 'today'}.csv`, { successMsg: 'Fees exported — opens in Excel' });
    } catch (e) { toast.error(e.message); }
  };

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
        <div className="fee-topbtns">
          <button type="button" className="fee-firm" onClick={exportCsv}><FileSpreadsheet size={16} /> Excel</button>
          <button type="button" className="fee-firm" onClick={() => setPayOpen(true)}><Landmark size={16} /> Payment details</button>
          <button type="button" className="fee-firm" onClick={() => setFirmOpen(true)}><Building2 size={16} /> Firm details</button>
        </div>
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
        {[['', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part paid'], ['paid', 'Paid'], ['none', 'No invoice'], ['cancelled', 'Cancelled']].map(([k, l]) => (
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
          const live = c.billing && c.status !== 'cancelled';
          const b = live ? c.billing : null; const [label, tone] = STATUS[c.status] || STATUS.none;
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
                {c.status === 'cancelled' && <span className="fee-cxl">{c.billing.invoiceNo} cancelled{c.billing.cancelled?.reason ? `: ${c.billing.cancelled.reason}` : ''}</span>}
                {!b && <button type="button" disabled={busyId === c.id} onClick={() => call(c.id, `/api/billing/${c.id}/invoice`, { method: 'POST' }, 'Invoice created')}><Plus size={14} /> {c.status === 'cancelled' ? 'New invoice' : 'Create invoice'}</button>}
                {b && <button type="button" onClick={() => setPdfFor(c)}><FileText size={14} /> Invoice</button>}
                {b && due > 0 && b.feeSet && <SendInvoice c={c} label={(b.reminders || []).length || (Date.now() - new Date(b.invoiceDate).getTime()) > 7 * 86400000 ? 'Remind' : 'Send'} />}
                {b && due > 0 && b.feeSet && <button type="button" className="pri" onClick={() => setPay({ ...c, due })}>Mark paid</button>}
                {b && !(b.received > 0) && <button type="button" onClick={() => setCancelFor(c)}><Ban size={14} /> Cancel</button>}
                {b && (b.payments || []).length > 0 && <button type="button" disabled={busyId === c.id} onClick={async () => { if (await askConfirm({ title: 'Undo last payment?', message: 'The last payment entry is removed from this invoice.', confirmText: 'Undo', tone: 'danger' })) call(c.id, `/api/billing/${c.id}/payment`, { method: 'DELETE' }, 'Payment removed'); }}><Undo2 size={14} /> Undo</button>}
              </div>
            </div>
          );
        })}

      {pay && <PaySheet c={pay} onClose={() => setPay(null)} onSave={async (body) => { const ok = await call(pay.id, `/api/billing/${pay.id}/payment`, { method: 'POST', body: JSON.stringify(body) }, 'Payment recorded'); if (ok) setPay(null); }} />}
      {feeEdit && <FeeSheet f={feeEdit} onClose={() => setFeeEdit(null)} onSave={async (fee) => { const ok = await call(feeEdit.id, `/api/billing/${feeEdit.id}/fee`, { method: 'PUT', body: JSON.stringify({ fee }) }, 'Fee saved'); if (ok) setFeeEdit(null); }} />}
      {pdfFor && <InvoiceViewer c={pdfFor} onClose={() => setPdfFor(null)} />}
      {cancelFor && <CancelSheet c={cancelFor} onClose={() => setCancelFor(null)} onSave={async (reason) => { const ok = await call(cancelFor.id, `/api/billing/${cancelFor.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }, 'Invoice cancelled'); if (ok) setCancelFor(null); }} />}
      {firmOpen && <FirmSheet canEdit={isSuperAdmin(currentUser)} onClose={() => setFirmOpen(false)} />}
      {payOpen && <PaymentSheet currentUser={currentUser} onClose={() => setPayOpen(false)} />}

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

function CancelSheet({ c, onClose, onSave }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet title="Cancel invoice" onClose={onClose}>
      <div className="fee-sub">{c.billing.invoiceNo} · {c.clientName}. The number stays in your records as cancelled; you can make a new invoice after.</div>
      <label className="fee-f"><span>Reason</span><input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong fee, wrong bank" /></label>
      <button type="button" className="fee-save danger" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>Cancel invoice</button>
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
  return <PdfSheet url={`${API_BASE_URL}/api/billing/${c.id}/invoice.pdf`} title={c.billing.invoiceNo} fileName={`Invoice_${String(c.billing.invoiceNo).replace(/[^A-Za-z0-9]+/g, '-')}.pdf`} onClose={onClose} />;
}

/** Any PDF from our API in a bottom sheet, with Download (used for invoices; also by the bank portal) */
export function PdfSheet({ url, title, fileName, onClose }) {
  const [blob, setBlob] = useState(null);
  const [err, setErr] = useState('');
  const [pages, setPages] = useState(1);
  const [w, setW] = useState(Math.min(520, window.innerWidth - 48));
  useEffect(() => {
    fetch(url).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not make the invoice.'); return r.blob(); })
      .then(setBlob).catch((e) => setErr(e.message));
    const onR = () => setW(Math.min(520, window.innerWidth - 48));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [url]);
  const name = fileName;
  const download = () => {
    saveBlobToDevice(blob, name).catch(() => {});
  };
  return (
    <Sheet title={title} onClose={onClose}>
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

// Where invoices are paid — per branch (its admin or the Super Admin) or the firm default (Super Admin)
// A QR photo → a small PNG (under 1 MB)
const shrinkImage = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error('Could not read the picture.'));
  r.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a picture.'));
    img.onload = () => {
      const k = Math.min(1, 700 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/png'));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});
function PaymentSheet({ currentUser, onClose }) {
  const sup = isSuperAdmin(currentUser);
  const [branches, setBranches] = useState([]);
  const [scope, setScope] = useState(sup ? 'firm' : (currentUser?.branchId || ''));
  const [d, setD] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const qrRef = React.useRef(null);
  useEffect(() => { if (sup) fetch(`${API_BASE_URL}/api/branches`).then((r) => (r.ok ? r.json() : [])).then((l) => setBranches(Array.isArray(l) ? l : [])).catch(() => {}); }, [sup]);
  useEffect(() => {
    setD(null);
    fetch(`${API_BASE_URL}/api/billing/payment?branchId=${encodeURIComponent(scope)}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; })
      .then((j) => { setD(j); setF(j.payment || {}); }).catch((e) => { toast.error(e.message || 'Could not load.'); setD({ payment: {} }); });
  }, [scope]);
  const pickQr = async (file) => {
    if (!file) return;
    try { const url = await shrinkImage(file); setF((x) => ({ ...x, qrDataUrl: url })); } catch (e) { toast.error(e.message); }
  };
  const save = async () => {
    const what = d?.scope === 'firm' ? 'the firm default (used by every branch without its own)' : `${d?.branchName || 'this'} branch`;
    if (!(await askConfirm({ title: 'Change where invoices are paid?', message: `New payment details for ${what}.\nInvoices and pay links will show them from now on. The Super Admin and the branch admins are told about this change.`, confirmText: 'Save', tone: 'danger' }))) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/billing/payment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, branchId: scope }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not save.');
      toast.success(j.unchanged ? 'Nothing changed' : 'Payment details saved'); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const canEdit = !!d?.canEdit;
  const row = (k, label, ph, extra = {}) => (
    <label className="pm-row" key={k}>
      <span>{label}</span>
      <input value={f[k] ?? ''} placeholder={ph} disabled={!canEdit} autoComplete="off" {...extra} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  const when = (t, withYear) => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit' });
  return (
    <Sheet title="Payment details" onClose={onClose}>
      <div className="fee-sub">Shown on every invoice and pay link, so banks know where to pay.</div>
      {sup && (
        <label className="pm-scope">
          <span><Building2 size={16} /> Applies to</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="firm">Firm default</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} branch</option>)}
          </select>
        </label>
      )}
      {!d ? <div className="fee-empty"><Loader2 className="spin" size={20} /></div> : (
        <>
          {d.scope === 'branch' && d.usesFirm && (
            <div className="pm-note"><Info size={15} /><span><b>{d.branchName}</b> uses the firm default now{d.firm?.accountNo ? ` (account ••••${String(d.firm.accountNo).slice(-4)})` : ''}. Fill these to give it its own.</span></div>
          )}
          {!canEdit && <div className="pm-note"><Lock size={15} /><span>Only this branch's admin or the Super Admin can change these.</span></div>}

          <div className="pm-sec"><Landmark size={14} /> Bank account</div>
          <div className="pm-group">
            {row('accountName', 'Account name', 'As in the bank')}
            {row('bankName', 'Bank', 'e.g. SBI, Kadapa')}
            {row('accountNo', 'Account no', 'Digits only', { inputMode: 'numeric' })}
            {row('ifsc', 'IFSC', 'e.g. SBIN0001234', { autoCapitalize: 'characters', className: 'up' })}
          </div>
          <div className="pm-foot">Account number and IFSC are checked before saving.</div>

          <div className="pm-sec"><QrCode size={14} /> UPI &amp; QR</div>
          <div className="pm-group">
            {row('upi', 'UPI ID', 'e.g. gouru@okaxis', { autoCapitalize: 'off' })}
            <div className="pm-qr">
              <input ref={qrRef} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files && e.target.files[0]; e.target.value = ''; pickQr(x); }} />
              {f.qrDataUrl
                ? <img src={f.qrDataUrl} alt="QR code on invoices" />
                : <button type="button" className="pm-qr-empty" disabled={!canEdit} onClick={() => qrRef.current?.click()} aria-label="Upload QR code"><QrCode size={26} /><small>Upload</small></button>}
              <div className="pm-qr-t">
                <b>QR code picture</b>
                <small>{f.qrDataUrl ? 'Invoices show this QR.' : 'Optional. Without it, a QR for the exact amount is made from the UPI ID.'}</small>
                {canEdit && f.qrDataUrl && (
                  <div className="pm-qr-b">
                    <button type="button" onClick={() => qrRef.current?.click()}>Change</button>
                    <button type="button" className="del" onClick={() => setF({ ...f, qrDataUrl: '' })}>Remove</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="pm-foot">PhonePe, GPay or bank merchant QR.</div>

          {(d.updatedAt || (Array.isArray(d.history) && d.history.length > 0)) && (
            <details className="pm-hist">
              <summary><History size={14} /> {d.updatedAt ? `Last changed by ${d.updatedByName || 'someone'} · ${when(d.updatedAt, true)}` : 'Change history'}</summary>
              {(d.history || []).map((h, i) => (
                <div key={i}><b>{when(h.at)} · {h.byName}</b>
                  {(h.changed || []).map((c, j) => <small key={j}>{c.field}: {c.from || '—'} → {c.to || '—'}</small>)}</div>
              ))}
            </details>
          )}
          {canEdit && (
            <div className="pm-bar">
              <button type="button" className="fee-save" disabled={busy} onClick={save}>{busy ? <Loader2 className="spin" size={16} /> : 'Save payment details'}</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

// Firm details on invoices, in three groups: [key, label, placeholder, kind]
const FIRM_GROUPS = [
  ['Firm', Building2, [['name', 'Firm name', 'e.g. Gouru Valuations'], ['address', 'Address', 'Door no, street, town, district', 'area'],
    ['phone', 'Phone', 'e.g. 98765 43210', 'tel'], ['email', 'Email', 'e.g. accounts@gouru.in', 'email']]],
  ['Tax', FileText, [['gstin', 'GSTIN', 'Leave empty if not GST registered'], ['gstPercent', 'GST %', 'e.g. 18', 'num'],
    ['pan', 'PAN', 'e.g. ABCDE1234F'], ['sac', 'SAC code', 'e.g. 998391']]],
  ['Invoice', FileSpreadsheet, [['prefix', 'Invoice prefix', 'e.g. GV'], ['terms', 'Note on invoice', 'e.g. Payment due within 15 days.', 'area']]],
];
const FIRM_FOOT = { Tax: 'No GST is added while GSTIN is empty.', Invoice: 'Invoice numbers look like GV/2026-27/0001.' };
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
  const field = ([k, label, ph, kind]) => (
    <label className="pm-row" key={k}>
      <span>{label}</span>
      {kind === 'area'
        ? <textarea rows={2} value={f[k] ?? ''} placeholder={ph} disabled={!canEdit} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <input value={f[k] ?? ''} placeholder={ph} disabled={!canEdit} autoComplete="off"
            inputMode={kind === 'num' ? 'decimal' : kind === 'tel' ? 'tel' : kind === 'email' ? 'email' : undefined}
            className={['gstin', 'pan', 'prefix'].includes(k) ? 'up' : undefined}
            onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </label>
  );
  return (
    <Sheet title="Firm details" onClose={onClose}>
      <div className="fee-sub">Printed at the top of every invoice. Bank account, UPI and QR are in <b>Payment details</b>.</div>
      {!f ? <div className="fee-empty"><Loader2 className="spin" size={20} /></div> : (
        <>
          {!canEdit && <div className="pm-note"><Lock size={15} /><span>Only the Super Admin can change these.</span></div>}
          {FIRM_GROUPS.map(([title, Icon, rows]) => (
            <React.Fragment key={title}>
              <div className="pm-sec"><Icon size={14} /> {title}</div>
              <div className="pm-group">{rows.map(field)}</div>
              {FIRM_FOOT[title] && <div className="pm-foot">{FIRM_FOOT[title]}</div>}
            </React.Fragment>
          ))}
          {canEdit && (
            <div className="pm-bar">
              <button type="button" className="fee-save" disabled={busy} onClick={save}>{busy ? <Loader2 className="spin" size={16} /> : 'Save firm details'}</button>
            </div>
          )}
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
.fee-qr { display: flex; align-items: center; gap: 12px; } .fee-qr img { width: 120px; height: 120px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
.fee-qr div { display: flex; flex-direction: column; gap: 6px; }
.fee-hist { margin-top: 8px; font-size: 12.5px; color: #475569; } .fee-hist summary { cursor: pointer; font-weight: 700; color: #1d4ed8; }
.fee-hist > div { border-top: 1px solid #f1f5f9; padding: 6px 0; display: flex; flex-direction: column; gap: 2px; } .fee-hist small { color: #64748b; }
.fee-save.danger { background: #dc2626; }
.pm-scope { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 6px 0 4px; padding: 10px 12px; border-radius: 12px; background: #f1f5f9; }
.pm-scope span { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: #334155; white-space: nowrap; }
.pm-scope select { min-width: 0; flex: 1; max-width: 62%; border: 0; background: transparent; font: inherit; font-size: 15px; font-weight: 600; color: #1d4ed8; text-align: right; text-align-last: right; cursor: pointer; }
.pm-note { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #eff6ff; color: #1e3a8a; font-size: 13px; line-height: 1.4; }
.pm-note svg { flex-shrink: 0; margin-top: 1px; }
.pm-sec { display: flex; align-items: center; gap: 6px; margin: 18px 4px 6px; font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #64748b; }
.pm-group { border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; overflow: hidden; }
.pm-row { display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 10px 14px 8px; border-bottom: 1px solid #eef2f7; cursor: text; }
.pm-row:last-child { border-bottom: 0; }
.pm-row span { font-size: 12.5px; font-weight: 700; color: #64748b; }
.pm-row input { width: 100%; box-sizing: border-box; border: 0; outline: none; background: transparent; padding: 4px 0 2px; font: inherit; font-size: 16px; color: #0f172a; text-align: left; caret-color: #2563eb; }
.pm-row input::placeholder { color: #a3aec0; }
.pm-row input.up:not(:placeholder-shown) { text-transform: uppercase; }
.pm-row textarea { width: 100%; box-sizing: border-box; border: 0; outline: none; background: transparent; padding: 4px 0 2px; font: inherit; font-size: 16px; line-height: 1.4; color: #0f172a; resize: vertical; caret-color: #2563eb; }
.pm-row textarea::placeholder { color: #a3aec0; }
.pm-row:focus-within { background: #f8fbff; box-shadow: inset 3px 0 0 #2563eb; }
.pm-row:focus-within span { color: #2563eb; }
.pm-row input:disabled { color: #475569; -webkit-text-fill-color: #475569; }
.pm-foot { margin: 6px 4px 0; font-size: 12px; color: #94a3b8; }
.pm-qr { display: flex; align-items: center; gap: 14px; padding: 12px 14px; }
.pm-qr img, .pm-qr-empty { width: 84px; height: 84px; flex-shrink: 0; border-radius: 12px; }
.pm-qr img { object-fit: contain; border: 1px solid #e2e8f0; background: #fff; }
.pm-qr-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1.5px dashed #93c5fd; background: #f8fbff; color: #2563eb; cursor: pointer; font-family: inherit; }
.pm-qr-empty small { font-size: 12px; font-weight: 700; }
.pm-qr-empty:disabled { opacity: .5; cursor: default; }
.pm-qr-t { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pm-qr-t b { font-size: 14.5px; color: #0f172a; }
.pm-qr-t small { font-size: 12.5px; color: #64748b; line-height: 1.35; }
.pm-qr-b { display: flex; gap: 8px; margin-top: 6px; }
.pm-qr-b button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 700; color: #1d4ed8; cursor: pointer; }
.pm-qr-b button.del { color: #dc2626; }
.pm-hist { margin-top: 16px; font-size: 12.5px; color: #475569; }
.pm-hist summary { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #64748b; font-weight: 600; list-style: none; }
.pm-hist summary::-webkit-details-marker { display: none; }
.pm-hist > div { border-top: 1px solid #f1f5f9; padding: 6px 0; display: flex; flex-direction: column; gap: 2px; } .pm-hist small { color: #64748b; }
.pm-bar { position: sticky; bottom: calc(-16px - env(safe-area-inset-bottom)); margin: 8px -16px calc(-16px - env(safe-area-inset-bottom)); padding: 4px 16px calc(16px + env(safe-area-inset-bottom)); background: linear-gradient(rgba(255,255,255,0), #fff 30%); }
body.dark-theme .pm-scope { background: #2c2c2e; } body.dark-theme .pm-scope span { color: #e5e5ea; } body.dark-theme .pm-scope select { color: #60a5fa; }
body.dark-theme .pm-note { background: #172554; color: #dbeafe; }
body.dark-theme .pm-group { background: #1c1c1e; border-color: #3a3a3c; } body.dark-theme .pm-row { border-color: #2c2c2e; }
body.dark-theme .pm-row input, body.dark-theme .pm-row textarea, body.dark-theme .pm-qr-t b { color: #fff; } body.dark-theme .pm-row span { color: #a1a1aa; } body.dark-theme .pm-row:focus-within { background: #232325; }
body.dark-theme .pm-qr-empty { background: #1e293b; border-color: #3b82f6; } body.dark-theme .pm-qr-b button { background: #2c2c2e; border-color: #3a3a3c; }
body.dark-theme .pm-bar { background: linear-gradient(rgba(28,28,30,0), #1c1c1e 30%); }
.fee-topbtns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.fee-cxl { font-size: 12px; color: #b91c1c; align-self: center; }
.fee-pdf { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #f1f5f9; border-radius: 12px; padding: 8px; overflow: hidden; }
.fee-pdf canvas { max-width: 100%; height: auto !important; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
body.dark-theme .fee-top h2, body.dark-theme .fee-who b, body.dark-theme .fee-amt, body.dark-theme .fee-tiles b:not(.ok):not(.due) { color: #fff; }
body.dark-theme .fee-row, body.dark-theme .fee-tiles div, body.dark-theme .fee-banks, body.dark-theme .fee-sheet { background: #1c1c1e; border-color: #3a3a3c; }
body.dark-theme .fee-banks button { color: #fff; border-color: #2c2c2e; }
`;
