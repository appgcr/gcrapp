import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useProvideScreenActions } from '../../utils/screenActions';
import { Landmark, ChevronRight, ChevronLeft, Search, Loader2, FileText, Download, Eye, Home, Trees, Building2, Factory, Map as MapIcon, Store, FolderOpen, FolderDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';
import { useBanks, matchBank } from '../../utils/banks';
import { reportFileName } from '../../utils/reportFileName';
import ReportViewer, { fetchReport } from '../Shared/ReportViewer';
import CaseFiles from './CaseFiles';

// Super Admin: every finished (approved) report, kept like folders — Bank → property type → the reports.

const DONE = ['Approved', 'Completed'];
// Property type of a case → its folder (agriculture is checked before open site: "Open Agriculture Land")
const TYPES = [
  { key: 'house', label: 'House', Icon: Home, color: '#2563eb', test: /house|independent|villa|residential|duplex/i },
  { key: 'open', label: 'Open Site', Icon: MapIcon, color: '#ea580c', test: /open|site|plot|vacant/i },
  { key: 'apartment', label: 'Apartment', Icon: Building2, color: '#7c3aed', test: /apart|flat/i },
  { key: 'agri', label: 'Agriculture', Icon: Trees, color: '#16a34a', test: /agri|farm/i },
  { key: 'industrial', label: 'Industrial', Icon: Factory, color: '#475569', test: /industr|shed|factory|godown|warehouse/i },
  { key: 'commercial', label: 'Commercial', Icon: Store, color: '#0891b2', test: /commerc|shop|complex|office/i },
];
const ORDER = ['agri', 'apartment', 'industrial', 'commercial', 'open', 'house'];
const typeOf = (t = '') => ORDER.map((k) => TYPES.find((x) => x.key === k)).find((x) => x.test.test(t))?.key || 'other';
const TYPE_INFO = Object.fromEntries([...TYPES, { key: 'other', label: 'Other / not set', Icon: FolderOpen, color: '#94a3b8' }].map((t) => [t.key, t]));
const inr = (n) => (n ? `₹${Math.round(Number(n)).toLocaleString('en-IN')}` : '');
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export default function AdminReportsLibrary() {
  const banks = useBanks();
  const [cases, setCases] = useState(null);
  // Which property types each bank's own report format covers (missing ones are marked on the folders)
  const [formats, setFormats] = useState(null);
  useEffect(() => { fetch(`${API_BASE_URL}/api/banks/format-matrix`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).then(setFormats).catch(() => {}); }, []);
  const FORMAT_OF = { house: 'house', open: 'open_site', apartment: 'apartment', agri: 'agriculture', industrial: 'industrial' };
  const [err, setErr] = useState('');
  const [bank, setBank] = useState(null);   // bank name opened
  const [type, setType] = useState(null);   // type key opened
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState('');
  const searchRef = useRef(null);
  const [batch, setBatch] = useState(null); // { done, total } while a whole folder downloads

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cases?view=summary`, { headers: authHeaders() })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load the reports.'); return r.json(); })
      .then((list) => setCases((Array.isArray(list) ? list : []).filter((c) => DONE.includes(c.status))))
      .catch((e) => setErr(e.message));
  }, []);

  // Bank name as in the bank list (SBI / State Bank of India… are one folder)
  const bankOf = (c) => (matchBank(banks, c.bankName)?.name) || (String(c.bankName || '').trim() || 'No bank');

  // { bankName → { total, types: { key → [cases] } } }
  const tree = useMemo(() => {
    const t = {};
    for (const b of banks) t[b.name] = { total: 0, types: {} };
    for (const c of cases || []) {
      const b = bankOf(c);
      const k = typeOf(c.propertyDetails?.propertyType || '');
      t[b] = t[b] || { total: 0, types: {} };
      t[b].total += 1;
      (t[b].types[k] = t[b].types[k] || []).push(c);
    }
    return t;
  }, [cases, banks]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (c, ext) => {
    setBusy(`${c.id}:${ext}`);
    try {
      const blob = await fetchReport(`${API_BASE_URL}/api/cases/${c.id}/report?format=${ext}`, { headers: authHeaders() });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = reportFileName(c, ext);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } catch (e) {
      toast.error(e.message || 'Could not download the report.');
    } finally { setBusy(''); }
  };

  // Every report in a folder as PDFs, one after another
  const downloadFolder = async (list, label) => {
    if (!list.length || batch) return;
    setBatch({ done: 0, total: list.length });
    const id = toast.loading(`Downloading ${list.length} ${label} report${list.length === 1 ? '' : 's'}…`);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      try {
        const blob = await fetchReport(`${API_BASE_URL}/api/cases/${c.id}/report?format=pdf`, { headers: authHeaders() });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = reportFileName(c, 'pdf');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        ok += 1;
      } catch { /* the rest still download */ }
      setBatch({ done: i + 1, total: list.length });
      toast.loading(`Downloading ${i + 1} of ${list.length}…`, { id });
    }
    setBatch(null);
    if (ok === list.length) toast.success(`${ok} report${ok === 1 ? '' : 's'} downloaded`, { id });
    else toast.error(`${ok} of ${list.length} downloaded — the rest could not be built`, { id });
  };
  const focusSearch = () => { const el = searchRef.current; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 250); } };

  // Assistive Touch: this screen's own actions
  const folderList = bank && type ? ((tree[bank]?.types || {})[type] || []) : [];
  const bankList = bank ? Object.values(tree[bank]?.types || {}).flat() : [];
  useProvideScreenActions('reports-library', !cases ? [] : bank && type ? [
    { key: 'dl', label: batch ? `${batch.done}/${batch.total}…` : `Download ${folderList.length}`, Icon: FolderDown, run: () => downloadFolder(folderList, TYPE_INFO[type].label.toLowerCase()), disabled: !folderList.length || !!batch },
    { key: 'search', label: 'Search here', Icon: Search, run: focusSearch },
    { key: 'up', label: bank.split(' ').slice(0, 2).join(' '), Icon: ChevronLeft, run: () => setType(null) },
  ] : bank ? [
    { key: 'dlbank', label: batch ? `${batch.done}/${batch.total}…` : `All ${bankList.length} PDFs`, Icon: FolderDown, run: () => downloadFolder(bankList, bank), disabled: !bankList.length || !!batch },
    { key: 'busiest', label: 'Biggest folder', Icon: FolderOpen, run: () => { const k = Object.entries(tree[bank]?.types || {}).sort((a, b) => b[1].length - a[1].length)[0]?.[0]; if (k) setType(k); }, disabled: !bankList.length },
    { key: 'up', label: 'All banks', Icon: ChevronLeft, run: () => setBank(null) },
  ] : [
    { key: 'search', label: 'Find bank', Icon: Search, run: focusSearch },
    { key: 'top', label: 'Top bank', Icon: Landmark, run: () => { const b = Object.keys(tree).sort((x, y) => tree[y].total - tree[x].total)[0]; if (b && tree[b].total) setBank(b); } },
  ], [cases, bank, type, batch, tree]);

  if (err) return <div className="rl-empty">{err}</div>;
  if (!cases) return <div className="rl-empty"><Loader2 className="spin" size={20} /> Loading reports…</div>;

  const needle = q.trim().toLowerCase();
  const match = (c) => !needle || [c.clientName, c.fileNumber, c.bankBranch, c.assignedEngineerName, c.propertyDetails?.propertyType].some((v) => String(v || '').toLowerCase().includes(needle));
  const totalDone = cases.length;

  // ── Level 3: the reports of one bank + type ──
  if (bank && type) {
    const list = ((tree[bank]?.types || {})[type] || []).filter(match)
      .sort((a, b) => new Date(b.approvedAt || b.updatedAt || 0) - new Date(a.approvedAt || a.updatedAt || 0));
    const T = TYPE_INFO[type];
    return (
      <div className="rl">
        <button type="button" className="rl-back" onClick={() => setType(null)}><ChevronLeft size={18} /> {bank}</button>
        <div className="rl-h"><span className="rl-ic" style={{ background: T.color }}><T.Icon size={18} /></span><div><b>{T.label}</b><small>{bank} · {list.length} report{list.length === 1 ? '' : 's'}</small></div></div>
        <label className="rl-search"><Search size={16} /><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, file no, branch, engineer" /></label>
        {folderList.length > 1 && (
          <button type="button" className="cs-btn cs-ghost rl-dlall" disabled={!!batch} onClick={() => downloadFolder(folderList, T.label.toLowerCase())}>
            {batch ? <><Loader2 size={15} className="spin" /> {batch.done} of {batch.total}…</> : <><FolderDown size={15} /> Download all {folderList.length} as PDF</>}
          </button>
        )}
        {list.length === 0 ? <div className="rl-empty">No {T.label.toLowerCase()} reports{needle ? ' match this search' : ` for ${bank} yet`}.</div> : (
          <div className="rl-list">
            {list.map((c) => (
              <div key={c.id} className="rl-row">
                <div className="rl-row-t">
                  <b>{c.clientName}</b>
                  <small>{[c.fileNumber || `#${c.id}`, c.bankBranch, day(c.approvedAt || c.updatedAt), c.assignedEngineerName].filter(Boolean).join(' · ')}</small>
                  {(c.valuation?.fairMarketValue || c.propertyDetails?.marketValueAmount) && <small className="rl-val">Market value {inr(c.valuation?.fairMarketValue || c.propertyDetails?.marketValueAmount)}{c.valuation?.realizableValue ? ` · Realizable ${inr(c.valuation.realizableValue)}` : ''}</small>}
                </div>
                <div className="rl-act">
                  <button type="button" className="cs-btn cs-ghost" onClick={() => setViewing(c)}><Eye size={15} /> View</button>
                  <button type="button" className="cs-btn cs-ghost" disabled={!!busy} onClick={() => download(c, 'docx')}>{busy === `${c.id}:docx` ? <Loader2 size={15} className="spin" /> : <FileText size={15} />} Word</button>
                  <button type="button" className="cs-btn cs-ghost" disabled={!!busy} onClick={() => download(c, 'pdf')}>{busy === `${c.id}:pdf` ? <Loader2 size={15} className="spin" /> : <Download size={15} />} PDF</button>
                  <CaseFiles c={c} />
                </div>
              </div>
            ))}
          </div>
        )}
        {viewing && (
          <ReportViewer title={viewing.clientName || 'Valuation Report'} subtitle={[viewing.fileNumber || `#${viewing.id}`, viewing.bankName].filter(Boolean).join(' · ')}
            fileName={reportFileName(viewing)} load={() => fetchReport(`${API_BASE_URL}/api/cases/${viewing.id}/report?format=docx`, { headers: authHeaders() })} onClose={() => setViewing(null)} />
        )}
        <Style />
      </div>
    );
  }

  // ── Level 2: the property-type folders of one bank ──
  if (bank) {
    const types = tree[bank]?.types || {};
    const keys = [...TYPES.map((t) => t.key), ...(types.other ? ['other'] : [])];
    return (
      <div className="rl">
        <button type="button" className="rl-back" onClick={() => setBank(null)}><ChevronLeft size={18} /> All banks</button>
        <div className="rl-h"><span className="rl-ic" style={{ background: '#1d4ed8' }}><Landmark size={18} /></span><div><b>{bank}</b><small>{tree[bank]?.total || 0} finished report{tree[bank]?.total === 1 ? '' : 's'}</small></div></div>
        <div className="rl-grid">
          {keys.map((k) => {
            const T = TYPE_INFO[k]; const n = (types[k] || []).length;
            // This bank has no own report format for this type yet → a sample report is needed
            const fkey = (banks.find((b) => b.name === bank) || {}).format;
            const noFormat = formats && fkey && FORMAT_OF[k] && Array.isArray(formats[fkey]) && !formats[fkey].includes(FORMAT_OF[k]);
            return (
              <button type="button" key={k} className={`rl-folder ${n ? '' : 'none'}`} onClick={() => { setQ(''); setType(k); }}>
                <span className="rl-ic" style={{ background: n ? T.color : '#cbd5e1' }}><T.Icon size={18} /></span>
                <span className="rl-ft"><b>{T.label}</b><small>{n ? `${n} report${n === 1 ? '' : 's'}` : 'None yet'}</small>
                  {noFormat && <span className="rl-nofmt">No report format yet — send a sample report</span>}</span>
                <ChevronRight size={17} className="rl-ch" />
              </button>
            );
          })}
        </div>
        <Style />
      </div>
    );
  }

  // ── Level 1: every bank ──
  const bankNames = Object.keys(tree).filter((b) => !needle || b.toLowerCase().includes(needle))
    .sort((a, b) => (tree[b].total - tree[a].total) || a.localeCompare(b));
  const withReports = bankNames.filter((b) => tree[b].total > 0);
  const without = bankNames.filter((b) => tree[b].total === 0);
  const bankCard = (b) => {
    const t = tree[b];
    return (
      <button type="button" key={b} className={`rl-bank ${t.total ? '' : 'none'}`} onClick={() => { setQ(''); setBank(b); }}>
        <span className="rl-ic" style={{ background: t.total ? '#1d4ed8' : '#cbd5e1' }}><Landmark size={18} /></span>
        <span className="rl-ft">
          <b>{b}</b>
          <small>{t.total ? `${t.total} finished report${t.total === 1 ? '' : 's'}` : 'No reports yet'}</small>
          {t.total > 0 && (
            <span className="rl-chips">
              {[...TYPES, TYPE_INFO.other].filter((T) => (t.types[T.key] || []).length).map((T) => (
                <span key={T.key} style={{ color: T.color, borderColor: `${T.color}55` }}>{T.label} {(t.types[T.key] || []).length}</span>
              ))}
            </span>
          )}
        </span>
        <ChevronRight size={17} className="rl-ch" />
      </button>
    );
  };
  return (
    <div className="rl">
      <div className="rl-h"><span className="rl-ic" style={{ background: '#0f172a' }}><FolderOpen size={18} /></span><div><b>Reports library</b><small>{totalDone} finished report{totalDone === 1 ? '' : 's'} · {withReports.length} bank{withReports.length === 1 ? '' : 's'}</small></div></div>
      <label className="rl-search"><Search size={16} /><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a bank" /></label>
      <div className="rl-grid">{withReports.map(bankCard)}</div>
      {without.length > 0 && (<><div className="rl-sec">No finished reports yet</div><div className="rl-grid">{without.map(bankCard)}</div></>)}
      <Style />
    </div>
  );
}

function Style() {
  return (
    <style>{`
      .rl { display: flex; flex-direction: column; gap: 12px; padding-bottom: 24px; }
      .rl-h { display: flex; align-items: center; gap: 12px; }
      .rl-h b { display: block; font-size: 18px; color: #0f172a; } .rl-h small { color: #64748b; font-size: 13px; }
      .rl-ic { width: 36px; height: 36px; border-radius: 10px; color: #fff; display: grid; place-items: center; flex-shrink: 0; }
      .rl-back { align-self: flex-start; display: inline-flex; align-items: center; gap: 2px; border: 0; background: none; color: #2563eb; font-weight: 700; font-size: 14.5px; cursor: pointer; padding: 2px 0; font-family: inherit; }
      .rl-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 9px 12px; color: #94a3b8; }
      .rl-search input { border: 0; outline: 0; flex: 1; font-size: 14.5px; background: transparent; color: #0f172a; font-family: inherit; }
      .rl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
      .rl-bank, .rl-folder { display: flex; align-items: center; gap: 12px; text-align: left; background: #fff; border: 1px solid #eef2f7; border-radius: 14px; padding: 12px 14px; cursor: pointer; font-family: inherit; }
      .rl-bank:hover, .rl-folder:hover { border-color: #93c5fd; }
      .rl-bank.none, .rl-folder.none { opacity: .7; }
      .rl-ft { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .rl-ft b { font-size: 15px; color: #0f172a; } .rl-ft small { font-size: 12.5px; color: #64748b; }
      .rl-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      .rl-chips span { font-size: 11.5px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 1px 8px; background: #fff; }
      .rl-ch { color: #94a3b8; flex-shrink: 0; }
      .rl-nofmt { margin-top: 3px; align-self: flex-start; font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 1px 6px; }
      .rl-sec { margin-top: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; }
      .rl-list { display: flex; flex-direction: column; gap: 8px; }
      .rl-row { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; padding: 12px 14px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .rl-row-t { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
      .rl-row-t b { font-size: 15px; color: #0f172a; } .rl-row-t small { color: #64748b; font-size: 12.5px; } .rl-row-t .rl-val { color: #15803d; font-weight: 600; }
      .rl-act { display: flex; gap: 6px; flex-wrap: wrap; }
      .rl-dlall { align-self: flex-start; }
      .rl-empty { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 40px 12px; color: #64748b; }
      body.dark-theme .rl-bank, body.dark-theme .rl-folder, body.dark-theme .rl-row, body.dark-theme .rl-search, body.dark-theme .rl-chips span { background: #1c1c1e; border-color: #3a3a3c; }
      body.dark-theme .rl-h b, body.dark-theme .rl-ft b, body.dark-theme .rl-row-t b, body.dark-theme .rl-search input { color: #fff; }
    `}</style>
  );
}
