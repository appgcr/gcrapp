import React, { useState, useEffect } from 'react';
import { Plus, FileText, Search, ChevronRight } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import CaseCreationModal from './CaseModalSteps/CaseCreationModal';

export default function CaseListView({ onOpenCase, currentUser }) {
  const [casesList, setCasesList] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState(null);

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
          title: (c.clientName && c.bankName) ? `${c.clientName} - ${c.bankName}` : (c.clientName || 'Untitled Case'),
          type: c.propertyDetails?.propertyType || 'Standard Appraisal',
          date: new Date(c.createdAt).toLocaleDateString(),
          status: c.status || 'Pending'
        }));
        setCasesList(formatted);
      })
      .catch(err => console.error("Failed to fetch cases:", err));
  }, [currentUser]);

  const filteredCases = casesList.filter(c => 
    (c.title && c.title.toLowerCase().includes(search.toLowerCase())) ||
    (c.id && c.id.toLowerCase().includes(search.toLowerCase()))
  );

  const checkAttendanceClockIn = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      const today = new Date().toLocaleDateString();
      const todayLogs = Array.isArray(data) ? data.filter(log => new Date(log.timestamp).toLocaleDateString() === today) : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('You must Clock-In from the Attendance tab before entering case details.', { duration: 4000 });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to verify attendance status', err);
      toast.error('Failed to verify attendance status. Please try again.');
      return false;
    }
  };

  const handleNewCaseClick = async () => {
    const isClockedIn = await checkAttendanceClockIn();
    if (!isClockedIn) return;
    setEditingCaseId(null);
    setIsModalOpen(true);
  };

  const handleResumeAssignedTask = async (c) => {
    const isClockedIn = await checkAttendanceClockIn();
    if (!isClockedIn) return;
    setEditingCaseId(c.id);
    setIsModalOpen(true);
  };

  return (
    <div className="case-list-view animate-fade-in" style={{ paddingBottom: '80px', position: 'relative', minHeight: 'calc(100vh - 150px)' }}>
      <Toaster position="top-center" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>My Cases</h1>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search by address or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredCases.map((c) => (
          <div 
            key={c.id} 
            className="native-card" 
            style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', margin: 0, gap: '12px' }}
            onClick={() => {
              if (c.status === 'Pending') {
                handleResumeAssignedTask(c);
              } else {
                onOpenCase(c.id);
              }
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px', wordBreak: 'break-word' }}>{c.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {c.id}</span>
                <span>•</span>
                <span style={{ wordBreak: 'break-word' }}>{c.type}</span>
              </div>
            </div>
            <ChevronRight size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: 'calc(64px + 16px)', right: '16px', zIndex: 90 }}>
        <button 
          className="btn-primary" 
          style={{ width: '54px', height: '54px', borderRadius: '27px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,82,204,0.35)' }}
          onClick={handleNewCaseClick}
        >
          <Plus size={24} />
        </button>
      </div>

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
