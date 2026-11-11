import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, Landmark, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { banksChanged } from '../../utils/banks';

const TYPES = [
  ['house', 'Independent House'],
  ['apartment', 'Apartment'],
  ['openSite', 'Open Site'],
  ['agriculture', 'Agriculture Land'],
  ['industrial', 'Industrial Unit'],
];

// Badge letters: short name, else initials (Central Bank of India → CBI, Axis Bank → AXIS)
const badge = (b) => {
  if (b.shortName) return b.shortName.slice(0, 5).toUpperCase();
  const words = b.name.replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => w && !/^(of|&|and|the)$/i.test(w));
  if (words.length === 1 || (words.length === 2 && /^bank$/i.test(words[1]))) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
};

const isSet = (p) => p && p.realizable != null && p.distress != null;
const pctSummary = (b) => {
  const set = TYPES.filter(([k]) => isSet(b.policies?.[k])).length;
  return set === TYPES.length ? 'All % set' : set === 0 ? '% not set' : `% set for ${set} of ${TYPES.length}`;
};

/** Super Admin → Settings → Banks: the one bank list used by every screen, case and report. */
export default function BanksSettings() {
  const [banks, setBanks] = useState(null);
  const [formats, setFormats] = useState([]);
  const [editing, setEditing] = useState(null); // bank object, or {} for a new bank
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/banks?all=1`);
      const d = await r.json();
      setBanks(Array.isArray(d.banks) ? d.banks : []);
      setFormats(d.formats || []);
    } catch { setBanks([]); }
  };
  useEffect(() => { load(); }, []);

  const term = q.trim().toLowerCase();
  const list = (banks || [])
    .filter((b) => showInactive || b.status !== 'Inactive')
    .filter((b) => !term || [b.name, b.shortName, ...(b.aliases || [])].some((n) => n && n.toLowerCase().includes(term)));
  const inactiveCount = (banks || []).filter((b) => b.status === 'Inactive').length;
  const fmtLabel = (k) => (formats.find((f) => f.key === k)?.label || k);

  return (
    <div className="bk-wrap">
      <div className="bk-toolbar">
        <label className="bk-search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search banks" aria-label="Search banks" />
        </label>
        <button type="button" className="bk-add" onClick={() => setEditing({})}><Plus size={17} strokeWidth={2.4} /> Add Bank</button>
      </div>

      {banks === null && <div className="bk-empty"><Loader2 size={20} className="spin" /></div>}

      {banks && (
        <div className="ios-group">
          {list.length === 0 && <div className="bk-empty">No banks match “{q}”.</div>}
          {list.map((b) => (
            <button key={b.id} type="button" className="ios-row is-link bk-row" onClick={() => setEditing(b)}>
              <span className={`bk-logo ${b.status === 'Inactive' ? 'off' : ''}`} aria-hidden="true">{badge(b)}</span>
              <span className="bk-text">
                <span className="bk-name">{b.name}{b.status === 'Inactive' && <em> · Hidden</em>}</span>
                <span className="bk-sub">
                  {fmtLabel(b.format)} · <span className={isSet(b.policies?.house) || isSet(b.policies?.apartment) ? '' : 'bk-warn'}>{pctSummary(b)}</span>
                  {b.caseCount ? ` · ${b.caseCount} case${b.caseCount > 1 ? 's' : ''}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {inactiveCount > 0 && (
        <button type="button" className="bk-toggle" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Hide hidden banks' : `Show ${inactiveCount} hidden bank${inactiveCount > 1 ? 's' : ''}`}
        </button>
      )}
      <p className="ios-footnote">
        Every bank picker, case and report uses this list. Renaming a bank updates all its cases.
        Set the realizable and distress percentages for each property type the bank accepts — reports for a type without them can’t be submitted.
      </p>

      {editing && (
        <BankSheet
          bank={editing}
          formats={formats}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); banksChanged(); }}
        />
      )}
      <style>{`
        .bk-toolbar { display: flex; gap: 10px; align-items: center; margin: 0 0 14px; }
        .bk-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: rgba(118,118,128,.12); border-radius: 10px; padding: 0 10px; height: 38px; color: #8e8e93; }
        .bk-search input { flex: 1; min-width: 0; border: 0; background: none; outline: none; font-size: 15px; color: #000; }
        .bk-add { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 14px; border: 0; border-radius: 10px; background: #007aff; color: #fff; font-size: 14.5px; font-weight: 600; cursor: pointer; }
        .bk-row { gap: 12px; }
        .bk-logo { width: 38px; height: 38px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; background: linear-gradient(160deg,#2f6bff,#1d4ed8); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; }
        .bk-logo.off { background: #c7c7cc; }
        .bk-text { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }
        .bk-name { font-size: 15.5px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bk-name em { color: #8e8e93; font-style: normal; font-size: 13px; }
        .bk-sub { font-size: 12.5px; color: #8e8e93; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bk-warn { color: #ff9500; font-weight: 600; }
        .bk-empty { padding: 22px; text-align: center; color: #8e8e93; font-size: 14px; }
        .bk-toggle { display: block; margin: 10px auto 0; border: 0; background: none; color: #007aff; font-size: 14px; cursor: pointer; }
        .bk-pct { display: grid; grid-template-columns: 1fr 74px 74px; gap: 8px; align-items: center; padding: 9px 16px; border-top: 0.5px solid rgba(60,60,67,.18); font-size: 15px; }
        .bk-pct:first-child { border-top: 0; }
        .bk-pct.head { font-size: 12px; color: #8e8e93; padding-top: 10px; padding-bottom: 4px; }
        .bk-pct input { width: 100%; min-width: 0; box-sizing: border-box; text-align: center; border: 1px solid rgba(60,60,67,.2); border-radius: 8px; padding: 7px 4px; font-size: 15px; outline: none; background: #fff; }
        .bk-pct input:focus { border-color: #007aff; }
        .bk-pct .lbl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}

function BankSheet({ bank, formats, onClose, onSaved }) {
  const isNew = !bank.id;
  const [form, setForm] = useState(() => ({
    name: bank.name || '',
    shortName: bank.shortName || '',
    aliases: (bank.aliases || []).join(', '),
    format: bank.format || 'standard',
    status: bank.status || 'Active',
    policies: Object.fromEntries(TYPES.map(([k]) => [k, {
      realizable: bank.policies?.[k]?.realizable ?? '',
      distress: bank.policies?.[k]?.distress ?? '',
    }])),
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPct = (type, which) => (e) => {
    const v = e.target.value.replace(/[^\d.]/g, '').slice(0, 5);
    setForm((f) => ({ ...f, policies: { ...f.policies, [type]: { ...f.policies[type], [which]: v } } }));
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return toast.error('Enter the bank name.');
    for (const [k, label] of TYPES) {
      const p = form.policies[k];
      if ((p.realizable === '') !== (p.distress === '')) return toast.error(`${label}: enter both percentages, or leave both empty.`);
      if (p.realizable !== '' && Number(p.distress) > Number(p.realizable)) return toast.error(`${label}: distress % can’t be more than realizable %.`);
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/banks${isNew ? '' : `/${bank.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save the bank.');
      toast.success(isNew ? `${form.name.trim()} added` : d.casesUpdated ? `Saved · ${d.casesUpdated} case${d.casesUpdated > 1 ? 's' : ''} updated` : 'Saved');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const title = isNew ? 'New Bank' : 'Edit Bank';
  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <form className="fs-sheet" onSubmit={save} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="fs-nav">
          <button type="button" className="fs-link" onClick={onClose}>Cancel</button>
          <span className="fs-title">{title}</span>
          <button type="submit" className="fs-link fs-strong" disabled={busy || !form.name.trim()}>{busy ? <Loader2 size={17} className="spin" /> : isNew ? 'Add' : 'Save'}</button>
        </div>

        <div className="fs-section">Bank</div>
        <div className="fs-group">
          <label className="fs-row"><span>Name</span><input value={form.name} onChange={set('name')} placeholder="e.g. Andhra Pradesh Grameena Bank" autoComplete="off" /></label>
          <label className="fs-row"><span>Short name</span><input value={form.shortName} onChange={set('shortName')} placeholder="e.g. APGB" autoComplete="off" /></label>
          <label className="fs-row"><span>Other names</span><input value={form.aliases} onChange={set('aliases')} placeholder="Old names, comma separated" autoComplete="off" /></label>
        </div>
        <p className="fs-foot">Typing the short name or an old name anywhere in the app picks this bank.{!isNew && ' A new name replaces the old one on all this bank’s cases.'}</p>

        <div className="fs-section">Report</div>
        <div className="fs-group">
          <label className="fs-row">
            <span>Format</span>
            <select value={form.format} onChange={set('format')}>
              {formats.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
        </div>

        <div className="fs-section">Valuation % of fair market value</div>
        <div className="fs-group">
          <div className="bk-pct head"><span>Property type</span><span style={{ textAlign: 'center' }}>Realizable</span><span style={{ textAlign: 'center' }}>Distress</span></div>
          {TYPES.map(([k, label]) => (
            <div className="bk-pct" key={k}>
              <span className="lbl">{label}</span>
              <input inputMode="decimal" value={form.policies[k].realizable} onChange={setPct(k, 'realizable')} placeholder="—" aria-label={`${label} realizable percent`} />
              <input inputMode="decimal" value={form.policies[k].distress} onChange={setPct(k, 'distress')} placeholder="—" aria-label={`${label} distress percent`} />
            </div>
          ))}
        </div>
        <p className="fs-foot">Example: APGB house 90 / 80, apartment 85 / 75. Leave a type empty if this bank doesn’t accept it.</p>

        {!isNew && (
          <>
            <div className="fs-group" style={{ marginTop: 18 }}>
              <label className="fs-row">
                <span>Visible</span>
                <select value={form.status} onChange={set('status')}>
                  <option value="Active">Shown in bank lists</option>
                  <option value="Inactive">Hidden</option>
                </select>
              </label>
            </div>
            <p className="fs-foot">Hiding a bank removes it from pickers for new cases. Its existing cases and reports stay as they are.</p>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}
