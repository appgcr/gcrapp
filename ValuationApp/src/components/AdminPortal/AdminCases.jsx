import React, { useState, useEffect } from 'react';
import { Search, MapPin, FileText, CheckCircle2, Loader2, ChevronDown, Plus, X, Edit2, Navigation, RotateCcw, History, AlertTriangle, Download, Phone, CalendarClock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import LiveTrackingMap from './LiveTrackingMap';
import ReportViewer, { fetchReport } from '../Shared/ReportViewer';
import { API_BASE_URL } from '../../config/api';
import { authHeaders, errorFrom } from '../Shared/authHeaders';
import { STAGES, stageOf } from '../Shared/caseStages';
import { isSuperAdmin, getBranchScope } from '../../utils/session';
import { useBanks, matchBank, searchBanks } from '../../utils/banks';


export default function AdminCases({ defaultFilter = '', currentUser }) {
  const [activeTab, setActiveTab] = useState('NEW');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef(null);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingCaseId, setTrackingCaseId] = useState(null);
  // One bank list for the whole app (Super Admin → Settings → Banks)
  const bankRecords = useBanks();
  
  // Branches (Super Admin chooses which branch a new case belongs to)
  const superAdmin = isSuperAdmin(currentUser);
  const scope = getBranchScope();
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    if (!superAdmin) return;
    fetch(`${API_BASE_URL}/api/branches`).then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {});
  }, [superAdmin]);
  const branchById = (id) => branches.find((b) => b.id === id);

  // New Task Form State
  const [newTask, setNewTask] = useState({
    id: null,
    branchId: scope !== 'all' ? scope : '',
    borrowerName: '',
    bankName: '',
    mobileNumber: '',
    note: '',
    assignedStaffId: '',
    address: '',
    date: '',
    time: ''
  });

  // Return for Corrections Modal State (Defect 02)
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningCase, setReturningCase] = useState(null);
  const [correctionComment, setCorrectionComment] = useState('');

  // Version History Modal State (Defect 03)
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionCaseId, setVersionCaseId] = useState(null);
  const [caseVersions, setCaseVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState(() => {
    const saved = localStorage.getItem('gcr_valuation_recent_addresses') || localStorage.getItem('sbi_valuation_recent_addresses');
    return saved ? JSON.parse(saved) : [];
  });
  
  const saveRecentAddress = (addr) => {
    if (!addr || addr.trim() === '') return;
    let recents = [...recentAddresses];
    recents = recents.filter(a => a !== addr);
    recents.unshift(addr);
    if (recents.length > 5) recents = recents.slice(0, 5);
    setRecentAddresses(recents);
    localStorage.setItem('gcr_valuation_recent_addresses', JSON.stringify(recents));
  };

  
  useEffect(() => {
    if (newTask.address.length > 0 && showAddressDropdown) {
      const timeoutId = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newTask.address)}&countrycodes=in&limit=6`)
          .then(res => res.json())
          .then(data => {
            setAddressSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
          })
          .catch(err => console.error(err));
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setAddressSuggestions([]);
    }
  }, [newTask.address, showAddressDropdown]);

  const [engineerFilter, setEngineerFilter] = useState('');
  
  const [systemConfig, setSystemConfig] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [processingId, setProcessingId] = useState(null);
  // The bank-format report opened in the in-app viewer
  const [viewing, setViewing] = useState(null);

  const fetchData = () => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/cases`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/users`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/config`).then(res => res.json()).catch(() => null)
    ]).then(([casesData, usersData, configData]) => {
      if (configData) setSystemConfig(configData);
      const casesArr = Array.isArray(casesData) ? casesData : [];
      setCases(casesArr);
      setUsers(Array.isArray(usersData) ? usersData.filter(u => u.role === 'ENGINEER') : []);


      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    
    // Set up polling for real-time updates every 10 seconds
    const intervalId = setInterval(fetchData, 10000);
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Update effect to handle default filters from dashboard clicks
  useEffect(() => {
    if (String(defaultFilter).startsWith('NEW_CASE')) {
      setActiveTab('NEW');
      setIsCreateFormOpen(true);
      return;
    }
    if (String(defaultFilter).startsWith('FIND')) {
      setIsCreateFormOpen(false);
      setTimeout(() => searchInputRef.current?.focus(), 150);
      return;
    }
    if (defaultFilter === 'Approved') setActiveTab('DONE');
    else if (defaultFilter === 'Pending') setActiveTab('REVIEW');
    else if (defaultFilter === 'Returned') setActiveTab('RETURNED');
    else if (defaultFilter === 'Field') setActiveTab('FIELD');
    else if (defaultFilter === '') setActiveTab('NEW');
  }, [defaultFilter]);

  const handleAssign = async (caseId) => {
    const engineerId = assignments[caseId];
    if (!engineerId) return toast.error('Choose an engineer first.');
    const engineer = users.find(u => u.id === engineerId);
    setProcessingId(caseId);
    try {
      // The server records the assignment and alerts the engineer (in-app + push)
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ assignedEngineerId: engineer.id, assignedEngineerName: engineer.name, status: 'Pending' })
      });
      if (!res.ok) throw new Error(await errorFrom(res, 'Could not assign the case'));
      toast.success(`Assigned to ${engineer.name}`);
      setAssignments(prev => { const n = { ...prev }; delete n[caseId]; return n; });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not assign the case');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    // Bank is strictly optional at initial creation (Defect 01)
    if (!newTask.borrowerName || !newTask.mobileNumber || !newTask.address) {
      toast.error("Please fill all required fields marked with *");
      return;
    }
    if (superAdmin && !newTask.id && !newTask.branchId) {
      toast.error('Choose which branch this case belongs to');
      return;
    }

    // The bank must be one from the list (typed short names like "APGB" are matched)
    const chosenBank = newTask.bankName.trim() ? matchBank(bankRecords, newTask.bankName) : null;
    if (newTask.bankName.trim() && !chosenBank) {
      toast.error(`“${newTask.bankName.trim()}” is not in the bank list. Pick one from the list${superAdmin ? ' or add it in Settings → Banks' : ' — ask the Super Admin to add it'}.`);
      return;
    }

    setProcessingId('creating');
    try {
      const engineer = users.find(u => u.id === newTask.assignedStaffId);
      
      const payload = {
        clientName: newTask.borrowerName,
        bankName: chosenBank ? chosenBank.name : '',
        clientPhone: newTask.mobileNumber,
        note: newTask.note,
        locationData: newTask.address,
        address: newTask.address,
        inspectionDate: newTask.date,
        inspectionTime: newTask.time
      };
      if (superAdmin && !newTask.id) payload.branchId = newTask.branchId;

      if (engineer) {
        payload.assignedEngineerId = engineer.id;
        payload.assignedEngineerName = engineer.name;
        payload.status = 'Pending';
      }

      let res;
      let createdCase;

      if (newTask.id) {
        // Update existing case
        res = await fetch(`${API_BASE_URL}/api/cases/${newTask.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        createdCase = await res.json();
      } else {
        // Create new case
        res = await fetch(`${API_BASE_URL}/api/cases`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        createdCase = await res.json();
      }
      
      if (!res.ok) {
        throw new Error(createdCase.error || "Failed to save task");
      }

      // The server alerts the engineer (in-app + push) — no extra client-side notification

      toast.success(newTask.id ? (engineer ? "Task updated and assigned!" : "Task details updated!") : "Task created and assigned successfully!");
      saveRecentAddress(newTask.address);
      setNewTask({ id: null, branchId: scope !== 'all' ? scope : '', borrowerName: '', bankName: '', mobileNumber: '', note: '', assignedStaffId: '', address: '', date: '', time: '' });
      setIsCreateFormOpen(false); // Close form on success
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save task.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateNewTask = handleCreateOrUpdateTask;

  const handleApprove = async (caseId) => {
    if (!window.confirm(`Approve Case #${caseId}? The engineer will be notified and the report becomes final.`)) return;
    setProcessingId(caseId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'Approved' })
      });
      if (!res.ok) throw new Error(await errorFrom(res, 'Could not approve the case'));
      toast.success(`Case #${caseId} approved`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not approve the case');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredCases = cases.filter(c => {
    if (!searchQuery) return true;
    const sq = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(sq) ||
      (c.fileNumber && c.fileNumber.toLowerCase().includes(sq)) ||
      (c.clientName && c.clientName.toLowerCase().includes(sq)) ||
      (c.locationData && c.locationData.toLowerCase().includes(sq)) ||
      (c.bankName && c.bankName.toLowerCase().includes(sq))
    );
  });

  const filteredBanks = searchBanks(bankRecords, newTask.bankName).map(b => b.name);
  const pickedBank = matchBank(bankRecords, newTask.bankName);

  // Workflow tabs (every case appears in exactly one)
  const TAB_FOR_STAGE = { unassigned: 'NEW', field: 'FIELD', review: 'REVIEW', returned: 'RETURNED', approved: 'DONE', rejected: 'DONE' };
  const TABS = [
    { key: 'NEW', label: 'Unassigned' },
    { key: 'FIELD', label: 'In Field' },
    { key: 'REVIEW', label: 'Review' },
    { key: 'RETURNED', label: 'Returned' },
    { key: 'DONE', label: 'Done' },
  ];
  const byTab = { NEW: [], FIELD: [], REVIEW: [], RETURNED: [], DONE: [] };
  filteredCases.forEach(c => {
    const tab = TAB_FOR_STAGE[stageOf(c)];
    if (tab !== 'NEW' && engineerFilter && c.assignedEngineerId !== engineerFilter) return;
    byTab[tab].push(c);
  });
  // Oldest first where waiting time matters; newest first for finished work
  const ts = (c) => new Date(c.createdAt).getTime() || 0;
  Object.keys(byTab).forEach(k => byTab[k].sort((x, y) => (k === 'DONE' ? ts(y) - ts(x) : ts(x) - ts(y))));
  const newTasks = byTab.NEW;
  const engineers = users.filter(u => u.role === 'ENGINEER');
  // Engineers are always from the case's own branch
  const engineersFor = (branchId) => (branchId ? engineers.filter(u => u.branchId === branchId) : engineers);

  // ---------- case card (one design for every tab) ----------
  const HOUR = 3600 * 1000;
  const ageOf = (c) => {
    const t = new Date(c.createdAt).getTime();
    if (!t) return null;
    const ms = Date.now() - t;
    if (ms < HOUR) return { text: `${Math.max(1, Math.round(ms / 60000))} min`, ms };
    if (ms < 24 * HOUR) return { text: `${Math.floor(ms / HOUR)} hr`, ms };
    const d = Math.floor(ms / (24 * HOUR));
    return { text: `${d} ${d === 1 ? 'day' : 'days'}`, ms };
  };
  const OVERDUE = { NEW: 24 * HOUR, REVIEW: 48 * HOUR, FIELD: 7 * 24 * HOUR, RETURNED: 3 * 24 * HOUR };
  const fmtINR = (n) => {
    if (!n) return null;
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  };
  const fmtInspection = (c) => {
    if (!c.inspectionDate) return null;
    const d = new Date(`${String(c.inspectionDate).slice(0, 10)}T${(c.inspectionTime || '00:00').slice(0, 5)}`);
    if (Number.isNaN(d.getTime())) return `${c.inspectionDate}${c.inspectionTime ? ` · ${c.inspectionTime}` : ''}`;
    const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return c.inspectionTime ? `${day} · ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : day;
  };
  const openEdit = (c) => {
    setNewTask({
      id: c.id,
      fileNumber: c.fileNumber || '',
      branchId: c.branchId || '',
      borrowerName: c.clientName || c.borrowerName || '',
      bankName: c.bankName || '',
      mobileNumber: c.clientPhone || c.mobile || '',
      note: c.note || '',
      address: c.locationData || c.address || '',
      date: c.inspectionDate || '',
      time: c.inspectionTime || '',
      assignedStaffId: c.assignedEngineerId === 'UNASSIGNED' ? '' : c.assignedEngineerId
    });
    setActiveTab('NEW');
    setIsCreateFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openHistory = async (c) => {
    setVersionCaseId(c.id);
    setVersionModalOpen(true);
    setLoadingVersions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${c.id}/versions`, { headers: authHeaders() });
      const data = await res.json();
      setCaseVersions(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Could not load the history');
    } finally {
      setLoadingVersions(false);
    }
  };

  const renderCaseCard = (c, tab) => {
    const stage = STAGES.find(st => st.key === stageOf(c));
    const age = ageOf(c);
    const overdue = age && OVERDUE[tab] && age.ms > OVERDUE[tab];
    const value = c.valuation?.realizableValue || c.valuation?.fairMarketValue || 0;
    const inspection = fmtInspection(c);
    const address = c.address || c.locationData || '';
    const engineer = c.assignedEngineerName && c.assignedEngineerName !== 'Unknown' ? c.assignedEngineerName : null;
    const busy = processingId === c.id;

    return (
      <article key={c.id} className="cs-card">
        <header className="cs-head">
          <div className="cs-title-wrap">
            <div className="cs-title">{c.clientName || c.borrowerName || 'Unnamed client'}</div>
            <div className="cs-sub">
              {superAdmin && scope === 'all' && branchById(c.branchId) && <span className="cs-branch">{branchById(c.branchId).code}</span>}
              <span className="cs-file">{c.fileNumber || `#${c.id}`}</span>{c.bankName ? ` · ${c.bankName}` : ' · Bank not set'}{c.bankBranch ? ` · ${c.bankBranch}` : ''}
            </div>
          </div>
          <span className="cs-badge" style={{ '--st': stage?.light }}>
            <span className="cs-dot" aria-hidden="true" />{stage?.label}
          </span>
        </header>

        {c.source === 'BANK' && c.requestedBy && (
          <div className="cs-bankreq" data-testid="bank-request">
            <div className="cs-bankreq-head">
              <span className="cs-bankreq-tag">Bank request{c.requestDetails?.urgency === 'Urgent' ? ' · URGENT' : ''}</span>
              <span>{c.requestedBy.name}{c.requestedBy.designation ? `, ${c.requestedBy.designation}` : ''} · {c.requestedBy.bankBranch || c.requestedBy.bankName}{c.requestedBy.phone ? ` · ${c.requestedBy.phone}` : ''}</span>
            </div>
            <div className="cs-bankreq-body">
              {[c.propertyDetails?.propertyType, c.requestDetails?.loanPurpose, c.requestDetails?.loanAmount && `Loan ₹${c.requestDetails.loanAmount}`].filter(Boolean).join(' · ')}
              {c.clientPhone ? ` · Customer ${c.clientPhone}` : ''}
              {c.requestDetails?.propertyAddress && <div>📍 {c.requestDetails.propertyAddress}{c.requestDetails.surveyNo ? ` (Sy. ${c.requestDetails.surveyNo})` : ''}{c.requestDetails.extent ? ` · ${c.requestDetails.extent}` : ''}</div>}
              {c.requestDetails?.contactPerson && <div>Site contact: {c.requestDetails.contactPerson}{c.requestDetails.contactPhone ? ` (${c.requestDetails.contactPhone})` : ''}</div>}
              {c.requestDetails?.notes && <div>“{c.requestDetails.notes}”</div>}
            </div>
          </div>
        )}

        <dl className="cs-facts">
          {address && (<div><dt><MapPin size={14} /></dt><dd>{address}</dd></div>)}
          {inspection && (<div><dt><CalendarClock size={14} /></dt><dd>Inspection {inspection}</dd></div>)}
          {engineer && (<div><dt><User size={14} /></dt><dd>{engineer}</dd></div>)}
          {tab === 'RETURNED' && c.rejectionReason && (
            <div className="cs-reason"><dt><RotateCcw size={14} /></dt><dd>“{c.rejectionReason}”{c.returnedBy ? ` — ${c.returnedBy}` : ''}</dd></div>
          )}
        </dl>

        <div className="cs-meta">
          {age && <span className={`cs-age ${overdue ? 'is-overdue' : ''}`}>{overdue && <AlertTriangle size={12} />}{age.text} old</span>}
          {value > 0 && <span className="cs-value">{fmtINR(value)}</span>}
          {(c.version || 1) > 1 && <span className="cs-ver">v{c.version}</span>}
        </div>

        {/* Actions for this stage */}
        {tab === 'NEW' && (
          <div className="cs-assign">
            <select
              aria-label={`Engineer for case ${c.id}`}
              value={assignments[c.id] || ''}
              onChange={e => setAssignments({ ...assignments, [c.id]: e.target.value })}
            >
              <option value="">Choose engineer…</option>
              {engineersFor(c.branchId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="cs-btn cs-primary" onClick={() => handleAssign(c.id)} disabled={busy || !assignments[c.id]}>
              {busy ? <Loader2 size={16} className="spin" /> : 'Assign'}
            </button>
          </div>
        )}

        <div className="cs-actions">
          {c.clientPhone && (
            <a className="cs-btn cs-ghost" href={`tel:${c.clientPhone}`} title={`Call ${c.clientPhone}`}><Phone size={15} /> Call</a>
          )}
          {(tab === 'NEW' || tab === 'FIELD') && (
            <button className="cs-btn cs-ghost" onClick={() => openEdit(c)}><Edit2 size={15} /> {tab === 'FIELD' ? 'Edit / Reassign' : 'Edit'}</button>
          )}
          {tab === 'FIELD' && c.trackingStatus === 'active' && (
            <button className="cs-btn cs-ghost" onClick={() => setTrackingCaseId(c.id)}><Navigation size={15} /> Track</button>
          )}
          {(tab === 'REVIEW' || tab === 'RETURNED' || tab === 'DONE') && (
            <button className="cs-btn cs-ghost" onClick={() => openHistory(c)}><History size={15} /> History</button>
          )}
          {(tab === 'REVIEW' || tab === 'DONE') && (
            <button className="cs-btn cs-ghost" onClick={() => setViewing(c)}><FileText size={15} /> View Report</button>
          )}
        </div>

        {tab === 'REVIEW' && (
          <div className="cs-decide">
            <button className="cs-btn cs-return" onClick={() => { setReturningCase(c); setCorrectionComment(''); setReturnModalOpen(true); }} disabled={busy}>
              <RotateCcw size={15} /> Return
            </button>
            <button className="cs-btn cs-approve" onClick={() => handleApprove(c.id)} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : <><CheckCircle2 size={16} /> Approve</>}
            </button>
          </div>
        )}
      </article>
    );
  };

  const EMPTY = {
    NEW: 'No cases waiting for an engineer.',
    FIELD: 'No cases out in the field right now.',
    REVIEW: 'No reports waiting for your review.',
    RETURNED: 'No reports sent back for corrections.',
    DONE: 'No finished cases yet.',
  };
  // What each stage means, shown under the tabs so the flow is clear at a glance
  const TAB_INFO = {
    NEW: { color: STAGES.find(s => s.key === 'unassigned').light, Icon: Plus, text: 'New cases not yet given to an engineer. Assign one to send it to the field.' },
    FIELD: { color: STAGES.find(s => s.key === 'field').light, Icon: Navigation, text: 'Assigned to an engineer — site visit and report in progress. Moves to Review when they submit.' },
    REVIEW: { color: STAGES.find(s => s.key === 'review').light, Icon: FileText, text: 'Reports submitted by engineers. Check them, then approve or send back for corrections.' },
    RETURNED: { color: STAGES.find(s => s.key === 'returned').light, Icon: RotateCcw, text: 'Reports you sent back. They return to Review when the engineer resubmits.' },
    DONE: { color: STAGES.find(s => s.key === 'approved').light, Icon: CheckCircle2, text: 'Approved or rejected cases — the finished record, with reports to download.' },
  };
  const filterName = engineerFilter ? (users.find(u => u.id === engineerFilter)?.name || 'this engineer') : '';
  const emptyState = (tab) => {
    const info = TAB_INFO[tab];
    const filtered = tab !== 'NEW' && engineerFilter && !searchQuery;
    return (
      <div className="cs-empty">
        <span className="cs-empty-icon" style={{ background: info.color }}><info.Icon size={22} color="#fff" strokeWidth={2.4} /></span>
        <div className="cs-empty-title">
          {searchQuery ? `No cases match “${searchQuery}” here.` : filtered ? `Nothing here for ${filterName}.` : EMPTY[tab]}
        </div>
        <div className="cs-empty-sub">{info.text}</div>
        {filtered && <button className="cs-btn cs-ghost" onClick={() => setEngineerFilter('')}>Show all engineers</button>}
        {tab === 'NEW' && !searchQuery && <button className="cs-btn cs-primary" onClick={() => setIsCreateFormOpen(true)}><Plus size={16} /> New Case</button>}
      </div>
    );
  };

  return (
    <div className="animate-fade-in cs-page">
      <div className="cs-top">
        <div className="cs-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search client, case ID, bank or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search cases"
          />
        </div>
        <button
          className="cs-new"
          onClick={() => { setActiveTab('NEW'); setIsCreateFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <Plus size={18} strokeWidth={2.6} /> New Case
        </button>
      </div>

      <div className="cs-tabs" role="tablist" aria-label="Case stage">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={activeTab === t.key ? 'active' : ''}
            onClick={() => { setActiveTab(t.key); setIsCreateFormOpen(false); }}
          >
            <span>{t.label}</span>
            <span className={`cs-count ${t.key === 'REVIEW' && byTab.REVIEW.length ? 'hot' : ''}`}>{byTab[t.key].length}</span>
          </button>
        ))}
      </div>

      {!isCreateFormOpen && !loading && byTab[activeTab].length > 0 && (
        <p className="cs-hint"><span className="cs-hint-dot" style={{ background: TAB_INFO[activeTab].color }} />{TAB_INFO[activeTab].text}</p>
      )}

      {activeTab !== 'NEW' && engineers.length > 0 && (
        <div className="cs-filter">
          <User size={15} aria-hidden="true" />
          <select value={engineerFilter} onChange={e => setEngineerFilter(e.target.value)} aria-label="Filter by engineer">
            <option value="">All engineers</option>
            {engineers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '18px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '20%', height: '24px', borderRadius: '12px' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div className="skeleton skeleton-text" style={{ width: '30%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <div className="skeleton skeleton-avatar" style={{ width: '32px', height: '32px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '100px', alignSelf: 'center', margin: 0 }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* NEW TASKS TAB */}
          {activeTab === 'NEW' && (
            <>
              {isCreateFormOpen ? (
                <div className="admin-card relative">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                      {newTask.id ? `Edit ${newTask.fileNumber || `#${newTask.id}`}` : 'Create & Assign New Task'}
                    </h2>
                    <button 
                      onClick={() => {
                        setIsCreateFormOpen(false);
                        setNewTask({ id: null, branchId: scope !== 'all' ? scope : '', borrowerName: '', bankName: '', mobileNumber: '', note: '', assignedStaffId: '', address: '', date: '', time: '' });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateNewTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {superAdmin && !newTask.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Branch *</label>
                        <select
                          required
                          value={newTask.branchId}
                          onChange={(e) => setNewTask({ ...newTask, branchId: e.target.value, assignedStaffId: '' })}
                          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
                        >
                          <option value="">Choose branch…</option>
                          {branches.filter((b) => b.status !== 'Inactive').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                        </select>
                        <span style={{ fontSize: '12px', color: '#8e8e93' }}>The file number is created from this branch, e.g. GCR/{branchById(newTask.branchId)?.code || 'KDP'}/…</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Borrower / Client Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter borrower name"
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    value={newTask.borrowerName}
                    onChange={e => setNewTask({...newTask, borrowerName: e.target.value})}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Bank / Lending Institution <span style={{ fontWeight: '400', color: '#64748b' }}>(Optional — Can Assign Later)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="Search or type bank name (or leave empty to assign later)..."
                      value={newTask.bankName}
                      onChange={e => {
                        setNewTask({...newTask, bankName: e.target.value});
                        setShowBankDropdown(true);
                      }}
                      onFocus={() => setShowBankDropdown(true)}
                      onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                    />
                    <ChevronDown size={18} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                  
                  {showBankDropdown && (filteredBanks.length > 0 || newTask.bankName.trim() !== '') && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50,
                      maxHeight: '180px', overflowY: 'auto'
                    }}>
                      {filteredBanks.map(bank => (
                        <div 
                          key={bank}
                          onClick={() => {
                            setNewTask({...newTask, bankName: bank});
                            setShowBankDropdown(false);
                          }}
                          onMouseDown={(e) => e.preventDefault()} 
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px', fontWeight: '500', color: '#0f172a'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {bank}
                        </div>
                      ))}

                      {newTask.bankName.trim() !== '' && filteredBanks.length === 0 && (
                        <div style={{ margin: '8px', padding: '10px', fontSize: '12.5px', color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                          “{newTask.bankName.trim()}” isn’t in the bank list.{superAdmin ? ' Add it in Settings → Banks.' : ' Ask the Super Admin to add it.'}
                        </div>
                      )}
                    </div>
                  )}
                  {pickedBank && !showBankDropdown && (
                    <span style={{ fontSize: '12px', color: '#248a3d', fontWeight: 600 }}>
                      ✓ {pickedBank.format === 'standard' ? 'Report: standard Gouru format (this bank’s own format isn’t added yet)' : `Report: ${pickedBank.shortName || pickedBank.name}’s own format`}
                    </span>
                  )}
                  {newTask.bankName.trim() && !pickedBank && !showBankDropdown && (
                    <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600 }}>Pick a bank from the list</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Mobile Number *</label>
                  <input 
                    type="tel" 
                    required
                    maxLength="10"
                    pattern="[0-9]{10}"
                    title="Please enter exactly 10 digits"
                    placeholder="Enter 10-digit mobile number"
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    value={newTask.mobileNumber}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, ''); // strip non-digits
                      setNewTask({...newTask, mobileNumber: val});
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Property Address *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Search property address..."
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    value={newTask.address}
                    onChange={e => {
                      setNewTask({...newTask, address: e.target.value});
                      setShowAddressDropdown(true);
                    }}
                    onFocus={() => setShowAddressDropdown(true)}
                    onBlur={() => setTimeout(() => setShowAddressDropdown(false), 200)}
                  />
                  {showAddressDropdown && (newTask.address.length > 0) && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 60,
                      maxHeight: '200px', overflowY: 'auto'
                    }}>
                      {/* Show Recent Addresses */}
                      {recentAddresses.filter(r => r.toLowerCase().includes(newTask.address.toLowerCase())).map((recent, idx) => (
                        <div 
                          key={`recent-${idx}`}
                          onClick={() => {
                            setNewTask({...newTask, address: recent});
                            saveRecentAddress(recent);
                            setShowAddressDropdown(false);
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px', color: '#0f172a', lineHeight: '1.4', backgroundColor: '#fafafa'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                        >
                          <MapPin size={12} style={{ display: 'inline', marginRight: '6px', color: '#10b981' }} />
                          <span style={{ fontWeight: '600', color: '#10b981' }}>[Recent]</span> {recent}
                        </div>
                      ))}
                      
                      {/* Show New Suggestions */}
                      {addressSuggestions.filter(s => !recentAddresses.includes(s.display_name)).map((suggestion, idx) => (
                        <div 
                          key={suggestion.place_id || idx}
                          onClick={() => {
                            setNewTask({...newTask, address: suggestion.display_name});
                            saveRecentAddress(suggestion.display_name);
                            setShowAddressDropdown(false);
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px', color: '#0f172a', lineHeight: '1.4'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <MapPin size={12} style={{ display: 'inline', marginRight: '6px', color: '#64748b' }} />
                          {suggestion.display_name}
                        </div>
                      ))}

                      {/* Custom Address Fallback */}
                      {addressSuggestions.length === 0 && !recentAddresses.some(r => r.toLowerCase().includes(newTask.address.toLowerCase())) && (
                        <div 
                          onClick={() => {
                            saveRecentAddress(newTask.address);
                            setShowAddressDropdown(false);
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          style={{ 
                            margin: '8px', padding: '10px', fontSize: '13px', color: '#0346c8', 
                            fontWeight: '700', cursor: 'pointer', textAlign: 'center', 
                            backgroundColor: '#eff6ff', borderRadius: '6px', 
                            border: '1px dashed #93c5fd', transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                        >
                          + Use "{newTask.address}" as custom address
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Inspection Date *</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                      value={newTask.date}
                      onChange={e => setNewTask({...newTask, date: e.target.value})}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Inspection Time *</label>
                    <input 
                      type="time" 
                      required
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                      value={newTask.time}
                      onChange={e => setNewTask({...newTask, time: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Task Note / Instructions</label>
                  <textarea 
                    rows="3"
                    placeholder="Enter any specific instructions for the staff..."
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
                    value={newTask.note}
                    onChange={e => setNewTask({...newTask, note: e.target.value})}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Assign to Staff
                  </label>
                  
                  <select
                    value={newTask.assignedStaffId || ''}
                    onChange={(e) => setNewTask({...newTask, assignedStaffId: e.target.value})}
                    style={{ 
                      width: '100%',
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      border: '2px solid #0346c8', 
                      backgroundColor: '#f8fafc',
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: newTask.assignedStaffId ? '#0f172a' : '#64748b',
                      outline: 'none',
                      appearance: 'auto'
                    }}
                  >
                    <option value="">-- Select Staff Member (Optional) --</option>
                    {engineersFor(newTask.branchId).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="admin-btn-primary" 
                  style={{ width: '100%', background: '#0346c8', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '16px' }}
                  disabled={processingId === 'creating'}
                >
                  {processingId === 'creating' ? <Loader2 size={16} className="spin" /> : (
                    newTask.id 
                      ? (newTask.assignedStaffId ? 'Update & Assign Task' : 'Update Task Details') 
                      : 'Assign Task to Staff'
                  )}
                </button>
                  </form>
                </div>
              ) : (
                <div className="cs-list">
                  {newTasks.length === 0
                    ? emptyState('NEW')
                    : newTasks.map(c => renderCaseCard(c, 'NEW'))}
                </div>
              )}
            </>
          )}

          {/* Other workflow tabs share one card design */}
          {activeTab !== 'NEW' && (
            <div className="cs-list">
              {byTab[activeTab].length === 0
                ? emptyState(activeTab)
                : byTab[activeTab].map(c => renderCaseCard(c, activeTab))}
            </div>
          )}

        </div>
      )}

      {/* Return for Corrections Modal (Defect 02) */}
      {returnModalOpen && returningCase && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#fff1f2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c' }}>
                <AlertTriangle size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Return Case #{returningCase.id} for Revision
                </h3>
              </div>
              <button 
                onClick={() => setReturnModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                Please specify the detailed technical corrections, missing documents, or boundary discrepancies the field engineer ({returningCase.assignedEngineerName}) must rectify before report approval:
              </p>

              <textarea 
                rows="4"
                placeholder="Enter clear, actionable correction instructions..."
                value={correctionComment}
                onChange={e => setCorrectionComment(e.target.value)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  onClick={() => setReturnModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    background: '#f8fafc', color: '#475569', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!correctionComment.trim()) {
                      toast.error("A correction comment is required.");
                      return;
                    }
                    setProcessingId(returningCase.id);
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/cases/${returningCase.id}/return`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ comment: correctionComment.trim() })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to return case');
                      toast.success(`Case #${returningCase.id} returned for revision!`);
                      setReturnModalOpen(false);
                      setReturningCase(null);
                      setCorrectionComment('');
                      fetchData();
                    } catch (err) {
                      toast.error(err.message || 'Failed to return case');
                    } finally {
                      setProcessingId(null);
                    }
                  }}
                  disabled={processingId === returningCase.id}
                  style={{
                    padding: '8px 18px', borderRadius: '6px', border: 'none',
                    background: '#e11d48', color: '#ffffff', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  {processingId === returningCase.id ? <Loader2 size={16} className="spin" /> : 'Confirm & Return to Engineer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal (Defect 03) */}
      {versionModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '640px',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0346c8' }}>
                <History size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Immutable Report Version History — Case #{versionCaseId}
                </h3>
              </div>
              <button 
                onClick={() => setVersionModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {loadingVersions ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  <Loader2 size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Loading immutable version snapshots...</div>
                </div>
              ) : caseVersions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No submission snapshots recorded yet. Versions are immutably archived upon engineer submission.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {caseVersions.map((v) => (
                    <div key={v._id || v.version} style={{
                      border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px',
                      backgroundColor: v.adminDecision === 'Approved' ? '#f0fdf4' : (v.adminDecision === 'Returned' ? '#fff1f2' : '#ffffff')
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span style={{
                            display: 'inline-block', backgroundColor: '#0346c8', color: '#fff',
                            fontWeight: '700', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', marginRight: '8px'
                          }}>
                            VERSION {v.version}
                          </span>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>
                            Submitted {new Date(v.submittedAt).toLocaleString()} by <strong>{v.submittedByName || v.submittedBy}</strong>
                          </span>
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                          backgroundColor: v.adminDecision === 'Approved' ? '#dcfce7' : (v.adminDecision === 'Returned' ? '#ffe4e6' : '#fef3c7'),
                          color: v.adminDecision === 'Approved' ? '#15803d' : (v.adminDecision === 'Returned' ? '#be123c' : '#b45309')
                        }}>
                          {v.adminDecision === 'Approved' ? '✓ Approved' : (v.adminDecision === 'Returned' ? '↺ Returned for Revision' : '⏳ Pending Review')}
                        </span>
                      </div>

                      {v.decisionComment && (
                        <div style={{ fontSize: '13px', color: '#881337', backgroundColor: '#ffe4e6', padding: '8px 12px', borderRadius: '6px', margin: '8px 0' }}>
                          <strong>Return Comment:</strong> {v.decisionComment}
                          {v.decisionBy && <span style={{ display: 'block', fontSize: '11px', color: '#9f1239', marginTop: '2px' }}>By {v.decisionBy} on {new Date(v.decisionAt).toLocaleString()}</span>}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: '12px', color: '#334155' }}>
                          FMV: <strong>₹{(v.valuationSummary?.fairMarketValue || 0).toLocaleString('en-IN')}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => window.open(`${API_BASE_URL}/api/cases/${versionCaseId}/report?format=docx&version=${v.version}`, '_blank')}
                            style={{
                              background: '#eff6ff', color: '#0346c8', border: '1px solid #bfdbfe',
                              borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Download size={12} /> DOCX (v{v.version})
                          </button>
                          <button
                            onClick={() => window.open(`${API_BASE_URL}/api/cases/${versionCaseId}/report?format=pdf&version=${v.version}`, '_blank')}
                            style={{
                              background: '#eff6ff', color: '#0346c8', border: '1px solid #bfdbfe',
                              borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Download size={12} /> PDF (v{v.version})
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setVersionModalOpen(false)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {trackingCaseId && (
        <LiveTrackingMap 
          caseId={trackingCaseId} 
          onClose={() => setTrackingCaseId(null)} 
        />
      )}

      {/* The exact bank-format report the engineer prepared — what admins review and approve */}
      {viewing && (
        <ReportViewer
          title={viewing.clientName || 'Valuation Report'}
          subtitle={[viewing.fileNumber || `#${viewing.id}`, viewing.bankName].filter(Boolean).join(' · ')}
          fileName={`${(viewing.bankName || 'Valuation').replace(/[^a-zA-Z0-9]+/g, '_')}_${String(viewing.fileNumber || viewing.id).replace(/[^a-zA-Z0-9]+/g, '-')}.docx`}
          load={() => fetchReport(`${API_BASE_URL}/api/cases/${viewing.id}/report?format=docx`)}
          onClose={() => setViewing(null)}
          footer={viewing.status === 'Reviewing' ? (
            <>
              <button className="cs-btn cs-return" onClick={() => { const c = viewing; setViewing(null); setReturningCase(c); setCorrectionComment(''); setReturnModalOpen(true); }}>
                <RotateCcw size={15} /> Return
              </button>
              <button className="cs-btn cs-approve" onClick={async () => { const id = viewing.id; await handleApprove(id); setViewing(null); }}>
                <CheckCircle2 size={16} /> Approve
              </button>
            </>
          ) : null}
        />
      )}
    </div>
  );
}
