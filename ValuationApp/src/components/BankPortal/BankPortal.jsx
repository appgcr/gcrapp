import PullDownReach from '../Shared/PullDownReach';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppToaster from '../Shared/AppToaster';
import { Plus, FileText, LogOut, Download, Loader2, RefreshCw, KeyRound, CheckCircle2, Building2, Receipt, Paperclip, Camera, X } from 'lucide-react';
import { uploadDocumentFile } from '../../utils/docFiles';
import { API_BASE_URL } from '../../config/api';
import ReportViewer, { fetchReport } from '../Shared/ReportViewer';
import './BankPortal.css';
import { PdfSheet } from '../AdminPortal/AdminFees';
import { reportFileName } from '../../utils/reportFileName';

const STEPS = ['Received by Gouru', 'Engineer assigned', 'Site visit done', 'Under Gouru review', 'Report ready'];
const EMPTY = { clientName: '', clientPhone: '', notes: '', bankBranch: '', documents: [], inspectionDate: '', inspectionTime: '', engineerId: '' };
const todayLocal = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** Bank employee's portal: send valuation requests to Gouru and follow them until the report is ready. */
export default function BankPortal({ currentUser, handleLogout }) {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('list');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  const load = useCallback(() => {
    return fetch(`${API_BASE_URL}/api/bank/requests`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setRows)
      .catch(() => { setRows([]); toast.error('Could not load your requests.'); });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/bank/me`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      setMe(d);
      if (d) setForm((f) => ({ ...f, bankBranch: f.bankBranch || d.bankBranch || '' }));
    }).catch(() => {});
    load();
  }, [load]);

  const set = (k) => (e) => {
    let v = e.target.value;
    if (['clientPhone', 'contactPhone'].includes(k)) v = v.replace(/\D/g, '').slice(0, 10);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const missing = () => {
    const m = [];
    if (form.clientName.trim().length < 3) m.push('Customer name');
    if (!/^[6-9]\d{9}$/.test(form.clientPhone)) m.push('Customer mobile (10 digits)');
    return m;
  };

  // Optional documents: uploaded straight away, sent with the request
  const [uploading, setUploading] = useState(0);
  const addFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (form.documents.length + list.length > 20) { toast.error('Up to 20 documents per request.'); return; }
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is over 50 MB.`);
        const url = await uploadDocumentFile(file);
        setForm((f) => ({ ...f, documents: [...f.documents, { name: file.name, url, size: file.size }] }));
      } catch (err) { toast.error(err.message); } finally { setUploading((n) => n - 1); }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const m = missing();
    if (m.length) { toast.error(`Please fill: ${m.join(', ')}`); return; }
    if (uploading) { toast('Please wait — documents are still uploading.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bank/requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send the request.');
      toast.success(`Sent to Gouru as ${d.fileNumber}`);
      setForm({ ...EMPTY, bankBranch: me?.bankBranch || '' });
      setTab('list');
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const counts = (rows || []).reduce((a, r) => { a[r.reportReady ? 'ready' : 'open'] += 1; return a; }, { open: 0, ready: 0 });

  return (
    <PullDownReach>
    <div className="bp">
      <AppToaster />
      <header className="bp-top">
        <div className="bp-brand">
          <img src="/gcr_logo.png" alt="" width="34" height="34" />
          <div>
            <div className="bp-brand-name">Gouru Valuations</div>
            <div className="bp-brand-sub">Bank portal</div>
          </div>
        </div>
        <div className="bp-user">
          <div className="bp-user-text">
            <b>{currentUser?.name}</b>
            <span>{[me?.designation || currentUser?.designation, me?.bankName || currentUser?.bankName, me?.bankBranch || currentUser?.bankBranch].filter(Boolean).join(' · ')}</span>
          </div>
          <button className="bp-icon" onClick={() => setPwOpen(true)} title="Change password" aria-label="Change password"><KeyRound size={18} /></button>
          <button className="bp-icon" onClick={handleLogout} title="Log out" aria-label="Log out"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="bp-main">
        <section className="bp-hero">
          <div>
            <h1>Valuation requests</h1>
            <p>
              Requests go straight to Gouru{me?.gcrBranch ? ` ${me.gcrBranch.name}` : ''}. The branch assigns an engineer, the site is inspected
              and you can download the signed report here as soon as it is approved.
            </p>
          </div>
          <div className="bp-stats">
            <div><b>{counts.open}</b><span>In progress</span></div>
            <div><b>{counts.ready}</b><span>Reports ready</span></div>
          </div>
        </section>

        <div className="bp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}><FileText size={16} /> My requests</button>
          <button role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')} data-testid="new-request-tab"><Plus size={16} /> New request</button>
          {tab === 'list' && <button className="bp-refresh" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button>}
        </div>

        {tab === 'list' && (
          rows === null ? <p className="bp-muted">Loading…</p> :
          rows.length === 0 ? (
            <div className="bp-empty">
              <Building2 size={30} />
              <h3>No requests yet</h3>
              <p>Send your first valuation request to Gouru.</p>
              <button className="bp-btn bp-primary" onClick={() => setTab('new')}><Plus size={16} /> New request</button>
            </div>
          ) : (
            <div className="bp-list">
              {rows.map((r) => (
                <article key={r.id} className="bp-card" data-testid="bank-request-card">
                  <div className="bp-card-head">
                    <div>
                      <div className="bp-card-title">{r.clientName}</div>
                      <div className="bp-card-sub">{[r.fileNumber, r.propertyType, r.requestDetails?.loanPurpose].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`bp-pill bp-${r.stage}`}>{r.stageLabel}</span>
                  </div>
                  <ol className="bp-steps" aria-label={`Progress: ${r.stageLabel}`}>
                    {STEPS.map((s, i) => (
                      <li key={s} className={i + 1 < r.step ? 'done' : i + 1 === r.step ? 'now' : ''}>
                        <span className="bp-dot">{i + 1 < r.step || (i + 1 === r.step && r.reportReady) ? <CheckCircle2 size={14} /> : i + 1}</span>
                        <span className="bp-step-label">{s}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="bp-card-foot">
                    <span>Sent {fmtDate(r.requestedAt)}{r.engineerName ? ` · Engineer: ${r.engineerName}` : ''}{r.visitPlanned && r.step < 3 ? ` · On the way ${new Date(r.visitPlanned.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
                    <span className="bp-acts">
                      {r.invoice && (
                        <button className="bp-btn" onClick={() => setInvoiceFor(r)}><Receipt size={16} /> Invoice {r.invoice.paid ? '· Paid' : `· ₹${Math.round(r.invoice.total - r.invoice.received).toLocaleString('en-IN')} due`}</button>
                      )}
                      {r.invoice && !r.invoice.paid && (
                        <button className="bp-btn bp-pay" onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/bank/requests/${encodeURIComponent(r.id)}/pay-link`);
                            const j = await res.json();
                            if (!res.ok) throw new Error(j.error || 'Could not open the payment page.');
                            window.open(j.url, '_blank', 'noopener');
                          } catch (err) { toast.error(err.message); }
                        }}>Pay ₹{Math.round(r.invoice.total - r.invoice.received).toLocaleString('en-IN')}</button>
                      )}
                      {r.reportReady && (
                        <button className="bp-btn bp-primary" onClick={() => setViewing(r)} data-testid="download-report"><Download size={16} /> View / download report</button>
                      )}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {tab === 'new' && (
          <form className="bp-form" onSubmit={submit} noValidate>
            <fieldset>
              <legend>Customer</legend>
              <label>Name *<input value={form.clientName} onChange={set('clientName')} placeholder="Customer name" autoComplete="off" /></label>
              <label>Mobile *<input value={form.clientPhone} onChange={set('clientPhone')} inputMode="numeric" placeholder="10 digits" /></label>
            </fieldset>

            <fieldset>
              <legend>Documents <small className="bp-opt">optional</small></legend>
              <div className="bp-wide bp-docs">
                <input id="bp-files" type="file" multiple hidden accept=".pdf,.doc,.docx,image/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <input id="bp-cam" type="file" hidden accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <div className="bp-doc-btns">
                  <label htmlFor="bp-files" className="bp-btn"><Paperclip size={16} /> Choose files</label>
                  <label htmlFor="bp-cam" className="bp-btn"><Camera size={16} /> Take photo</label>
                </div>
                <p className="bp-muted">Sale deed, plan, tax receipt… whatever you have. The Gouru engineer collects the rest at the site.</p>
                {(form.documents.length > 0 || uploading > 0) && (
                  <ul className="bp-doc-list">
                    {form.documents.map((d, i) => (
                      <li key={d.url}>
                        <FileText size={16} /><span>{d.name}</span>
                        <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setForm((f) => ({ ...f, documents: f.documents.filter((_, k) => k !== i) }))}><X size={15} /></button>
                      </li>
                    ))}
                    {uploading > 0 && <li className="up"><Loader2 size={16} className="spin" /><span>Uploading {uploading}…</span></li>}
                  </ul>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend>Schedule <small className="bp-opt">optional</small></legend>
              <label>Inspection date<input type="date" min={todayLocal()} value={form.inspectionDate} onChange={set('inspectionDate')} /></label>
              <label>Time<input type="time" value={form.inspectionTime} onChange={set('inspectionTime')} /></label>
              <label className="bp-wide">Engineer
                <select value={form.engineerId} onChange={set('engineerId')}>
                  <option value="">Let Gouru choose</option>
                  {(me?.engineers || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <p className="bp-muted bp-wide" style={{ margin: 0 }}>
                {form.engineerId
                  ? `The request goes straight to ${(me?.engineers || []).find((e) => e.id === form.engineerId)?.name || 'this engineer'}${me?.gcrBranch?.name ? ` at Gouru ${me.gcrBranch.name}` : ''}.`
                  : `${me?.gcrBranch?.name ? `Gouru ${me.gcrBranch.name}` : 'Gouru'} picks the engineer${(me?.engineers || []).length ? '' : ' (no engineers listed yet)'}.`}
              </p>
            </fieldset>

            <fieldset>
              <legend>Notes <small className="bp-opt">optional</small></legend>
              <label className="bp-wide"><textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything Gouru should know (property location, timings, contact person…)" aria-label="Notes" /></label>
            </fieldset>

            <div className="bp-form-foot">
              <button type="submit" className="bp-btn bp-primary" disabled={busy || uploading > 0} data-testid="send-request">
                {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Send to Gouru
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="bp-foot">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
        {me?.gcrBranch?.phone ? <> · Gouru {me.gcrBranch.name}: {me.gcrBranch.phone}</> : null}
      </footer>

      {invoiceFor && (
        <PdfSheet
          url={`${API_BASE_URL}/api/bank/requests/${encodeURIComponent(invoiceFor.id)}/invoice.pdf`}
          title={`Invoice ${invoiceFor.invoice.no}`}
          fileName={`Invoice_${String(invoiceFor.invoice.no).replace(/[^A-Za-z0-9]+/g, '-')}.pdf`}
          onClose={() => setInvoiceFor(null)}
        />
      )}
      {viewing && (
        <ReportViewer
          title={viewing.clientName}
          subtitle={`${viewing.fileNumber} · approved valuation report`}
          fileName={reportFileName(viewing)}
          load={() => fetchReport(`${API_BASE_URL}/api/bank/requests/${encodeURIComponent(viewing.id)}/report?format=docx`)}
          onClose={() => setViewing(null)}
        />
      )}
      {pwOpen && <ChangePassword user={currentUser} onClose={() => setPwOpen(false)} />}
    </div>
    </PullDownReach>
  );
}

function ChangePassword({ user, onClose }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error('Use at least 8 characters.'); return; }
    if (pw !== pw2) { toast.error('The two passwords are different.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user.username)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not change the password.');
      toast.success('Password changed.');
      onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="bp-modal-bg" onClick={onClose}>
      <form className="bp-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h3>Change password</h3>
        <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        <label>Type it again<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
        <div className="bp-modal-foot">
          <button type="button" className="bp-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="bp-btn bp-primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
