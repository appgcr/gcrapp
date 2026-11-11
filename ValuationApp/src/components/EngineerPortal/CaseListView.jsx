import React, { useState, useEffect } from 'react';
import { FileText, Search, ChevronRight } from 'lucide-react';
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
          status: c.status || 'Pending'
        }));
        setCasesList(formatted);
      })
      .catch(err => console.error("Failed to fetch cases:", err));
  }, [currentUser]);

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

  const handleResumeAssignedTask = async (c) => {
    const isClockedIn = await checkAttendanceClockIn();
    if (!isClockedIn) return;
    setEditingCaseId(c.id);
    setIsModalOpen(true);
  };

  return (
    <div className="td animate-fade-in" style={{ paddingBottom: 24 }}>
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
                    <div className="td-sub">{c.fileNumber || `#${c.id}`}{c.bank ? ` · ${c.bank}` : ''}</div>
                  </div>
                  <ChevronRight size={18} className="td-chev" />
                </button>
              ))}
            </div>
          </React.Fragment>
        );
      })}

      {/* New cases are created and assigned by the branch admin, so engineers have no "+" here */}
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
