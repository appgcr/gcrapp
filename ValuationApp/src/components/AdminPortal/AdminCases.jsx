import React, { useState, useEffect } from 'react';
import { Search, MapPin, FileText, Home, CheckCircle2, ChevronRight, MessageSquare, Loader2, CheckSquare, ChevronDown, Plus, X, Building, Edit2, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import LiveTrackingMap from './LiveTrackingMap';
import { generateDocxReport } from '../../utils/docxGenerator';
import { API_BASE_URL } from '../../config/api';

const FALLBACK_BANKS = [
  "State Bank of India (SBI)", "Punjab National Bank (PNB)", "Bank of Baroda", 
  "Canara Bank", "Union Bank of India", "Bank of India", "Indian Bank", 
  "Central Bank of India", "Indian Overseas Bank", "UCO Bank", "Bank of Maharashtra", 
  "Punjab & Sind Bank", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", 
  "IndusInd Bank", "Yes Bank", "IDFC FIRST Bank", "Federal Bank", "Bandhan Bank",
  "LIC Housing Finance"
];

export default function AdminCases({ defaultFilter = '' }) {
  const [activeTab, setActiveTab] = useState('NEW');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingCaseId, setTrackingCaseId] = useState(null);
  const [availableBanks, setAvailableBanks] = useState(() => {
    const saved = localStorage.getItem('gcr_valuation_custom_banks') || localStorage.getItem('custom_banks');
    const custom = saved ? JSON.parse(saved) : [];
    return Array.from(new Set([...custom, ...FALLBACK_BANKS]));
  });
  
  // New Task Form State
  const [newTask, setNewTask] = useState({
    id: null,
    borrowerName: '',
    bankName: '',
    mobileNumber: '',
    note: '',
    assignedStaffId: '',
    address: '',
    date: '',
    time: ''
  });
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

  const handleSaveCustomBank = async (bankName) => {
    if (!bankName || !bankName.trim()) return;
    const trimmed = bankName.trim();
    try {
      await fetch(`${API_BASE_URL}/api/config/banks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: trimmed })
      });
    } catch (_) {}
    const saved = localStorage.getItem('gcr_valuation_custom_banks');
    const custom = saved ? JSON.parse(saved) : [];
    if (!custom.includes(trimmed)) {
      const updated = [...custom, trimmed];
      localStorage.setItem('gcr_valuation_custom_banks', JSON.stringify(updated));
      setAvailableBanks(prev => Array.from(new Set([...prev, trimmed])));
    }
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

  const [selectedStaffForReview, setSelectedStaffForReview] = useState('');
  const [selectedStaffForCompleted, setSelectedStaffForCompleted] = useState('');
  
  const [systemConfig, setSystemConfig] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [processingId, setProcessingId] = useState(null);

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

      const dbBanks = configData?.banks || [];
      const caseBanks = casesArr.map(c => c.bankName).filter(Boolean);
      const saved = localStorage.getItem('gcr_valuation_custom_banks');
      const custom = saved ? JSON.parse(saved) : [];
      const merged = Array.from(new Set([...dbBanks, ...caseBanks, ...custom, ...FALLBACK_BANKS]));
      setAvailableBanks(merged);

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
    if (defaultFilter === 'Approved') setActiveTab('COMPLETED');
    else if (defaultFilter === 'Pending') setActiveTab('REVIEW');
    else if (defaultFilter === '') setActiveTab('NEW');
  }, [defaultFilter]);

  const handleAssign = async (caseId) => {
    const engineerId = assignments[caseId];
    if (!engineerId) return toast.error("Please select a staff member first.");
    
    const engineer = users.find(u => u.id === engineerId);
    setProcessingId(caseId);

    try {
      // 1. Assign Task
      await fetch(`${API_BASE_URL}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assignedEngineerId: engineer.id, 
          assignedEngineerName: engineer.name,
          status: 'Pending'
        })
      });

      // 2. Send Notification to Staff
      await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser: engineer.id,
          title: 'New Task Assigned',
          message: `Admin has assigned Case #${caseId} to you.`
        })
      });

      toast.success(`Assigned to ${engineer.name}!`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign staff.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    if (!newTask.borrowerName || !newTask.bankName || !newTask.mobileNumber || !newTask.address) {
      toast.error("Please fill all required fields marked with *");
      return;
    }

    setProcessingId('creating');
    try {
      const engineer = users.find(u => u.id === newTask.assignedStaffId);
      
      const payload = {
        clientName: newTask.borrowerName,
        bankName: newTask.bankName,
        clientPhone: newTask.mobileNumber,
        note: newTask.note,
        locationData: newTask.address,
        address: newTask.address,
        inspectionDate: newTask.date,
        inspectionTime: newTask.time
      };

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        createdCase = await res.json();
      } else {
        // Create new case
        res = await fetch(`${API_BASE_URL}/api/cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        createdCase = await res.json();
      }
      
      if (!res.ok) {
        throw new Error(createdCase.error || "Failed to save task");
      }

      // Send Notification to Staff ONLY if newly assigned
      if (engineer) {
        await fetch(`${API_BASE_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUser: engineer.id,
            title: 'New Task Assigned',
            message: `Admin has assigned Case #${createdCase.id || newTask.id} to you.`
          })
        });
      }

      toast.success(newTask.id ? (engineer ? "Task updated and assigned!" : "Task details updated!") : "Task created and assigned successfully!");
      saveRecentAddress(newTask.address);
      setNewTask({ id: null, borrowerName: '', bankName: '', mobileNumber: '', note: '', assignedStaffId: '', address: '', date: '', time: '' });
      setIsCreateFormOpen(false); // Close form on success
      fetchData();
      handleSaveCustomBank(newTask.bankName);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save task.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (caseId, engineerId) => {
    setProcessingId(caseId);
    try {
      // 1. Mark Completed
      await fetch(`${API_BASE_URL}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' })
      });

      // 2. Notify Staff
      await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser: engineerId,
          title: 'Task Approved',
          message: `Admin has reviewed and approved Case #${caseId}.`
        })
      });

      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve task.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredCases = cases.filter(c => {
    if (!searchQuery) return true;
    const sq = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(sq) ||
      (c.clientName && c.clientName.toLowerCase().includes(sq)) ||
      (c.locationData && c.locationData.toLowerCase().includes(sq)) ||
      (c.bankName && c.bankName.toLowerCase().includes(sq))
    );
  });

  const filteredBanks = availableBanks.filter(b => b.toLowerCase().includes(newTask.bankName.toLowerCase()));

  const newTasks = filteredCases.filter(c => 
    c.status !== 'Approved' && (!c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED')
  );
  
  const reviewTasks = filteredCases.filter(c => {
    const isPending = c.status !== 'Approved' && (c.status === 'Pending' || c.status === 'Reviewing') && c.assignedEngineerId && c.assignedEngineerId !== 'UNASSIGNED';
    if (!selectedStaffForReview) return isPending;
    return isPending && c.assignedEngineerId === selectedStaffForReview;
  });

  const completedTasks = filteredCases.filter(c => {
    const isApproved = c.status === 'Approved';
    if (!selectedStaffForCompleted) return isApproved;
    return isApproved && c.assignedEngineerId === selectedStaffForCompleted;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>Cases</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Manage and assign property valuation cases.</p>
      </div>

      <div className="admin-search">
        <Search size={18} />
        <input 
          type="text" 
          placeholder="Search ID or Address..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="admin-tabs">
        <div className={`admin-tab ${activeTab === 'NEW' ? 'active' : ''}`} onClick={() => setActiveTab('NEW')}>NEW TASKS <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', marginLeft: '4px' }}>{newTasks.length}</span></div>
        <div className={`admin-tab ${activeTab === 'REVIEW' ? 'active' : ''}`} onClick={() => setActiveTab('REVIEW')}>TASK REVIEW <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', marginLeft: '4px' }}>{reviewTasks.length}</span></div>
        <div className={`admin-tab ${activeTab === 'COMPLETED' ? 'active' : ''}`} onClick={() => setActiveTab('COMPLETED')}>COMPLETED TASKS</div>
      </div>

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
                      {newTask.id ? `Edit Task #${newTask.id}` : 'Create & Assign New Task'}
                    </h2>
                    <button 
                      onClick={() => {
                        setIsCreateFormOpen(false);
                        setNewTask({ id: null, borrowerName: '', bankName: '', mobileNumber: '', note: '', assignedStaffId: '', address: '', date: '', time: '' });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateNewTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Bank / Institution Name *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      required
                      placeholder="Search or type bank name..."
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

                      {newTask.bankName.trim() !== '' && !filteredBanks.some(b => b.toLowerCase() === newTask.bankName.toLowerCase()) && (
                        <div 
                          onClick={() => {
                            handleSaveCustomBank(newTask.bankName);
                            setShowBankDropdown(false);
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
                          + Use "{newTask.bankName}" as custom bank
                        </div>
                      )}
                    </div>
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Inspection Date *</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                      value={newTask.date}
                      onChange={e => setNewTask({...newTask, date: e.target.value})}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Inspection Time *</label>
                    <input 
                      type="time" 
                      required
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
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
                    {users.map(u => (
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
                <>
                  {newTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <p>No unassigned new tasks.</p>
                      <button 
                        onClick={() => setIsCreateFormOpen(true)}
                        style={{ background: '#0346c8', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', marginTop: '12px', cursor: 'pointer' }}
                      >
                        Create New Task
                      </button>
                    </div>
                  ) : (
                    newTasks.map(c => (
                      <div key={c.id} className="admin-card" style={{ borderTop: `3px solid #3b82f6` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: '#eff6ff', color: '#3b82f6', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileText size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>#{c.id}</div>
                              <div style={{ fontSize: '18px', fontWeight: '700' }}>{c.clientName || c.borrowerName || 'Unknown Client'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <button 
                              onClick={() => {
                                setNewTask({
                                  id: c.id,
                                  borrowerName: c.clientName || c.borrowerName || '',
                                  bankName: c.bankName || '',
                                  mobileNumber: c.clientPhone || c.mobile || '',
                                  note: c.note || '',
                                  address: c.locationData || '',
                                  date: c.inspectionDate || '',
                                  time: c.inspectionTime || '',
                                  assignedStaffId: c.assignedEngineerId === 'UNASSIGNED' ? '' : c.assignedEngineerId
                                });
                                setIsCreateFormOpen(true);
                              }}
                              style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '4px' }}
                              title="Edit Task Details"
                            >
                              <Edit2 size={14} />
                            </button>
                            <div className="activity-badge badge-pending" style={{ height: 'fit-content', background: '#e0e7ff', color: '#4f46e5' }}>Unassigned</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> Location: {c.locationData || c.bankName || 'Unknown'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                          <select
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f8fafc' }}
                            value={assignments[c.id] || ''}
                            onChange={e => setAssignments({ ...assignments, [c.id]: e.target.value })}
                          >
                            <option value="">-- Select Staff Member --</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <button 
                            className="admin-btn-primary" 
                            style={{ width: '100%', background: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            onClick={() => handleAssign(c.id)}
                            disabled={processingId === c.id}
                          >
                            {processingId === c.id ? <Loader2 size={16} className="spin" /> : 'Assign Task'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}

          {/* TASK REVIEW TAB */}
          {activeTab === 'REVIEW' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <select 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #0346c8', fontSize: '13px', fontWeight: '600', color: '#0346c8', backgroundColor: '#f8fafc' }}
                  value={selectedStaffForReview}
                  onChange={(e) => setSelectedStaffForReview(e.target.value)}
                >
                  <option value="">All Staff Members</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {reviewTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No tasks pending review.</div>
              ) : (
                reviewTasks.map((c, i) => {
                  const addressText = c.locationData || c.bankName || 'Unknown Address';
                  return (
                    <div key={c.id} className="admin-card" style={{ borderTop: `3px solid #f59e0b` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#fef3c7', color: '#f59e0b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>#{c.id}</div>
                            <div style={{ fontSize: '18px', fontWeight: '700' }}>{c.clientName || 'Unknown Client'}</div>
                          </div>
                        </div>
                        <div className="activity-badge badge-pending" style={{ height: 'fit-content' }}>Reviewing</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Assigned to: <strong style={{color: '#0f172a'}}>{c.assignedEngineerName}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> Location: {addressText}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="admin-btn-outline" style={{ flex: 1 }}>View Report</button>
                        <button 
                          className="admin-btn-primary" 
                          style={{ flex: 1, background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                          onClick={() => handleApprove(c.id, c.assignedEngineerId)}
                          disabled={processingId === c.id}
                        >
                          {processingId === c.id ? <Loader2 size={16} className="spin" /> : <><CheckSquare size={16}/> Mark Completed</>}
                        </button>
                      </div>
                      
                      {c.trackingStatus === 'active' && (
                        <button 
                          onClick={() => setTrackingCaseId(c.id)}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
                            animation: 'pulse 2s infinite'
                          }}
                        >
                          <Navigation size={18} /> Track Live Map (En Route)
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* COMPLETED TASKS TAB */}
          {activeTab === 'COMPLETED' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <select 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #10b981', fontSize: '13px', fontWeight: '600', color: '#10b981', backgroundColor: '#f8fafc' }}
                  value={selectedStaffForCompleted}
                  onChange={(e) => setSelectedStaffForCompleted(e.target.value)}
                >
                  <option value="">All Staff Members</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {completedTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No completed tasks found.</div>
              ) : (
                completedTasks.map((c, i) => {
                  const addressText = c.locationData || c.bankName || 'Unknown Address';
                  return (
                    <div key={c.id} className="admin-card" style={{ borderTop: `3px solid #10b981` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#dcfce7', color: '#10b981', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>#{c.id}</div>
                            <div style={{ fontSize: '18px', fontWeight: '700' }}>{c.clientName || 'Unknown Client'}</div>
                          </div>
                        </div>
                        <div className="activity-badge badge-approved" style={{ height: 'fit-content' }}>Completed</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Completed by: <strong>{c.assignedEngineerName}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> Location: {addressText}</div>
                      </div>
                      <button 
                        className="admin-btn-outline"
                        onClick={() => generateDocxReport(c, systemConfig)}
                      >
                        Download Final Report
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}

        </div>
      )}

      {/* Floating Add Task Button */}
      <div 
        onClick={() => {
          setActiveTab('NEW');
          setIsCreateFormOpen(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#0346c8',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(3, 70, 200, 0.4)',
          cursor: 'pointer',
          zIndex: 100,
          transition: 'transform 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Plus size={24} />
      </div>

      {trackingCaseId && (
        <LiveTrackingMap 
          caseId={trackingCaseId} 
          onClose={() => setTrackingCaseId(null)} 
        />
      )}
    </div>
  );
}
