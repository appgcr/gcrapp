import React, { useState, useEffect } from 'react';
import { FileText, Search, ChevronRight, Plus, Loader2, Paperclip, X } from 'lucide-react';
import { DOC_ACCEPT } from '../../utils/docFiles';
import { createPortal } from 'react-dom';
import { useBanks } from '../../utils/banks';
import toast from 'react-hot-toast';
import IconTile from '../Shared/IconTile';
import './AttendanceView.css';
import { API_BASE_URL } from '../../config/api';
import CaseCreationModal from './CaseModalSteps/CaseCreationModal';
import { ensureCheckedIn } from '../../utils/dutyCheck';

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
          onClose={() => setNewOpen(false)}
          onCreated={(c, docs) => {
            setNewOpen(false);
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
          onClose={() => {
            setIsModalOpen(false);
            setEditingCaseId(null);
            setSheetDocs(null);
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
  ['saleDeed', 'Sale Deed'],
  ['buildingPlan', 'Building Plan'],
  ['propertyTax', 'Property Tax'],
  ['marketValue', 'Market Value'],
  ['layoutPlan', 'Layout Plan'],
];

// Short form to start a self case; the full details are filled in the usual case form afterwards
function SelfCaseSheet({ onClose, onCreated }) {
  const banks = useBanks();
  const [f, setF] = useState({ clientName: '', clientPhone: '', bankName: '', address: '', note: '' });
  const [docs, setDocs] = useState({}); // docId → [File]
  const [pickFor, setPickFor] = useState(null);
  const fileInput = React.useRef(null);
  const docCount = Object.values(docs).reduce((n, a) => n + a.length, 0);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'clientPhone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }));
  const ok = f.clientName.trim() && f.address.trim() && (!f.clientPhone || f.clientPhone.length === 10) && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/cases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: f.clientName.trim(), clientPhone: f.clientPhone, bankName: f.bankName, address: f.address.trim(), locationData: f.address.trim(), note: f.note.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not create the case');
      onCreated(d, docs);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <form className="fs-sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="New self case">
        <div className="fs-nav">
          <button type="button" className="fs-link" onClick={onClose}>Cancel</button>
          <span className="fs-title">New Case</span>
          <button type="submit" className="fs-link fs-strong" disabled={!ok}>{busy ? <Loader2 size={17} className="spin" /> : 'Create'}</button>
        </div>
        <div className="fs-section">Customer</div>
        <div className="fs-group">
          <label className="fs-row"><span>Name</span><input value={f.clientName} onChange={set('clientName')} placeholder="Required" autoComplete="off" /></label>
          <label className="fs-row"><span>Mobile</span><input value={f.clientPhone} onChange={set('clientPhone')} placeholder="10 digits" inputMode="numeric" autoComplete="off" /></label>
          <label className="fs-row">
            <span>Bank</span>
            <select value={f.bankName} onChange={set('bankName')}>
              <option value="">Not yet known</option>
              {banks.map((b) => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
            </select>
          </label>
        </div>
        <div className="fs-section">Property</div>
        <div className="fs-group">
          <label className="fs-row"><span>Address</span><input value={f.address} onChange={set('address')} placeholder="Required" autoComplete="off" /></label>
          <label className="fs-row"><span>Note</span><input value={f.note} onChange={set('note')} placeholder="Optional" autoComplete="off" /></label>
        </div>
        <div className="fs-section">Documents <small style={{ textTransform: 'none' }}>· optional</small></div>
        <div className="fs-group">
          <input ref={fileInput} type="file" multiple hidden accept={DOC_ACCEPT}
            onChange={(e) => { const list = Array.from(e.target.files || []); if (pickFor && list.length) setDocs((d) => ({ ...d, [pickFor]: [...(d[pickFor] || []), ...list] })); e.target.value = ''; }} />
          {SHEET_DOCS.map(([id, label]) => (
            <div key={id} className="fs-row" style={{ cursor: 'pointer' }} onClick={() => { setPickFor(id); fileInput.current?.click(); }} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPickFor(id); fileInput.current?.click(); } }}>
              <span>{label}</span>
              {docs[id]?.length ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34c759', fontWeight: 600, marginLeft: 'auto' }}>
                  {docs[id].length} file{docs[id].length === 1 ? '' : 's'}
                  <button type="button" aria-label={`Remove ${label}`} onClick={(e) => { e.stopPropagation(); setDocs((d) => ({ ...d, [id]: [] })); }}
                    style={{ border: 'none', background: 'none', color: '#8e8e93', padding: 2, cursor: 'pointer', display: 'inline-flex' }}><X size={16} /></button>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#007aff', marginLeft: 'auto' }}><Paperclip size={15} /> Add</span>
              )}
            </div>
          ))}
        </div>
        <p className="fs-foot">{docCount
          ? `Gouru AI checks ${docCount === 1 ? 'this file' : `these ${docCount} files`} as soon as the case opens. Then add the photos and details and submit it to your admin.`
          : 'Add the documents now or later. The case gets a file number now; fill in the documents, photos and details, then submit it to your admin for review.'}</p>
      </form>
    </div>,
    document.body,
  );
}
