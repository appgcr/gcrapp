import React, { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, Mic, Globe, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';

// Which New Case cards this branch's engineers see: Upload documents, Office sheet, Audio, Valocity.
// Super Admin only: Settings → Case fill options (branch by branch) and Branches → a branch.
const MODES = [
  ['docs', 'Upload documents', '5 documents, check, site details', FileText, '#2563eb'],
  ['sheet', 'Office sheet', 'Upload the filled sheet, photos + selfie', FileSpreadsheet, '#0d9488'],
  ['audio', 'Audio', 'Upload a recording or speak the details', Mic, '#7c3aed'],
  ['valocity', 'Valocity', 'Photos & documents for the Valocity portal only', Globe, '#ea580c'],
];

export default function FillModesCard({ branchId, initial = null, onSaved }) {
  const [modes, setModes] = useState(initial);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (initial || !branchId) return;
    fetch(`${API_BASE_URL}/api/branches`).then((r) => r.json()).then((list) => {
      const b = (Array.isArray(list) ? list : []).find((x) => x.id === branchId);
      setModes((b && b.modes) || { docs: true, sheet: false, audio: false, valocity: false });
    }).catch(() => setModes({ docs: true, sheet: false, audio: false, valocity: false }));
  }, [branchId, initial]);

  const flip = async (k) => {
    const next = { ...modes, [k]: !modes[k] };
    if (!Object.values(next).some(Boolean)) { toast.error('Keep at least one way to fill a case switched on.'); return; }
    setModes(next); setBusy(k);
    try {
      const r = await fetch(`${API_BASE_URL}/api/branches/${encodeURIComponent(branchId)}/fill-modes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [k]: next[k] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      setModes(d.modes || next);
      toast.success(`${MODES.find((m) => m[0] === k)[1]} ${next[k] ? 'switched on' : 'switched off'}`);
      if (onSaved) onSaved(d.modes || next);
    } catch (e) {
      setModes(modes); toast.error(e.message);
    } finally { setBusy(''); }
  };

  if (!modes) return <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={18} className="spin" /></div>;
  const on = MODES.filter(([k]) => modes[k]).length;
  return (
    <>
      <div className="ios-group">
        {MODES.map(([k, label, sub, Icon, color]) => (
          <label key={k} className="fs-row fm-row">
            <span className="fm-ic" style={{ background: color }}><Icon size={17} color="#fff" /></span>
            <span className="fm-t"><b>{label}</b><small>{sub}</small></span>
            {busy === k ? <Loader2 size={18} className="spin" /> : (
              <input type="checkbox" role="switch" aria-label={label} checked={!!modes[k]} onChange={() => flip(k)} />
            )}
          </label>
        ))}
      </div>
      <p className="ios-footnote">
        This branch’s engineers see only the {on === 1 ? 'switched-on card' : `${on} switched-on cards`} when they start a New Case.
        {on === 1 ? ' With just one on, they go straight to it.' : ''} Changes apply the next time they open New Case.
      </p>
      <style>{`
        .fm-row { gap: 12px; align-items: center; cursor: pointer; padding-top: 8px; padding-bottom: 8px; }
        .fs-row.fm-row > .fm-ic { width: 30px; min-width: 30px; max-width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 30px; padding: 0; }
        .fs-row.fm-row > .fm-t { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-align: left; }
        .fm-t b { font-weight: 500; font-size: 16px; color: inherit; } .fm-t small { font-size: 12.5px; color: #8e8e93; line-height: 1.3; }
          .fm-row input[role=switch] { appearance: none; -webkit-appearance: none; flex: 0 0 51px; width: 51px; height: 31px; border-radius: 31px; background: #e5e5ea; position: relative; cursor: pointer; transition: background .2s; margin: 0; }
          .fm-row input[role=switch]::after { content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.2); transition: transform .2s; }
          .fm-row input[role=switch]:checked { background: #34c759; }
          .fm-row input[role=switch]:checked::after { transform: translateX(20px); }
      `}</style>
    </>
  );
}

// Settings → Case fill options: pick a branch, then its four switches
export function FillModesByBranch() {
  const [list, setList] = useState(null);
  const [id, setId] = useState('');
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/branches`).then((r) => r.json()).then((l) => {
      const arr = (Array.isArray(l) ? l : []).filter((b) => b.status !== 'Inactive');
      setList(arr); if (arr[0]) setId(arr[0].id);
    }).catch(() => setList([]));
  }, []);
  if (!list) return <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={18} className="spin" /></div>;
  if (!list.length) return <p className="ios-footnote">No branches yet.</p>;
  const b = list.find((x) => x.id === id);
  return (
    <>
      <div className="ios-group">
        <label className="fs-row"><span>Branch</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </label>
      </div>
      {b && <FillModesCard key={b.id} branchId={b.id} initial={b.modes}
        onSaved={(m) => setList((l) => l.map((x) => (x.id === b.id ? { ...x, modes: m } : x)))} />}
    </>
  );
}
