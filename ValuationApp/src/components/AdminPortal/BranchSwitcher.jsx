import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { getBranchScope, setBranchScope, isSuperAdmin } from '../../utils/session';

// Under the page title: the Super Admin picks which branch to look at (or All Branches);
// a Branch Admin just sees their branch name.
export default function BranchSwitcher({ currentUser }) {
  const [branches, setBranches] = useState([]);
  const [scope, setScope] = useState(getBranchScope());
  const [open, setOpen] = useState(false);
  const superAdmin = isSuperAdmin(currentUser);

  const load = () => {
    fetch(`${API_BASE_URL}/api/branches`).then((r) => (r.ok ? r.json() : [])).then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => {
    if (!superAdmin) return undefined;
    load();
    const onChange = () => load(); // a branch was added or renamed
    window.addEventListener('gcr_branches_changed', onChange);
    return () => window.removeEventListener('gcr_branches_changed', onChange);
  }, [superAdmin]);

  // If the remembered branch no longer exists, fall back to All Branches
  useEffect(() => {
    if (superAdmin && branches.length && scope !== 'all' && !branches.some((b) => b.id === scope)) { setScope('all'); setBranchScope('all'); }
  }, [branches, scope, superAdmin]);

  if (!superAdmin) {
    const b = currentUser?.branchInfo;
    return b ? <span className="bs-static"><Building2 size={12} /> {b.name} Branch</span> : null;
  }

  const current = branches.find((b) => b.id === scope);
  const choose = (id) => { setScope(id); setBranchScope(id); setOpen(false); };

  return (
    <>
      <button className="bs-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {current ? `${current.name} Branch` : 'All Branches'} <ChevronDown size={13} strokeWidth={2.6} />
      </button>
      {open && createPortal(
        <div className="bs-bg" onClick={() => setOpen(false)}>
          <div className="bs-sheet" role="dialog" aria-label="Choose branch" onClick={(e) => e.stopPropagation()}>
            <div className="bs-title">Show data for</div>
            <div className="bs-list">
              <button className="bs-item" onClick={() => choose('all')}>
                <span className="bs-code bs-all">ALL</span>
                <span className="bs-name">All Branches<small>Everything, A to Z</small></span>
                {scope === 'all' && <Check size={18} className="bs-check" />}
              </button>
              {branches.map((b) => (
                <button key={b.id} className="bs-item" onClick={() => choose(b.id)}>
                  <span className="bs-code">{b.code}</span>
                  <span className="bs-name">{b.name}{b.status === 'Inactive' && <small>Inactive</small>}</span>
                  {scope === b.id && <Check size={18} className="bs-check" />}
                </button>
              ))}
            </div>
            <button className="bs-cancel" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>,
        document.body,
      )}
      <style>{`
        .bs-btn { display: inline-flex; align-items: center; gap: 3px; border: none; background: none; padding: 0; margin-top: 1px; font: inherit; font-size: 13px; font-weight: 600; color: var(--gcr-accent, #007aff); cursor: pointer; white-space: nowrap; }
        .bs-bg { position: fixed; inset: 0; z-index: 10060; background: rgba(0,0,0,.32); display: flex; align-items: flex-end; justify-content: center; animation: bsFade .2s ease-out; }
        .bs-sheet { width: 100%; max-width: 440px; padding: 8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px); animation: bsUp .3s cubic-bezier(.2,.9,.25,1); font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); }
        @media (min-width: 768px) { .bs-bg { align-items: center; } }
        .bs-title { background: rgba(255,255,255,.96); border-radius: 14px 14px 0 0; padding: 14px; text-align: center; font-size: 13px; color: #8e8e93; border-bottom: .5px solid rgba(60,60,67,.18); }
        .bs-list { background: rgba(255,255,255,.96); border-radius: 0 0 14px 14px; max-height: 55vh; overflow-y: auto; }
        .bs-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: none; background: none; font: inherit; text-align: left; cursor: pointer; position: relative; }
        .bs-item + .bs-item::before { content: ''; position: absolute; top: 0; left: 64px; right: 0; height: .5px; background: rgba(60,60,67,.18); }
        .bs-item:active { background: rgba(120,120,128,.12); }
        .bs-code { width: 38px; height: 30px; border-radius: 8px; background: rgba(0,122,255,.1); color: #007aff; font-size: 11px; font-weight: 700; letter-spacing: .4px; display: flex; align-items: center; justify-content: center; flex: none; }
        .bs-all { background: #007aff; color: #fff; }
        .bs-name { flex: 1; min-width: 0; font-size: 17px; color: #000; display: flex; flex-direction: column; }
        .bs-name small { font-size: 12px; color: #8e8e93; }
        .bs-check { color: #007aff; flex: none; }
        .bs-cancel { width: 100%; margin-top: 8px; height: 56px; border: none; border-radius: 14px; background: #fff; color: #007aff; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer; }
        @keyframes bsFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bsUp { from { transform: translateY(100%); } to { transform: none; } }
      `}</style>
    </>
  );
}
