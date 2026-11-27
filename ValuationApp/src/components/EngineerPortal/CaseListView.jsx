import React, { useState, useEffect } from 'react';
import { FileText, Search, ChevronRight, Plus, Loader2, Paperclip, X, Camera, Mic, Globe } from 'lucide-react';
import { DOC_ACCEPT, uploadDocumentFile } from '../../utils/docFiles';
import { createPortal } from 'react-dom';
import { useBanks, matchBank } from '../../utils/banks';
import { authHeaders } from '../Shared/authHeaders';
import toast from 'react-hot-toast';
import IconTile from '../Shared/IconTile';
import './AttendanceView.css';
import { API_BASE_URL } from '../../config/api';
import CaseCreationModal from './CaseModalSteps/CaseCreationModal';
import VoiceSheetFill from './CaseModalSteps/VoiceSheetFill';
import { EMPTY_SHEET, sheetMissing } from './CaseModalSteps/OfficeSheetStep';
import { ensureCheckedIn } from '../../utils/dutyCheck';
import { addValocityUploads } from '../../utils/valocityFiles';
import ReadingProgress from '../Shared/ReadingProgress';

export default function CaseListView({ onOpenCase, currentUser }) {
  const [casesList, setCasesList] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState(null);
  // Self cases: an admin can allow this engineer to file their own cases
  const [canSelfCase, setCanSelfCase] = useState(!!currentUser?.canSelfCase);
  const [newOpen, setNewOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [sheetDocs, setSheetDocs] = useState(null); // documents picked in the New Case sheet
  const [sheetInit, setSheetInit] = useState(null); // office sheet picked there (uploaded and read)
  const [loadState, setLoadState] = useState('loading'); // loading | ok | error
  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u) setCanSelfCase(!!u.canSelfCase); })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    setLoadState((st) => (st === 'ok' ? 'ok' : 'loading'));
    fetch(`${API_BASE_URL}/api/cases?view=summary`)
      .then(async (res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const casesArr = Array.isArray(data) ? data : (data.cases || []);
        // Only show cases assigned to this engineer OR created by this engineer
        const myCases = casesArr.filter(c => {
          if (!currentUser) return true;
          const assignedMatch = c.assignedEngineerId && String(c.assignedEngineerId) === String(currentUser.id);
          const authorMatch = c.assignedEngineerName && c.assignedEngineerName.toLowerCase() === (currentUser.name || currentUser.username || '').toLowerCase();
          return assignedMatch || authorMatch;
        });
        const formatted = myCases.map(c => ({
          id: c.id,
          fileNumber: c.fileNumber || '',
          title: (c.clientName && c.bankName) ? `${c.clientName} - ${c.bankName}` : (c.clientName || 'Untitled Case'),
          client: c.clientName || 'Client',
          bank: c.bankName || '',
          type: c.propertyDetails?.propertyType || 'Standard Appraisal',
          date: new Date(c.createdAt).toLocaleDateString(),
          status: c.status || 'Pending',
          selfFiled: !!c.selfFiled
        }));
        setCasesList(formatted);
        setLoadState('ok');
      })
      // Keep the cases already shown; say clearly that the list could not be refreshed
      .catch(err => { console.error("Failed to fetch cases:", err); setLoadState('error'); });
  }, [currentUser, reload]);

  const filteredCases = casesList.filter(c => 
    (c.title && c.title.toLowerCase().includes(search.toLowerCase())) ||
    (c.id && c.id.toLowerCase().includes(search.toLowerCase())) ||
    (c.fileNumber && c.fileNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const checkAttendanceClockIn = () => ensureCheckedIn(currentUser?.id);

  const handleResumeAssignedTask = async (c) => {
    const isClockedIn = await checkAttendanceClockIn();
    if (!isClockedIn) return;
    setEditingCaseId(c.id);
    setIsModalOpen(true);
  };

  return (
    <div className="td animate-fade-in" style={{ paddingBottom: 24 }}>
      {canSelfCase && (
        <button className="ec-new" onClick={async () => { if (await checkAttendanceClockIn()) setNewOpen(true); }}>
          <Plus size={19} strokeWidth={2.4} /> New case
        </button>
      )}
      <label className="ec-search">
        <Search size={16} />
        <input type="search" placeholder="Search client or file number" value={search} onChange={e => setSearch(e.target.value)} />
      </label>

      {loadState === 'error' && (
        <div className="td-group"><div className="td-empty" style={{ color: '#b45309' }}>
          Couldn’t load your cases — check the internet connection.{' '}
          <button type="button" onClick={() => setReload((n) => n + 1)} style={{ border: 0, background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>Try again</button>
        </div></div>
      )}
      {loadState === 'loading' && casesList.length === 0 && <div className="td-group"><div className="td-empty"><Loader2 size={16} className="spin" style={{ verticalAlign: '-3px' }} /> Loading your cases…</div></div>}
      {loadState === 'ok' && casesList.length === 0 && <div className="td-group"><div className="td-empty">No cases assigned to you yet.</div></div>}
      {casesList.length > 0 && filteredCases.length === 0 && <div className="td-group"><div className="td-empty">No cases match “{search}”.</div></div>}

      {[
        { key: 'Returned', label: 'Returned — fix and resubmit', match: (st) => st === 'Returned', color: 'red' },
        { key: 'Field', label: 'In field', match: (st) => !st || st === 'Pending', color: 'blue' },
        { key: 'Review', label: 'With admin', match: (st) => st === 'Reviewing' || st === 'Completed', color: 'orange' },
        { key: 'Done', label: 'Done', match: (st) => st === 'Approved' || st === 'Rejected', color: 'green' },
      ].map(group => {
        const list = filteredCases.filter(c => group.match(c.status));
        if (!list.length) return null;
        return (
          <React.Fragment key={group.key}>
            <div className="td-section">{group.label} · {list.length}</div>
            <div className="td-group">
              {list.map(c => (
                <button
                  key={c.id}
                  className="td-row td-link"
                  onClick={() => (c.status === 'Pending' ? handleResumeAssignedTask(c) : onOpenCase(c.id))}
                >
                  <IconTile icon={FileText} color={group.color} size={30} />
                  <div className="td-main">
                    <div className="td-title">{c.client}</div>
                    <div className="td-sub">{c.fileNumber || `#${c.id}`}{c.bank ? ` · ${c.bank}` : ''}{c.selfFiled ? ' · Self case' : ''}</div>
                  </div>
                  <ChevronRight size={18} className="td-chev" />
                </button>
              ))}
            </div>
          </React.Fragment>
        );
      })}

      {/* New cases come from the branch admin — or from the engineer, when the admin allows self cases */}
      {newOpen && (
        <SelfCaseSheet
          currentUser={currentUser}
          onClose={() => setNewOpen(false)}
          onCreated={(c, docs, sheetInit) => {
            setNewOpen(false);
            setSheetInit(sheetInit || null);
            setSheetDocs(docs && Object.values(docs).some((a) => a.length) ? docs : null);
            setReload((n) => n + 1);
            toast.success(`Case ${c.fileNumber || c.id} created. Fill in the details and submit it to your admin.`);
            setEditingCaseId(c.id);   // straight into the case form
            setIsModalOpen(true);
          }}
        />
      )}
      {isModalOpen && (
        <CaseCreationModal
          isOpen={isModalOpen}
          editingCaseId={editingCaseId}
          currentUser={currentUser}
          initialDocFiles={sheetDocs}
          initialSheet={sheetInit}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCaseId(null);
            setSheetDocs(null);
            setSheetInit(null);
          }}
          onCaseSaved={(formattedNewCase, isEditing) => {
            if (isEditing) {
              setCasesList(prev => prev.map(c => c.id === formattedNewCase.id ? formattedNewCase : c));
            } else {
              setCasesList(prev => [formattedNewCase, ...prev]);
            }
          }}
        />
      )}
    </div>
  );
}

const SHEET_DOCS = [
  ['officeSheet', 'Office sheet'],
  ['saleDeed', 'Sale Deed'],
  ['buildingPlan', 'Building Plan'],
  ['propertyTax', 'Property Tax'],
  ['marketValue', 'Market Value'],
  ['layoutPlan', 'Layout Plan'],
];
// These are read at once to fill the customer, bank and address
const READ_FROM = ['officeSheet', 'saleDeed', 'propertyTax'];
const FILL_LABEL = { clientName: 'Name', clientFatherName: 'S/o, W/o', clientPhone: 'Mobile', bankName: 'Bank', bankBranch: 'Bank branch', address: 'Address' };

// "INDIAN BANK" / "SBI Kadapa main" → the bank in the app's list (longest name that matches)
function bankFromText(banks, text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const exact = matchBank(banks, text);
  if (exact) return exact;
  const names = (b) => [b.name, b.shortName, ...(b.aliases || [])].filter(Boolean).map((n) => String(n).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  let best = null; let len = 0;
  for (const b of banks) for (const n of names(b)) if (n.length > 2 && (` ${t} `).includes(` ${n} `) && n.length > len) { best = b; len = n.length; }
  return best;
}

// Short form to start a self case; the full details are filled in the usual case form afterwards
function SelfCaseSheet({ currentUser, onClose, onCreated }) {
  // Office sheet route: only when the Super Admin has switched it on for this engineer's branch
  // Which New Case cards the Super Admin has switched on for this engineer's branch (Settings → Case fill options)
  const [modes, setModes] = useState({ docs: true, sheet: false, audio: false, valocity: false });
  const sheetAllowed = !!(modes.sheet || modes.audio);
  const [mode, setMode] = useState('docs'); // 'docs' | 'sheet' | 'audio' (the sheet route, filled by voice) | 'valocity'
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/branches`).then((r) => (r.ok ? r.json() : [])).then((list) => {
      const mine = Array.isArray(list) ? list.find((b) => b.id === currentUser?.branchId) : null;
      const m = (mine && mine.modes) || { docs: true, sheet: !!(mine && mine.sheetBypass), audio: !!(mine && mine.sheetBypass), valocity: false };
      setModes(m);
      setMode((cur) => (m[cur] ? cur : ['docs', 'sheet', 'audio', 'valocity'].find((k) => m[k]) || 'docs'));
    }).catch(() => {});
  }, [currentUser?.branchId]);
  const banks = useBanks();
  const [f, setF] = useState({ clientName: '', clientFatherName: '', clientPhone: '', bankName: '', bankBranch: '', address: '', note: '' });
  const [docs, setDocsState] = useState({}); // docId → [File]
  const docsRef = React.useRef({});
  const setDocs = (fn) => { const next = typeof fn === 'function' ? fn(docsRef.current) : fn; docsRef.current = next; setDocsState(next); return next; };
  const fRef = React.useRef(null);
  const [pickFor, setPickFor] = useState(null);
  const [reading, setReading] = useState(false);
  const [branchTyping, setBranchTyping] = useState(false);
  const [valocityVoice, setValocityVoice] = useState(false); // Valocity card: voice box open // typing a bank branch that is not in the list
  const [prog, setProg] = useState(null); // { pct, stage, done } while / after Gouru AI reads the documents
  const [filled, setFilled] = useState([]); // field keys Gouru AI filled
  const [readNote, setReadNote] = useState('');
  const uploaded = React.useRef({}); // File → { url, meta } (uploaded once, reused for the case)
  const fileInput = React.useRef(null);
  const camInput = React.useRef(null); // the phone camera (photo of the sheet / document)
  const docCount = Object.values(docs).reduce((n, a) => n + a.length, 0);
  const [busy, setBusy] = useState(false);
  const valocity = mode === 'valocity'; // Valocity card: only the files that go to the Valocity portal
  const typed = React.useRef(new Set()); // fields the engineer typed: never overwritten
  const set = (k) => (e) => { typed.current.add(k); setFilled((x) => x.filter((y) => y !== k)); setF((x) => ({ ...x, [k]: k === 'clientPhone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value })); };
  fRef.current = f;
  const ok = f.clientName.trim() && f.address.trim() && (!f.clientPhone || f.clientPhone.length === 10) && !busy && !reading;

  const upload = async (file) => {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (uploaded.current[key]) return uploaded.current[key];
    const url = await uploadDocumentFile(file);
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const isWord = /\.docx?$/i.test(file.name) || /word/i.test(file.type);
    const meta = { id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: file.name, url, isPdf, isWord, size: file.size,
      sizeFormatted: file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`,
      extension: (file.name.split('.').pop() || '').toUpperCase(), uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) };
    uploaded.current[key] = { url, meta };
    return uploaded.current[key];
  };
  const keyOf = (file) => `${file.name}|${file.size}|${file.lastModified}`;

  // Read the office sheet / sale deed / tax receipt and fill what is still empty
  const readDocs = async (all) => {
    const files = READ_FROM.flatMap((id) => (all[id] || []).map((file) => ({ id, file })));
    if (!files.length) return;
    setReading(true); setReadNote('');
    // Percentage: uploading is the first 25% (file by file), reading climbs towards 95% over ~40 s, then 100%
    const what = files.some((x) => x.id === 'officeSheet') ? 'the office sheet' : files.length > 1 ? 'the documents' : files[0].id === 'saleDeed' ? 'the sale deed' : 'the tax receipt';
    setProg({ pct: 2, stage: `Uploading ${files.length > 1 ? `1 of ${files.length}` : 'the file'}…`, done: false });
    let timer = null;
    try {
      const list = [];
      for (const [i, { id, file }] of files.entries()) {
        setProg({ pct: 2 + Math.round((i / files.length) * 23), stage: `Uploading ${files.length > 1 ? `${i + 1} of ${files.length}` : 'the file'}…`, done: false });
        const u = await upload(file); list.push({ url: u.url, name: file.name, kind: id });
      }
      const t0 = Date.now();
      const tick = () => {
        const sec = (Date.now() - t0) / 1000;
        const stage = sec < 6 ? `Reading ${what}…` : sec < 16 ? 'Finding the name, bank and address…' : sec < 30 ? 'Checking what was read…' : 'Almost done — big files take a little longer…';
        setProg({ pct: 25 + 70 * (1 - Math.exp(-sec / 14)), stage, done: false });
      };
      tick(); timer = setInterval(tick, 500);
      const r = await fetch(`${API_BASE_URL}/api/assist/case-start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ files: list }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not read the documents.');
      const bank = bankFromText(banks, d.bankName);
      const got = { clientName: d.clientName, clientFatherName: d.fatherName, clientPhone: /^\d{10}$/.test(d.mobile || '') ? d.mobile : '', bankName: bank ? bank.name : '', bankBranch: bank ? String(d.bankBranch || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : '', address: d.address };
      const done = [];
      const cur = fRef.current || {};
      const patch = {};
      for (const [k, v] of Object.entries(got)) {
        if (!String(v || '').trim() || typed.current.has(k) || String(cur[k] || '').trim()) continue;
        patch[k] = String(v).trim(); if (FILL_LABEL[k]) done.push(k);
      }
      setF((x) => ({ ...x, ...patch }));
      setFilled((prev) => [...new Set([...prev, ...done])]);
      if (d.sheet) uploaded.current.__sheetFields = d.sheet;
      const src = d.from === 'sheet' ? 'the office sheet' : 'the documents';
      if (d.bankName && !bank) setReadNote(`Bank "${d.bankName}" is not in the list — choose it below.`);
      else setReadNote(done.length || got.clientName ? `Filled from ${src}. Please check.` : `Nothing could be read from ${src}. Please type the details.`);
      setProg({ pct: 100, stage: '', done: true });
    } catch (err) {
      setReadNote(`${err.message} Please type the details.`);
      setProg(null);
    } finally { clearInterval(timer); setReading(false); }
  };

  // Audio: what Gouru AI heard fills the customer, bank and address here, and the whole office sheet in the case
  const [voiceSheet, setVoiceSheet] = useState({});
  const voiceNotes = React.useRef([]); // recordings, saved to the case's files after Create // everything voice filled (for "Still needed")
  const voiceMeta = React.useRef({ unsure: [], checks: [], values: {} });
  const voiceTyped = React.useRef({}); // New Case field → what voice wrote (a change by the engineer is learned from)
  const applyVoice = (v, meta = {}) => {
    const purchase = v.dealType === 'Purchase';
    const bank = v.bank ? bankFromText(banks, v.bank) : null;
    const got = {
      clientName: purchase ? v.applicantName : v.ownerName,
      clientFatherName: purchase ? v.applicantRelation : v.ownerRelation,
      clientPhone: /^\d{10}$/.test(String(v.mobile || '').replace(/\D/g, '')) ? String(v.mobile).replace(/\D/g, '') : '',
      bankName: bank ? bank.name : '',
      bankBranch: v.bankBranch || '',
      address: v.address || (purchase ? v.applicantAddress : v.ownerAddress) || '',
    };
    const filledList = [];
    const skipped = [];
    const patch = {};
    for (const [k, val] of Object.entries(got)) {
      if (!String(val || '').trim()) continue;
      if (typed.current.has(k)) { skipped.push(`${FILL_LABEL[k]} (you typed it)`); continue; }
      patch[k] = String(val).trim();
      filledList.push({ key: k, label: FILL_LABEL[k], value: patch[k] });
    }
    if (v.bank && !bank) skipped.push(`Bank "${v.bank}" — not in the list, choose it below`);
    setF((x) => ({ ...x, ...patch }));
    setFilled((prev) => [...new Set([...prev, ...Object.keys(patch)])]);
    Object.assign(voiceTyped.current, patch);
    const vm = voiceMeta.current;
    voiceMeta.current = {
      unsure: [...new Set([...vm.unsure, ...(meta.unsure || [])])],
      checks: [...vm.checks.filter((c) => !(meta.checks || []).some((x) => x.field === c.field)), ...(meta.checks || [])],
      values: { ...vm.values, ...Object.fromEntries(Object.entries(v).flatMap(([k, val]) => (val && typeof val === 'object' ? Object.entries(val).map(([sd, x]) => [`${k}.${sd}`, x]) : [[k, val]]))) },
    };
    // Kept for the case's office sheet (later recordings add to it)
    const prev = uploaded.current.__sheetFields || {};
    const merged = { ...prev };
    for (const [k, val] of Object.entries(v)) {
      if (k === 'measurements' || k === 'boundaries') merged[k] = { ...(prev[k] || {}), ...val };
      else if (!['mobile', 'bankBranch', 'district'].includes(k)) merged[k] = val;
    }
    uploaded.current.__sheetFields = merged;
    setVoiceSheet(merged);
    const extra = Object.keys(v).filter((k) => !['ownerName', 'ownerRelation', 'applicantName', 'applicantRelation', 'bank', 'bankBranch', 'mobile', 'address', 'ownerAddress', 'applicantAddress'].includes(k)).length;
    if (extra) filledList.push({ key: '_sheet', label: 'Office sheet', value: `${extra} more detail${extra === 1 ? '' : 's'} — shown in the case after Create` });
    return { filled: filledList, skipped };
  };

  const addFiles = (id, list) => {
    const next = setDocs((d) => ({ ...d, [id]: [...(d[id] || []), ...list] }));
    if (READ_FROM.includes(id)) readDocs(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/cases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: f.clientName.trim(), clientFatherName: f.clientFatherName.trim(), clientPhone: f.clientPhone, bankName: f.bankName, bankBranch: f.bankBranch.trim(), address: f.address.trim(), locationData: f.address.trim(), note: f.note.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not create the case');
      // The office sheet goes straight into the case (already uploaded and read)
      const useSheet = sheetAllowed && (mode === 'sheet' || mode === 'audio');
      const sheetFiles = useSheet ? (docs.officeSheet || []).map((file) => uploaded.current[keyOf(file)]?.meta).filter(Boolean) : [];
      const sheetInit = useSheet ? { mode: 'sheet', source: mode === 'audio' ? 'audio' : 'file', files: sheetFiles, fields: uploaded.current.__sheetFields || null, voice: mode === 'audio' ? voiceMeta.current : null, voiceNotes: mode === 'audio' ? voiceNotes.current : [] } : null;
      // Names the engineer corrected after voice fill → taught to Gouru AI for next time
      const learnItems = Object.entries(voiceTyped.current).filter(([k, heard]) => f[k] && String(f[k]).trim() !== String(heard).trim() && !['clientPhone'].includes(k)).map(([k, heard]) => ({ field: k, heard, fixed: String(f[k]).trim() }));
      if (learnItems.length) fetch(`${API_BASE_URL}/api/assist/voice-learn`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ items: learnItems }) }).catch(() => {});
      // Valocity files: only these go to the Valocity portal (Gouru Autofill extension) — kept apart from the 5 documents
      if (valocity && (docs.valocity || []).length) {
        try { await addValocityUploads(d, docs.valocity); } catch (vErr) { toast.error(`Case created, but the Valocity files did not upload: ${vErr.message} Add them again in the case.`); }
      }
      const { officeSheet, valocity: _v, ...rest } = docs; // eslint-disable-line no-unused-vars
      if (valocity) { onCreated(d, {}, null); return; } // Valocity case: only its Valocity files
      onCreated(d, useSheet ? {} : rest, sheetInit);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const hl = (k) => (filled.includes(k) ? { background: '#eef2ff', borderRadius: 8 } : undefined);
  const row = (k, label, input) => (
    <label className="fs-row" style={hl(k)}><span style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.25 }}>{label}{filled.includes(k) && <small style={{ color: '#4f46e5', fontWeight: 700, fontSize: 11.5 }}>{mode === 'audio' ? 'from voice' : 'from document'}</small>}</span>{input}</label>
  );

  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <form className="fs-sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="New self case">
        <div className="fs-nav">
          <button type="button" className="fs-link" onClick={onClose}>Cancel</button>
          <span className="fs-title">New Case</span>
          <button type="submit" className="fs-link fs-strong" disabled={!ok}>{busy ? <Loader2 size={17} className="spin" /> : 'Create'}</button>
        </div>

        {Object.values(modes).filter(Boolean).length > 1 && (
          <>
            <div className="fs-section">How will you fill this case?</div>
            <div className="ems-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 0 4px' }}>
              {[['docs', 'Upload documents', '5 documents, check, site details'], ['sheet', 'Office sheet', 'Upload the filled sheet, photos + selfie'],
                ['audio', 'Audio', 'Upload a recording or speak the details'], ['valocity', 'Valocity', 'Photos & documents for the Valocity portal only']]
                .filter(([k]) => modes[k]).map(([k, t, sub]) => (
                <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                  style={{ textAlign: 'left', border: `1.5px solid ${mode === k ? '#2563eb' : '#cbd5e1'}`, background: mode === k ? '#eff6ff' : 'var(--bg-card, #fff)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2, boxShadow: mode === k ? '0 0 0 3px rgba(37,99,235,.12)' : 'none' }}>
                  <b style={{ fontSize: 14.5, color: mode === k ? '#1d4ed8' : 'var(--text-primary, #0f172a)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{k === 'audio' && <Mic size={15} />}{k === 'valocity' && <Globe size={15} />}{t}</b>
                  <small style={{ fontSize: 12, color: '#64748b', lineHeight: 1.3 }}>{sub}</small>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="fs-section">{mode === 'audio' ? 'Voice' : mode === 'sheet' ? 'Office sheet' : mode === 'valocity' ? 'Valocity files' : 'Documents'} <small style={{ textTransform: 'none' }}>· start here</small></div>
        {mode === 'audio' && (
          <div style={{ margin: '0 0 4px' }}>
            <VoiceSheetFill allowUpload big apply={applyVoice} storeKey={`voice:${currentUser?.id || 'me'}:newcase`} onVoiceNote={(doc) => { voiceNotes.current = [...voiceNotes.current, doc]; }}
              missing={[...(!f.clientName.trim() ? ['Name'] : []), ...(!f.address.trim() ? ['Address'] : []), ...(!f.bankName ? ['Bank'] : []), ...sheetMissing({ ...EMPTY_SHEET, ...voiceSheet })]}
              example="Client Siva, S/o Ramaiah, mobile 98765 43210, bank APGB, branch Kadapa Main, address door number 2/240-45 Chemmumiahpeta Kadapa, deed number 123 by 2025, survey number 114…" />
          </div>
        )}
        <div className="fs-group" style={mode === 'audio' ? { display: 'none' } : undefined}>
          <input ref={fileInput} type="file" multiple hidden accept={DOC_ACCEPT}
            onChange={(e) => { const list = Array.from(e.target.files || []); if (pickFor && list.length) addFiles(pickFor, list); e.target.value = ''; }} />
          <input ref={camInput} type="file" hidden accept="image/*" capture="environment"
            onChange={(e) => { const list = Array.from(e.target.files || []); if (pickFor && list.length) addFiles(pickFor, list); e.target.value = ''; }} />
          {(mode === 'valocity' ? [['valocity', 'Valocity files']] : SHEET_DOCS.filter(([id]) => (mode === 'sheet' ? id === 'officeSheet' : id !== 'officeSheet'))).map(([id, label]) => (
            <div key={id} className="fs-row" style={{ cursor: 'pointer' }} onClick={() => { setPickFor(id); fileInput.current?.click(); }} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPickFor(id); fileInput.current?.click(); } }}>
              <span style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.25 }}>{label}{READ_FROM.includes(id) && <small style={{ color: '#8e8e93', fontSize: 12 }}>fills the details</small>}{id === 'valocity' && <small style={{ color: '#8e8e93', fontSize: 12 }}>sent to Valocity</small>}</span>
              {docs[id]?.length ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34c759', fontWeight: 600, marginLeft: 'auto' }}>
                  {docs[id].length} file{docs[id].length === 1 ? '' : 's'}
                  <button type="button" aria-label={`Remove ${label}`} onClick={(e) => { e.stopPropagation(); setDocs((d) => ({ ...d, [id]: [] })); }}
                    style={{ border: 'none', background: 'none', color: '#8e8e93', padding: 2, cursor: 'pointer', display: 'inline-flex' }}><X size={16} /></button>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#007aff', marginLeft: 'auto' }}><Paperclip size={15} /> Add</span>
              )}
              <button type="button" aria-label={`Take a photo of the ${label}`} title="Camera"
                onClick={(e) => { e.stopPropagation(); setPickFor(id); camInput.current?.click(); }}
                style={{ marginLeft: 10, width: 36, height: 36, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'rgba(0,122,255,.1)', color: '#007aff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <Camera size={17} />
              </button>
              {id === 'valocity' && (
                <button type="button" aria-label="Fill the details by voice" title="Voice" aria-pressed={valocityVoice}
                  onClick={(e) => { e.stopPropagation(); setValocityVoice((v) => !v); }}
                  style={{ marginLeft: 8, width: 36, height: 36, flexShrink: 0, borderRadius: '50%', border: 'none', background: valocityVoice ? '#4f46e5' : 'rgba(79,70,229,.1)', color: valocityVoice ? '#fff' : '#4f46e5', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  <Mic size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Valocity: the customer details can also be spoken or read from a voice recording */}
        {mode === 'valocity' && valocityVoice && (
          <div style={{ margin: '8px 0 4px' }}>
            <VoiceSheetFill allowUpload apply={applyVoice} storeKey={`voice:${currentUser?.id || 'me'}:newcase-valocity`}
              missing={[...(!f.clientName.trim() ? ['Name'] : []), ...(!f.address.trim() ? ['Address'] : []), ...(!f.bankName ? ['Bank'] : [])]}
              example="Client Siva, S/o Ramaiah, mobile 98765 43210, bank SBI, branch Kadapa Main, address door number 2/240-45 Chemmumiahpeta Kadapa" />
          </div>
        )}
        {mode !== 'audio' && prog && <div style={{ padding: '0 4px' }}><ReadingProgress pct={prog.pct} stage={prog.stage} done={prog.done} note={readNote} /></div>}
        {mode !== 'audio' && !prog && <p className="fs-foot" style={{ marginBottom: 4 }}>
          {readNote || (mode === 'valocity'
            ? 'Add the photos and documents for the Valocity portal. Only these go to Valocity, nothing else from the case. Type the customer details below, or tap the mic to speak them or upload a recording.'
            : mode === 'sheet'
              ? 'Add the filled office sheet (Word, PDF or photos). Gouru AI fills the customer, bank and address below.'
              : 'Add the sale deed or tax receipt and Gouru AI fills the customer and address below. You can also type them.')}
        </p>}

        <div className="fs-section">Customer</div>
        <div className="fs-group">
          {row('clientName', 'Name', <input value={f.clientName} onChange={set('clientName')} placeholder="Required" autoComplete="off" />)}
          {row('clientFatherName', 'S/o, W/o', <input value={f.clientFatherName} onChange={set('clientFatherName')} placeholder="Optional" autoComplete="off" />)}
          {row('clientPhone', 'Mobile', <input value={f.clientPhone} onChange={set('clientPhone')} placeholder="10 digits" inputMode="numeric" autoComplete="off" />)}
          {row('bankName', 'Bank', (
            <select value={f.bankName} onChange={(e) => { setBranchTyping(false); set('bankName')(e); setF((x) => ({ ...x, bankBranch: '' })); }}>
              <option value="">Not yet known</option>
              {banks.map((b) => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
            </select>
          ))}
          {f.bankName && row('bankBranch', 'Bank branch', (() => {
            // The chosen bank's branches (Settings → Banks): this engineer's own office first, then other towns.
            // "Other…" lets them type a branch that is not in the list.
            const bank = banks.find((b) => b.name === f.bankName);
            const all = (bank && bank.branches) || [];
            const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const groups = ((bank && bank.officeBranches) || []).filter((g) => (g.names || []).length);
            const filed = new Set(groups.flatMap((g) => g.names).map(norm));
            const office = currentUser?.branchInfo?.name || '';
            const own = groups.find((g) => office && norm(g.office) === norm(office));
            const mine = groups.length ? [...(own ? own.names : []), ...all.filter((b) => !filed.has(norm(b)))] : all;
            const others = groups.filter((g) => g !== own);
            const known = all.some((b) => norm(b) === norm(f.bankBranch));
            if (!all.length || branchTyping || (f.bankBranch && !known)) {
              return <input value={f.bankBranch} onChange={set('bankBranch')} placeholder={all.length ? 'Type the branch' : 'Optional'} autoComplete="off" autoFocus={branchTyping} />;
            }
            return (
              <select value={known ? all.find((b) => norm(b) === norm(f.bankBranch)) : ''}
                onChange={(e) => { if (e.target.value === '__other') { setBranchTyping(true); setF((x) => ({ ...x, bankBranch: '' })); } else set('bankBranch')(e); }}>
                <option value="">Choose branch (optional)</option>
                {mine.length > 0 && (others.length ? <optgroup label={own ? `${own.office} office` : 'Branches'}>{mine.map((b) => <option key={b} value={b}>{b}</option>)}</optgroup> : mine.map((b) => <option key={b} value={b}>{b}</option>))}
                {others.map((g) => <optgroup key={g.office} label={`${g.office} office`}>{g.names.map((b) => <option key={b} value={b}>{b}</option>)}</optgroup>)}
                <option value="__other">Other… (type it)</option>
              </select>
            );
          })())}
        </div>
        <div className="fs-section">Property</div>
        <div className="fs-group">
          {row('address', 'Address', <input value={f.address} onChange={set('address')} placeholder="Required" autoComplete="off" />)}
          <label className="fs-row"><span>Note</span><input value={f.note} onChange={set('note')} placeholder="Optional" autoComplete="off" /></label>
        </div>
        <p className="fs-foot">{mode === 'valocity'
          ? 'After Create, the Valocity files are saved on the case. On Valocity, the Gouru Autofill extension attaches only these.'
          : mode === 'audio'
          ? 'After Create, the case opens with everything Gouru AI heard already filled in. Check it, then add the site photos and selfie.'
          : mode === 'sheet'
          ? 'After Create, the case opens on the office sheet, already filled in. Check it, then add the site photos and selfie.'
          : docCount
          ? `After Create, Gouru AI checks ${docCount === 1 ? 'this file' : `these ${docCount} files`} in the case. Then add the photos and details and submit it to your admin.`
          : 'The case gets a file number now. Fill in the documents, photos and details, then submit it to your admin for review.'}</p>
      </form>
    </div>,
    document.body,
  );
}
