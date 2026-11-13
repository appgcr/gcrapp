import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, Loader2, UserPlus, Eye, Building2, FileImage } from 'lucide-react';
import LetterheadSettings from '../Shared/LetterheadSettings';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';
import { setBranchScope } from '../../utils/session';
import StaffFormSheet from './StaffFormSheet';

// Short code from a name, e.g. "Kadapa" → "KDP", "Tirupati" → "TRP"
const suggestCode = (name) => {
  const w = String(name).toUpperCase().replace(/[^A-Z ]/g, '').trim();
  if (!w) return '';
  const parts = w.split(/\s+/);
  if (parts.length > 1) return parts.map((p) => p[0]).join('').slice(0, 4);
  const consonants = w[0] + w.slice(1).replace(/[AEIOU]/g, '');
  return (consonants.length >= 3 ? consonants : w).slice(0, 3);
};

/** Super Admin: every branch with live numbers; create / edit branches and their admins. */
export default function BranchesPanel({ onOpenPerson }) {
  const [branches, setBranches] = useState(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [addAdminFor, setAddAdminFor] = useState(null);

  const load = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/branches?stats=1`);
      const d = await r.json();
      setBranches(Array.isArray(d) ? d : []);
    } catch { setBranches([]); }
  };
  useEffect(() => { load(); }, []);
  const changed = () => { load(); window.dispatchEvent(new Event('gcr_branches_changed')); };

  const open = branches?.find((b) => b.id === openId);

  return (
    <div className="br-wrap">
      <div className="gcr-section-head" style={{ alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 className="gcr-section-title" style={{ fontSize: '22px' }}>Branches</h2>
          <p className="gcr-section-sub">Each branch has its own admin, engineers and file numbers</p>
        </div>
        <button className="st-add" onClick={() => setCreating(true)}><Plus size={17} strokeWidth={2.4} /> New Branch</button>
      </div>

      {branches === null && <div className="br-empty"><Loader2 size={20} className="spin" /></div>}
      {branches?.length === 0 && (
        <div className="br-empty">
          <Building2 size={28} />
          <strong>No branches yet</strong>
          <span>Create your first branch, then add its admin.</span>
        </div>
      )}

      <div className="br-grid">
        {branches?.map((b) => (
          <button key={b.id} className="br-card" onClick={() => setOpenId(b.id)}>
            <div className="br-top">
              <span className="br-code">{b.code}</span>
              <div className="br-head">
                <div className="br-name">{b.name}{b.status === 'Inactive' && <span className="gcr-badge gray" style={{ marginLeft: 8 }}>Inactive</span>}</div>
                <div className="br-sub">
                  {b.admins.length ? b.admins.map((a) => a.name).join(', ') : <span className="br-warn">No admin yet</span>} · {b.engineerCount} engineer{b.engineerCount === 1 ? '' : 's'}
                </div>
              </div>
              <ChevronRight size={18} className="br-chev" />
            </div>
            <div className="br-stats">
              <div><b>{b.stats.thisMonth}</b><span>This month</span></div>
              <div><b style={{ color: '#2a78d6' }}>{b.stats.inField}</b><span>In field</span></div>
              <div><b style={{ color: '#eb6834' }}>{b.stats.review}</b><span>Review</span></div>
              <div><b style={{ color: '#008300' }}>{b.stats.done}</b><span>Done</span></div>
            </div>
          </button>
        ))}
      </div>

      {creating && <NewBranchSheet onClose={() => setCreating(false)} onCreated={(b) => { setCreating(false); changed(); setAddAdminFor(b); }} />}

      {open && (
        <BranchSheet
          branch={open}
          onClose={() => setOpenId(null)}
          onSaved={changed}
          onAddAdmin={() => setAddAdminFor(open)}
          onOpenPerson={(p) => { setOpenId(null); onOpenPerson?.(p); }}
        />
      )}

      {addAdminFor && (
        <StaffFormSheet
          role="ADMIN"
          branches={[addAdminFor]}
          defaultBranchId={addAdminFor.id}
          onClose={() => setAddAdminFor(null)}
          onCreated={() => { setAddAdminFor(null); changed(); }}
        />
      )}

      <style>{`
        .br-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 16px; background: #fff; border-radius: 14px; color: #8e8e93; text-align: center; font-size: 14px; }
        .br-empty strong { color: var(--gcr-label); font-size: 17px; }
        .br-grid { display: grid; gap: 12px; }
        @media (min-width: 900px) { .br-grid { grid-template-columns: 1fr 1fr; } }
        .br-card { width: 100%; text-align: left; border: none; background: #fff; border-radius: 14px; padding: 14px 16px; cursor: pointer; font: inherit; font-family: var(--gcr-font); box-shadow: 0 1px 2px rgba(0,0,0,.04); }
        .br-card:active { background: #f7f7f9; }
        .br-top { display: flex; align-items: center; gap: 12px; }
        .br-code { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(180deg, #3D9BFF, #0A7AFF); color: #fff; font-size: 13px; font-weight: 700; letter-spacing: .5px; display: flex; align-items: center; justify-content: center; flex: none; }
        .br-head { flex: 1; min-width: 0; }
        .br-name { font-size: 17px; font-weight: 600; color: var(--gcr-label); display: flex; align-items: center; }
        .br-sub { font-size: 13px; color: var(--gcr-label-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .br-warn { color: #ff9500; font-weight: 600; }
        .br-chev { color: #c7c7cc; flex: none; }
        .br-stats { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--gcr-separator); }
        .br-stats div { display: flex; flex-direction: column; align-items: center; gap: 1px; }
        .br-stats b { font-size: 20px; font-weight: 700; color: var(--gcr-label); font-variant-numeric: tabular-nums; }
        .br-stats span { font-size: 11px; color: var(--gcr-label-3); }
      `}</style>
    </div>
  );
}

function NewBranchSheet({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '' });
  const [codeTouched, setCodeTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const setName = (e) => { const name = e.target.value; setForm((f) => ({ ...f, name, code: codeTouched ? f.code : suggestCode(name) })); };
  const canSave = form.name.trim() && form.code.trim().length >= 2 && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/branches`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create the branch');
      toast.success(`${data.name} branch created`);
      onCreated(data);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <form className="fs-sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="New Branch">
        <div className="fs-nav">
          <button type="button" className="fs-link" onClick={onClose}>Cancel</button>
          <span className="fs-title">New Branch</span>
          <button type="submit" className="fs-link fs-strong" disabled={!canSave}>{busy ? <Loader2 size={17} className="spin" /> : 'Create'}</button>
        </div>
        <div className="fs-section">Branch</div>
        <div className="fs-group">
          <label className="fs-row"><span>Name</span><input value={form.name} onChange={setName} placeholder="e.g. Tirupati" autoFocus /></label>
          <label className="fs-row"><span>Code</span><input value={form.code} onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) })); }} placeholder="2–5 letters" autoCapitalize="characters" /></label>
        </div>
        <p className="fs-foot">The code appears in every file number, e.g. <b>GOURU/{form.code || 'TPT'}/2026/11/0001</b>. It can’t be changed after the first case.</p>
        <div className="fs-section">Contact (optional)</div>
        <div className="fs-group">
          <label className="fs-row"><span>Address</span><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Office address" /></label>
          <label className="fs-row"><span>Phone</span><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 digits" inputMode="numeric" /></label>
        </div>
        <p className="fs-foot">Next, you’ll add the branch admin who will run this branch.</p>
      </form>
    </div>,
    document.body,
  );
}

function BranchSheet({ branch, onClose, onSaved, onAddAdmin, onOpenPerson }) {
  const [form, setForm] = useState({ name: branch.name, address: branch.address || '', phone: branch.phone || '' });
  const [showLetterhead, setShowLetterhead] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = form.name !== branch.name || form.address !== (branch.address || '') || form.phone !== (branch.phone || '');

  const save = async (patch) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/branches/${branch.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success('Branch updated');
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const s = branch.stats;
  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <div className="fs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${branch.name} branch`}>
        <div className="fs-nav">
          <span />
          <span className="fs-title">{branch.name}</span>
          <button className="fs-link fs-strong" onClick={onClose}>Done</button>
        </div>

        <div className="bd-hero">
          <span className="br-code bd-code">{branch.code}</span>
          <div className="bd-sub">{branch.id} · {branch.status}</div>
        </div>

        <div className="bd-stats">
          {[['This month', s.thisMonth], ['Unassigned', s.unassigned], ['In field', s.inField], ['Review', s.review], ['Returned', s.returned], ['Done', s.done]].map(([k, v]) => (
            <div key={k}><b>{v}</b><span>{k}</span></div>
          ))}
        </div>

        <div className="fs-group" style={{ marginTop: 12 }}>
          <button className="fs-row bd-action" onClick={() => { setBranchScope(branch.id); onClose(); toast.success(`Showing ${branch.name} branch`); }}>
            <Eye size={17} /> View this branch’s cases &amp; staff
          </button>
        </div>

        <div className="fs-section">Reports</div>
        <div className="fs-group">
          <button className="fs-row bd-action" onClick={() => setShowLetterhead(true)} data-testid="branch-letterhead">
            <FileImage size={17} /> Letterhead &amp; Valuer
            <small style={{ marginLeft: 'auto', color: '#8e8e93' }}>{branch.hasLetterhead ? 'Own letterhead' : 'Kadapa letterhead'}</small>
          </button>
        </div>
        {showLetterhead && createPortal(
          <div className="fs-bg" onClick={() => setShowLetterhead(false)} style={{ zIndex: 10060 }}>
            <div className="fs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Letterhead and valuer">
              <div className="fs-nav">
                <span />
                <span className="fs-title">Letterhead &amp; Valuer</span>
                <button className="fs-link fs-strong" onClick={() => { setShowLetterhead(false); onSaved && onSaved(); }}>Done</button>
              </div>
              <div style={{ padding: '4px 16px 24px' }}>
                <LetterheadSettings branchId={branch.id} branchName={branch.name} />
              </div>
            </div>
          </div>, document.body)}

        <div className="fs-section">Branch Admins</div>
        <div className="fs-group">
          {branch.admins.map((a) => (
            <button key={a.id} className="fs-row bd-person" onClick={() => onOpenPerson({ ...a, role: 'ADMIN', branchId: branch.id })}>
              <span className="bd-avatar">{(a.name || a.username).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span className="bd-pname">{a.name}<small>@{a.username}</small></span>
              <ChevronRight size={17} color="#c7c7cc" />
            </button>
          ))}
          <button className="fs-row bd-action" onClick={onAddAdmin}><UserPlus size={17} /> Add Branch Admin</button>
        </div>

        <div className="fs-section">Details</div>
        <div className="fs-group">
          <label className="fs-row"><span>Name</span><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label className="fs-row"><span>Address</span><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Office address" /></label>
          <label className="fs-row"><span>Phone</span><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 digits" inputMode="numeric" /></label>
        </div>
        {dirty && (
          <button className="bd-save" disabled={busy || !form.name.trim()} onClick={() => save(form)}>{busy ? <Loader2 size={17} className="spin" /> : 'Save Changes'}</button>
        )}

        <div className="fs-group" style={{ marginTop: 20 }}>
          <button className={`fs-row bd-action ${branch.status === 'Active' ? 'bd-danger' : ''}`} onClick={() => {
            if (branch.status === 'Active' && !window.confirm(`Mark ${branch.name} as inactive? Its data stays, but it won’t be offered for new cases.`)) return;
            save({ status: branch.status === 'Active' ? 'Inactive' : 'Active' });
          }}>
            {branch.status === 'Active' ? 'Mark Branch Inactive' : 'Reactivate Branch'}
          </button>
        </div>
        <p className="fs-foot">Code <b>{branch.code}</b> is fixed because it’s part of this branch’s file numbers.</p>

        <style>{`
          .bd-hero { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0 14px; }
          .bd-code { width: 64px !important; height: 64px !important; border-radius: 16px !important; font-size: 16px !important; }
          .bd-sub { font-size: 13px; color: #8e8e93; }
          .bd-stats { display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border-radius: 12px; }
          .bd-stats div { display: flex; flex-direction: column; align-items: center; padding: 12px 4px; }
          .bd-stats div:nth-child(-n+3) { border-bottom: .5px solid rgba(60,60,67,.18); }
          .bd-stats b { font-size: 22px; font-weight: 700; color: #000; font-variant-numeric: tabular-nums; }
          .bd-stats span { font-size: 12px; color: #8e8e93; }
          .bd-action { width: 100%; border: none; background: #fff; color: #007aff; font: inherit; font-size: 16px; gap: 10px; cursor: pointer; }
          .bd-danger { color: #ff3b30; justify-content: center; }
          .bd-person { width: 100%; border: none; background: #fff; font: inherit; cursor: pointer; text-align: left; }
          .bd-avatar { width: 32px !important; height: 32px; border-radius: 50%; background: linear-gradient(180deg, #5ac8fa, #007aff); color: #fff; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
          .bd-pname { flex: 1; width: auto !important; display: flex; flex-direction: column; font-size: 16px; color: #000; }
          .bd-pname small { font-size: 12px; color: #8e8e93; }
          .bd-save { width: 100%; height: 48px; margin-top: 12px; border: none; border-radius: 12px; background: #007aff; color: #fff; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .bd-save:disabled { opacity: .5; }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}
