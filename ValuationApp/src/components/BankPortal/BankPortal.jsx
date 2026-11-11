import React, { useCallback, useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, FileText, LogOut, Download, Loader2, RefreshCw, KeyRound, CheckCircle2, Building2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ReportViewer, { fetchReport } from '../Shared/ReportViewer';
import './BankPortal.css';

const STEPS = ['Received by GCR', 'Engineer assigned', 'Site visit done', 'Under GCR review', 'Report ready'];
const EMPTY = {
  clientName: '', clientFatherName: '', clientPhone: '', clientAddress: '', propertyType: '', propertyAddress: '',
  surveyNo: '', extent: '', loanPurpose: '', loanAmount: '', bankBranch: '', contactPerson: '', contactPhone: '', notes: '', urgency: 'Normal',
};
const PURPOSES = ['Housing Loan', 'Mortgage / LAP', 'Construction Loan', 'Plot Purchase Loan', 'Agriculture Loan', 'Business / Commercial Loan', 'Revaluation', 'Other'];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** Bank employee's portal: send valuation requests to GCR and follow them until the report is ready. */
export default function BankPortal({ currentUser, handleLogout }) {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('list');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`${API_BASE_URL}/api/bank/requests`, { cache: 'no-store' })
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
    if (!form.propertyType) m.push('Property type');
    if (form.propertyAddress.trim().length < 10) m.push('Property address');
    if (!form.loanPurpose) m.push('Purpose');
    return m;
  };

  const submit = async (e) => {
    e.preventDefault();
    const m = missing();
    if (m.length) { toast.error(`Please fill: ${m.join(', ')}`); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bank/requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send the request.');
      toast.success(`Sent to GCR as ${d.fileNumber}`);
      setForm({ ...EMPTY, bankBranch: me?.bankBranch || '' });
      setTab('list');
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const counts = (rows || []).reduce((a, r) => { a[r.reportReady ? 'ready' : 'open'] += 1; return a; }, { open: 0, ready: 0 });

  return (
    <div className="bp">
      <Toaster position="top-center" />
      <header className="bp-top">
        <div className="bp-brand">
          <img src="/gcr_logo.png" alt="" width="34" height="34" />
          <div>
            <div className="bp-brand-name">GCR Valuation</div>
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
              Requests go straight to GCR{me?.gcrBranch ? ` ${me.gcrBranch.name}` : ''}. The branch assigns an engineer, the site is inspected
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
              <p>Send your first valuation request to GCR.</p>
              <button className="bp-btn bp-primary" onClick={() => setTab('new')}><Plus size={16} /> New request</button>
            </div>
          ) : (
            <div className="bp-list">
              {rows.map((r) => (
                <article key={r.id} className="bp-card" data-testid="bank-request-card">
                  <div className="bp-card-head">
                    <div>
                      <div className="bp-card-title">{r.clientName}</div>
                      <div className="bp-card-sub">{r.fileNumber} · {r.propertyType}{r.requestDetails?.loanPurpose ? ` · ${r.requestDetails.loanPurpose}` : ''}</div>
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
                    <span>Sent {fmtDate(r.requestedAt)}{r.engineerName ? ` · Engineer: ${r.engineerName}` : ''}{r.inspectionDate ? ` · Visit ${fmtDate(r.inspectionDate)}` : ''}</span>
                    {r.reportReady && (
                      <button className="bp-btn bp-primary" onClick={() => setViewing(r)} data-testid="download-report"><Download size={16} /> View / download report</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {tab === 'new' && (
          <form className="bp-form" onSubmit={submit} noValidate>
            <fieldset>
              <legend>Customer (borrower)</legend>
              <label>Name *<input value={form.clientName} onChange={set('clientName')} placeholder="As on the sale deed" /></label>
              <label>Father / husband name<input value={form.clientFatherName} onChange={set('clientFatherName')} placeholder="e.g. S/o Venkata Rao" /></label>
              <label>Mobile *<input value={form.clientPhone} onChange={set('clientPhone')} inputMode="numeric" placeholder="10 digits" /></label>
              <label className="bp-wide">Customer address<input value={form.clientAddress} onChange={set('clientAddress')} placeholder="Present address" /></label>
            </fieldset>

            <fieldset>
              <legend>Property</legend>
              <label>Property type *
                <select value={form.propertyType} onChange={set('propertyType')}>
                  <option value="">Choose…</option>
                  {(me?.propertyTypes || []).map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Survey no.<input value={form.surveyNo} onChange={set('surveyNo')} placeholder="If known" /></label>
              <label>Extent<input value={form.extent} onChange={set('extent')} placeholder="e.g. 200 Sq.Yds / 4.5 Cents" /></label>
              <label className="bp-wide">Property address / location *<textarea rows={2} value={form.propertyAddress} onChange={set('propertyAddress')} placeholder="Door no, street, village / ward, mandal, district" /></label>
            </fieldset>

            <fieldset>
              <legend>Loan & contact</legend>
              <label>Purpose *
                <select value={form.loanPurpose} onChange={set('loanPurpose')}>
                  <option value="">Choose…</option>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label>Loan amount (₹)<input value={form.loanAmount} onChange={set('loanAmount')} placeholder="Optional" inputMode="numeric" /></label>
              <label>Your bank branch<input value={form.bankBranch} onChange={set('bankBranch')} /></label>
              <label>Site contact person<input value={form.contactPerson} onChange={set('contactPerson')} placeholder="Who will show the property" /></label>
              <label>Site contact mobile<input value={form.contactPhone} onChange={set('contactPhone')} inputMode="numeric" placeholder="10 digits" /></label>
              <label>Priority
                <select value={form.urgency} onChange={set('urgency')}><option>Normal</option><option>Urgent</option></select>
              </label>
              <label className="bp-wide">Notes for GCR<textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything the engineer should know (timings, documents with the customer…)" /></label>
            </fieldset>

            <div className="bp-form-foot">
              <p className="bp-muted">The customer’s documents (sale deed, plan, tax receipt…) are collected and checked by the GCR engineer at the site.</p>
              <button type="submit" className="bp-btn bp-primary" disabled={busy} data-testid="send-request">
                {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Send to GCR
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="bp-foot">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
        {me?.gcrBranch?.phone ? <> · GCR {me.gcrBranch.name}: {me.gcrBranch.phone}</> : null}
      </footer>

      {viewing && (
        <ReportViewer
          title={viewing.clientName}
          subtitle={`${viewing.fileNumber} · approved valuation report`}
          fileName={`${String(viewing.fileNumber).replace(/[^\w-]+/g, '_')}.docx`}
          load={() => fetchReport(`${API_BASE_URL}/api/bank/requests/${encodeURIComponent(viewing.id)}/report?format=docx`)}
          onClose={() => setViewing(null)}
        />
      )}
      {pwOpen && <ChangePassword user={currentUser} onClose={() => setPwOpen(false)} />}
    </div>
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
