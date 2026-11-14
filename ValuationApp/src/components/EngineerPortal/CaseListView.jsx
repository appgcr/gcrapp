import React, { useState, useEffect } from 'react';
import { FileText, Search, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useBanks } from '../../utils/banks';
import toast from 'react-hot-toast';
import IconTile from '../Shared/IconTile';
import './AttendanceView.css';
import { API_BASE_URL } from '../../config/api';
import CaseCreationModal from './CaseModalSteps/CaseCreationModal';

export default function CaseListView({ onOpenCase, currentUser }) {
  const [casesList, setCasesList] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState(null);
  // Self cases: an admin can allow this engineer to file their own cases
  const [canSelfCase, setCanSelfCase] = useState(!!currentUser?.canSelfCase);
  const [newOpen, setNewOpen] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u) setCanSelfCase(!!u.canSelfCase); })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cases`)
      .then(res => res.json())
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
      })
      .catch(err => console.error("Failed to fetch cases:", err));
  }, [currentUser, reload]);

  const filteredCases = casesList.filter(c => 
    (c.title && c.title.toLowerCase().includes(search.toLowerCase())) ||
    (c.id && c.id.toLowerCase().includes(search.toLowerCase())) ||
    (c.fileNumber && c.fileNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const checkAttendanceClockIn = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      // On duty = the latest Check-In / Check-Out (location on/off events and updates don't change it)
      const todayLogs = Array.isArray(data) ? data.filter(log => log.attendanceType === 'Clock-In' || log.attendanceType === 'Clock-Out') : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('Please Check In on the Today tab first.', { duration: 4000 });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to verify attendance status', err);
      toast.error('Failed to verify attendance status. Please try again.');
      return false;
    }
  };

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

      {casesList.length === 0 && <div className="td-group"><div className="td-empty">No cases assigned to you yet.</div></div>}
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
          onCreated={(c) => {
            setNewOpen(false);
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
          onClose={() => {
            setIsModalOpen(false);
            setEditingCaseId(null);
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

// Short form to start a self case; the full details are filled in the usual case form afterwards
function SelfCaseSheet({ onClose, onCreated }) {
  const banks = useBanks();
  const [f, setF] = useState({ clientName: '', clientPhone: '', bankName: '', address: '', note: '' });
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
      onCreated(d);
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
        <p className="fs-foot">The case gets a file number now. Fill in the documents, photos and details, then submit it — it goes to your admin for review, like any other case.</p>
      </form>
    </div>,
    document.body,
  );
}
