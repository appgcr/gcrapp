import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, FileText } from 'lucide-react';

export default function EngineerDashboard({ currentUser, onOpenCase }) {
  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Engineer';
  
  const [cases, setCases] = useState([]);
  
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await fetch('https://gcr-9ys1.onrender.com/api/cases');
        if (res.ok) {
          const data = await res.json();
          // Filter cases assigned to this user
          const userCases = data.filter(c => c.assignedEngineerId === currentUser?.id || c.assignedEngineerName === currentUser?.name);
          setCases(userCases);
        }
      } catch (err) {
        console.error("Failed to fetch cases for dashboard", err);
      }
    };
    fetchCases();
  }, [currentUser]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greeting = getGreeting();
  
  const activeCases = cases.filter(c => c.status !== 'Approved' && c.status !== 'Completed').length;
  const pendingInspections = cases.filter(c => c.status === 'Pending').length;
  const reportsReview = cases.filter(c => c.status === 'Completed').length; // Waiting admin review
  const completedCases = cases.filter(c => c.status === 'Approved').length;

  const upcomingCases = cases.filter(c => c.status === 'Pending').slice(0, 2);

  return (
    <div className="dashboard-view animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{greeting}, {firstName}</h1>
        <p className="text-muted" style={{ fontSize: '14px' }}>Here is your daily valuation overview.</p>
      </div>

      {/* 2x2 Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
        <div className="native-card" style={{ marginBottom: 0, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Active Cases</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{activeCases}</div>
        </div>
        <div className="native-card" style={{ marginBottom: 0, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Pending Inspections</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{pendingInspections}</div>
        </div>
        <div className="native-card" style={{ marginBottom: 0, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Reports Review</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{reportsReview}</div>
        </div>
        <div className="native-card" style={{ marginBottom: 0, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Completed</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{completedCases}</div>
        </div>
      </div>

      {/* Upcoming Inspections */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Upcoming Inspections</h3>
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', cursor: 'pointer' }}>View All</span>
      </div>

      {upcomingCases.length === 0 ? (
        <div className="native-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No upcoming inspections pending.
        </div>
      ) : (
        upcomingCases.map((c, idx) => (
          <div key={c._id || c.id} className="native-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{c.borrowerName || c.clientName || 'Unknown Client'}</div>
              <span className="badge badge-gray" style={{ fontSize: '11px' }}>{c.caseId || c.id}</span>
            </div>
            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '8px' }}>
              {c.bankName || 'Bank'} • {c.clientPhone || c.mobile || 'No Mobile'}
            </p>
            <p style={{ fontSize: '13px', marginBottom: '8px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} color="#0346c8"/> {c.locationData && c.locationData !== 'Fetching location...' ? c.locationData : 'Address pending'}
            </p>
            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              {c.inspectionDate ? `${new Date(c.inspectionDate).toLocaleDateString()} at ${c.inspectionTime || 'TBD'}` : 'Schedule pending'} • Valuation
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => onOpenCase(c.caseId || c.id)} 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '40px' }}
              >
                <FileText size={16} />
                Open File
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  const isValid = (val) => val && !['fetching location...', 'address pending', 'to be updated', 'unknown bank', 'bank'].includes(val.trim().toLowerCase());
                  const addr = isValid(c.locationData) ? c.locationData : (isValid(c.bankName) ? c.bankName : null);
                  
                  if (addr) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
                  } else {
                    alert('No valid address or bank provided for this task. Please ask Admin to update the details.');
                  }
                }}
                style={{ flex: 1, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '40px' }}
              >
                <Navigation size={16} />
                Start GPS
              </button>
            </div>
          </div>
        ))
      )}

      {/* Recent Activity */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', marginTop: '32px' }}>Recent Activity</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {cases.slice(0, 5).map((c, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: c.status === 'Completed' ? 'var(--primary)' : 'var(--border-color)', borderRadius: '50%', marginTop: '6px' }}></div>
              {idx !== Math.min(cases.length, 5) - 1 && (
                <div style={{ width: '2px', height: '40px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
              )}
            </div>
            <div style={{ paddingBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                {c.status === 'Completed' || c.status === 'Approved' ? 'Report Submitted' : 'Inspection Scheduled'}
              </div>
              <div className="text-muted" style={{ fontSize: '13px' }}>
                {c.caseId || c.id} • {new Date(c.createdAt || c.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
        {cases.length === 0 && (
          <div className="text-muted" style={{ fontSize: '13px', textAlign: 'center' }}>No recent activity.</div>
        )}
      </div>
    </div>
  );
}
