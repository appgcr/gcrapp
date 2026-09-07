import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Users, Mail, TrendingUp, TrendingDown, Info, CheckSquare, Clipboard, AlertCircle, MoreHorizontal, Loader2 } from 'lucide-react';

export default function AdminDashboard({ onViewAll, onNavigate }) {
  const [stats, setStats] = useState({
    completed: 0,
    pending: 0,
    activeStaff: 0,
    newRequests: 0,
    totalCases: 0,
    allCases: []
  });
  const [loading, setLoading] = useState(true);
  const [trendFilter, setTrendFilter] = useState('7days');
  const todayStr = new Date().toISOString().split('T')[0];
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [casesRes, usersRes] = await Promise.all([
          fetch('https://gcr-9ys1.onrender.com/api/cases'),
          fetch('https://gcr-9ys1.onrender.com/api/users')
        ]);
        const cases = await casesRes.json();
        const users = await usersRes.json();

        let completed = 0;
        let pending = 0;
        let newRequests = 0;

        cases.forEach(c => {
          if (c.status === 'Approved') {
            completed++;
          } else if (!c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED') {
            // Unassigned tasks go to "NEW TASKS" tab
            newRequests++;
          } else if (c.status === 'Pending' || c.status === 'Reviewing') {
            // Assigned tasks awaiting review go to "TASK REVIEW" tab
            pending++;
          }
        });

        const activeStaff = users.filter(u => u.role === 'ENGINEER').length;

        setStats({
          completed,
          pending,
          activeStaff,
          newRequests,
          totalCases: cases.length,
          allCases: cases
        });
        setLoading(false);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
      }
    };
    
    // Initial fetch
    fetchDashboardData();
    
    // Set up polling for real-time updates every 10 seconds
    const intervalId = setInterval(fetchDashboardData, 10000);
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const completionPercent = stats.totalCases === 0 ? 0 : Math.round((stats.completed / stats.totalCases) * 100);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="admin-dashboard-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card" style={{ height: '110px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-text" style={{ width: '80px', margin: 0 }}></div>
                <div className="skeleton skeleton-avatar" style={{ width: '24px', height: '24px' }}></div>
              </div>
              <div className="skeleton skeleton-text" style={{ width: '40px', height: '28px', marginTop: '12px' }}></div>
            </div>
          ))}
        </div>
        
        <div className="skeleton-card" style={{ height: '300px' }}>
          <div className="skeleton skeleton-text" style={{ width: '140px', height: '20px' }}></div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-text" style={{ width: '60px', height: '24px', borderRadius: '12px' }}></div>)}
          </div>
          <div className="skeleton" style={{ flex: 1, marginTop: '24px', borderRadius: '8px' }}></div>
        </div>
        
        <div className="skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '60px', height: '16px' }}></div>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div className="skeleton skeleton-avatar"></div>
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '70%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="admin-dashboard-grid">
        <div className="admin-stat-card" onClick={() => onNavigate && onNavigate('cases', 'Approved')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-header">
            <span>COMPLETED</span>
            <div className="badge-icon-green"><CheckCircle2 size={14} /></div>
          </div>
          <div className="admin-stat-value">{stats.completed}</div>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigate && onNavigate('cases', 'Pending')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-header">
            <span>PENDING</span>
            <div className="badge-icon-orange"><Clock size={14} /></div>
          </div>
          <div className="admin-stat-value">{stats.pending}</div>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigate && onNavigate('staff')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-header">
            <span>ACTIVE STAFF</span>
            <div className="badge-icon-blue"><Users size={14} /></div>
          </div>
          <div className="admin-stat-value">{stats.activeStaff}</div>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigate && onNavigate('cases')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-header">
            <span>NEW REQUESTS</span>
            <div className="badge-icon-indigo"><Mail size={14} /></div>
          </div>
          <div className="admin-stat-value">{stats.newRequests}</div>
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Valuation Trends</h3>
        </div>
        
        {/* Horizontal Scrollable Pill Filters */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {['day', '7days', '1month', '6months', 'custom'].map((filterVal) => {
            const labels = {
              'day': 'Today',
              '7days': '7 Days',
              '1month': '1 Month',
              '6months': '6 Months',
              'custom': 'Custom'
            };
            const isActive = trendFilter === filterVal;
            return (
              <button
                key={filterVal}
                onClick={() => setTrendFilter(filterVal)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#0346c8' : '#f8fafc',
                  color: isActive ? 'white' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {labels[filterVal]}
              </button>
            );
          })}
        </div>

        {trendFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>START DATE</label>
              <input 
                type="date" 
                value={customStartDate}
                max={todayStr}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', color: '#0f172a' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>END DATE</label>
              <input 
                type="date" 
                value={customEndDate}
                max={todayStr}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', color: '#0f172a' }}
              />
            </div>
          </div>
        )}
        
        {(() => {
          let labels = [];
          let values = [];
          const now = new Date();
          
          if (trendFilter === 'day') {
            labels = ['8am', '10am', '12pm', '2pm', '4pm', '6pm'];
            values = [0, 0, 0, 0, 0, 0];
            stats.allCases.forEach(c => {
              const d = new Date(c.createdAt || Date.now());
              if (d.toDateString() === now.toDateString()) {
                const hour = d.getHours();
                if (hour < 10) values[0]++;
                else if (hour < 12) values[1]++;
                else if (hour < 14) values[2]++;
                else if (hour < 16) values[3]++;
                else if (hour < 18) values[4]++;
                else values[5]++;
              }
            });
          } else if (trendFilter === '7days') {
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
              values.push(0);
            }
            stats.allCases.forEach(c => {
              const d = new Date(c.createdAt || Date.now());
              const diffTime = Math.abs(now - d);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              if (diffDays <= 7) {
                const index = 6 - (diffDays - 1);
                if (index >= 0 && index < 7) values[index]++;
              }
            });
          } else if (trendFilter === '1month') {
            labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
            values = [0, 0, 0, 0];
            stats.allCases.forEach(c => {
              const d = new Date(c.createdAt || Date.now());
              const diffTime = Math.abs(now - d);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 28) {
                const wk = Math.floor((diffDays - 1) / 7);
                const index = 3 - wk;
                if (index >= 0 && index < 4) values[index]++;
              }
            });
          } else if (trendFilter === '6months') {
            for (let i = 5; i >= 0; i--) {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
              values.push(0);
            }
            stats.allCases.forEach(c => {
              const d = new Date(c.createdAt || Date.now());
              const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
              if (diffMonths >= 0 && diffMonths < 6) {
                const index = 5 - diffMonths;
                values[index]++;
              }
            });
          } else if (trendFilter === 'custom') {
            const start = new Date(customStartDate);
            start.setHours(0,0,0,0);
            const end = new Date(customEndDate);
            end.setHours(23,59,59,999);
            
            if (start > end || isNaN(start) || isNaN(end)) {
              labels = ['Invalid Range'];
              values = [0];
            } else {
              const diffTime = Math.abs(end - start);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays <= 7) {
                // Show each day
                for (let i = 0; i < diffDays; i++) {
                  const d = new Date(start);
                  d.setDate(d.getDate() + i);
                  labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                  values.push(0);
                }
                stats.allCases.forEach(c => {
                  const d = new Date(c.createdAt || Date.now());
                  if (d >= start && d <= end) {
                    const idx = Math.floor((d - start) / (1000 * 60 * 60 * 24));
                    if (idx >= 0 && idx < diffDays) values[idx]++;
                  }
                });
              } else {
                // Split into 5 buckets for larger ranges
                const numBuckets = 5;
                const bucketSize = diffTime / numBuckets;
                for (let i = 0; i < numBuckets; i++) {
                  const bucketStart = new Date(start.getTime() + i * bucketSize);
                  const bucketEnd = new Date(start.getTime() + (i + 1) * bucketSize - 1);
                  labels.push(`${bucketStart.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${bucketEnd.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`);
                  values.push(0);
                }
                stats.allCases.forEach(c => {
                  const d = new Date(c.createdAt || Date.now());
                  if (d >= start && d <= end) {
                    let idx = Math.floor((d - start) / bucketSize);
                    if (idx >= numBuckets) idx = numBuckets - 1;
                    if (idx >= 0 && idx < numBuckets) values[idx]++;
                  }
                });
              }
            }
          }

          const maxVal = Math.max(...values, 1);

          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '10px 0 0 0', borderBottom: '1px solid #e2e8f0', gap: '6px' }}>
              {values.map((val, idx) => {
                const heightPct = (val / maxVal) * 100;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px', height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                      <div 
                        style={{ 
                          width: '100%', 
                          maxWidth: '35px', 
                          height: `${heightPct}%`, 
                          backgroundColor: '#0346c8', 
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative'
                        }} 
                      >
                        <div style={{ position: 'absolute', top: '-18px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: '600', color: '#64748b' }}>
                          {val}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', whiteSpace: trendFilter === 'custom' && labels.length === 5 ? 'normal' : 'nowrap', textAlign: 'center', lineHeight: '1.1', fontWeight: '500' }}>{labels[idx]}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>



      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Recent Activity</h2>
        <button onClick={onViewAll} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: '700', color: '#0346c8', cursor: 'pointer' }}>View All</button>
      </div>

      <div className="admin-card" style={{ padding: '8px 16px' }}>
        {stats.allCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '12px' }}>No recent activity found.</div>
        ) : (
          stats.allCases
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3)
            .map(c => {
              let icon, bgColor, badgeClass, title;
              if (c.status === 'Approved') {
                icon = <CheckSquare size={16} />;
                bgColor = 'badge-icon-green';
                badgeClass = 'badge-approved';
                title = `Case ${c.id} Approved`;
              } else if (c.status === 'Rejected') {
                icon = <AlertCircle size={16} />;
                bgColor = 'badge-icon-error';
                badgeClass = 'badge-error';
                title = `Case ${c.id} Rejected`;
              } else {
                icon = <Clipboard size={16} />;
                bgColor = 'badge-icon-orange';
                badgeClass = 'badge-pending';
                title = `New Form ${c.id} Submitted`;
              }

              return (
                <div key={c.id} className="activity-item">
                  <div className={bgColor} style={c.status === 'Rejected' ? { background: '#fee2e2', color: '#dc2626', padding: '6px', borderRadius: '50%', display: 'flex' } : {}}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{title}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      {(!c.assignedEngineerName || c.assignedEngineerName.toLowerCase() === 'unknown') ? 'Unassigned' : `Assigned to ${c.assignedEngineerName}`}
                    </div>
                  </div>
                  <div className={`activity-badge ${badgeClass}`}>{c.status ? c.status.toUpperCase() : 'PENDING'}</div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
