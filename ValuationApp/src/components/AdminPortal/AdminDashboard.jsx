import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect } from 'react';
import DateRangePicker, { toYMD, fromYMD } from '../Shared/DateRangePicker';
import AdminInsights from './AdminInsights';
import DashboardSummary from './DashboardSummary';
import IntakeBreakdown from './IntakeBreakdown';
import { Row, BackBar, IosSettingsStyles } from '../Shared/IosSettings';
import { Layers, BarChart3, FileText, Users, Landmark } from 'lucide-react';

const timeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'date unknown';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Calendar period for the Case Intake chart (local time). Shared by the chart and the breakdowns.
function computeIntakePeriod(filter, customStartDate, customEndDate) {
  const DAY = 24 * 60 * 60 * 1000;
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayIndex = (from, d) => Math.round((startOfDay(d) - startOfDay(from)) / DAY);
  const fmtDay = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const now = new Date();
  const today = startOfDay(now);
  let buckets = []; // { label, start, end }
  let rangeStart;
  let rangeEnd;
  let invalid = false;

  if (filter === 'day') {
    rangeStart = today;
    rangeEnd = addDays(today, 1);
    const hourLabels = ['12am', '4am', '8am', '12pm', '4pm', '8pm'];
    buckets = hourLabels.map((label, i) => {
      const b = new Date(today); b.setHours(i * 4);
      const e = new Date(today); e.setHours(i * 4 + 4);
      return { label, start: b, end: e };
    });
  } else if (filter === '7days') {
    rangeStart = addDays(today, -6);
    rangeEnd = addDays(today, 1);
    for (let i = 0; i < 7; i++) {
      const b = addDays(rangeStart, i);
      buckets.push({
        label: i === 6 ? 'Today' : b.toLocaleDateString('en-IN', { weekday: 'short' }),
        start: b,
        end: addDays(b, 1),
      });
    }
  } else if (filter === '1month') {
    // Last 28 days as four 7-day blocks ending today
    rangeStart = addDays(today, -27);
    rangeEnd = addDays(today, 1);
    for (let i = 0; i < 4; i++) {
      const b = addDays(rangeStart, i * 7);
      buckets.push({ label: `${fmtDay(b)}–${fmtDay(addDays(b, 6))}`, start: b, end: addDays(b, 7) });
    }
  } else if (filter === '6months') {
    const first = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    rangeStart = first;
    rangeEnd = addDays(today, 1);
    for (let i = 0; i < 6; i++) {
      const b = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const e = new Date(first.getFullYear(), first.getMonth() + i + 1, 1);
      buckets.push({ label: b.toLocaleDateString('en-IN', { month: 'short' }), start: b, end: e });
    }
  } else {
    const s0 = fromYMD(customStartDate) || new Date(NaN);
    const e0 = fromYMD(customEndDate) || new Date(NaN);
    if (isNaN(s0) || isNaN(e0) || s0 > e0) {
      invalid = true;
    } else {
      rangeStart = s0;
      rangeEnd = addDays(e0, 1);
      const days = dayIndex(s0, e0) + 1;
      if (days <= 7) {
        for (let i = 0; i < days; i++) {
          const b = addDays(s0, i);
          buckets.push({ label: fmtDay(b), start: b, end: addDays(b, 1) });
        }
      } else {
        const n = 5;
        const size = Math.ceil(days / n);
        for (let i = 0; i < n; i++) {
          const b = addDays(s0, i * size);
          if (b >= rangeEnd) break;
          let e = addDays(b, size);
          if (e > rangeEnd) e = rangeEnd;
          const label = size === 1 ? fmtDay(b) : `${fmtDay(b)}–${fmtDay(addDays(e, -1))}`;
          buckets.push({ label, start: b, end: e });
        }
      }
    }
  }
  return { buckets, rangeStart, rangeEnd, invalid };
}

export default function AdminDashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    completed: 0,
    pending: 0,
    activeStaff: 0,
    newRequests: 0,
    totalCases: 0,
    allCases: []
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('main'); // 'main' | 'pipeline' | 'intake' | 'recent' | 'workload' | 'banks'
  const [trendFilter, setTrendFilter] = useState('7days');
  const todayStr = toYMD(new Date()); // local date, not UTC
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);


  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [casesRes, usersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/cases`),
          fetch(`${API_BASE_URL}/api/users`)
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
          allCases: cases,
          allUsers: users
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

  // iOS-style dashboard: short main page, details open as their own pages
  const cases = stats.allCases || [];
  const users = stats.allUsers || [];
  const openCount = cases.filter(c => c.status !== 'Approved' && c.status !== 'Rejected').length;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const newThisWeek = cases.filter(c => new Date(c.createdAt).getTime() >= weekAgo).length;
  const engineerCount = users.filter(u => u.role === 'ENGINEER').length;
  const bankCount = new Set(cases.map(c => (c.bankName || '').trim()).filter(Boolean)).size;
  const latest = [...cases].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];

  const pageTitles = { pipeline: 'Case Pipeline', intake: 'Case Intake', recent: 'Recent Cases', workload: 'Engineer Workload', banks: 'Top Banks' };
  const goTo = (p) => { setPage(p); document.querySelector('.admin-main-content')?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); };

  if (page !== 'main') {
    return (
      <div className="gcr-dashboard ios-settings ios-subpage ios-dash" key={page}>
        <BackBar label="Dashboard" onBack={() => setPage('main')} title={pageTitles[page]} />
        {page === 'pipeline' && <AdminInsights cases={cases} users={users} onNavigate={onNavigate} only="pipeline" />}
        {page === 'workload' && <AdminInsights cases={cases} users={users} onNavigate={onNavigate} only="workload" />}
        {page === 'banks' && <AdminInsights cases={cases} users={users} onNavigate={onNavigate} only="banks" />}
        {page === 'intake' && (
        <div className="admin-card" style={{ margin: 0 }}>
          <div className="gcr-section-head">
            <div>
              <h3 className="gcr-section-title">Case Intake</h3>
              <p className="gcr-section-sub">New valuation cases received, by date</p>
            </div>
          </div>
        
        {/* iOS-style segmented control: always fits the card width, no sideways scrolling */}
        <div className="gcr-segmented" role="tablist" aria-label="Chart period">
          {[
            { val: 'day', label: 'Today', full: 'Today' },
            { val: '7days', label: '7D', full: 'Last 7 days' },
            { val: '1month', label: '1M', full: 'Last 4 weeks' },
            { val: '6months', label: '6M', full: 'Last 6 months' },
            { val: 'custom', label: 'Custom', full: 'Custom range' },
          ].map(({ val, label, full }) => (
            <button
              key={val}
              role="tab"
              aria-selected={trendFilter === val}
              title={full}
              className={trendFilter === val ? 'active' : ''}
              onClick={() => setTrendFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
        <style>{`
          .gcr-segmented {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 2px;
            padding: 2px;
            margin-bottom: 14px;
            background: #eeeef0;
            border-radius: 9px;
          }
          .gcr-segmented button {
            min-width: 0;
            padding: 7px 2px;
            border: none;
            border-radius: 7px;
            background: transparent;
            color: #3c3c43;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            transition: background 0.18s ease, box-shadow 0.18s ease;
            -webkit-tap-highlight-color: transparent;
          }
          .gcr-segmented button.active {
            background: #ffffff;
            color: #000000;
            font-weight: 600;
            box-shadow: 0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.04);
          }
          .gcr-segmented button:focus-visible { outline: 2px solid #007aff; outline-offset: 1px; }
          @media (max-width: 340px) {
            .gcr-segmented button { font-size: 12px; }
          }
        `}</style>

        {trendFilter === 'custom' && (
          <DateRangePicker
            start={customStartDate}
            end={customEndDate}
            max={todayStr}
            onChange={(st, en) => { setCustomStartDate(st); setCustomEndDate(en); }}
          />
        )}
        
        {(() => {
          // Real data only: every bar counts cases by their createdAt date, using
          // calendar boundaries in the device's local time. Cases without a valid
          // createdAt are skipped instead of being counted as "now".
          const dated = (stats.allCases || [])
            .map((c) => ({ c, d: new Date(c.createdAt) }))
            .filter(({ d }) => !isNaN(d));

          const { buckets, rangeStart, rangeEnd, invalid } = computeIntakePeriod(trendFilter, customStartDate, customEndDate);

          if (invalid) {
            return (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                Start date must be on or before the end date.
              </div>
            );
          }

          const inRange = dated.filter(({ d }) => d >= rangeStart && d < rangeEnd);
          const values = buckets.map(({ start: b, end: e }) => inRange.filter(({ d }) => d >= b && d < e).length);
          const total = inRange.length;
          const approved = inRange.filter(({ c }) => c.status === 'Approved').length;
          const rejected = inRange.filter(({ c }) => c.status === 'Rejected').length;
          const open = total - approved - rejected;
          const maxVal = Math.max(...values, 1);
          const smallLabels = buckets.length > 6 || trendFilter === '1month' || (trendFilter === 'custom' && buckets.length === 5);

          return (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px', fontSize: '13px', color: 'var(--gcr-label-2)', marginBottom: '14px' }}>
                <span><strong style={{ color: '#0f172a' }}>{total}</strong> {total === 1 ? 'case' : 'cases'} received</span>
                <span><strong style={{ color: 'var(--gcr-green)' }}>{approved}</strong> approved</span>
                <span><strong style={{ color: 'var(--gcr-orange)' }}>{open}</strong> in progress</span>
                {rejected > 0 && <span><strong style={{ color: '#b91c1c' }}>{rejected}</strong> rejected</span>}
              </div>

              {total === 0 ? (
                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: '#f8fafc', fontSize: '12px', color: '#64748b' }}>
                  No cases received in this period.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '150px', padding: '18px 0 0 0', borderBottom: '1px solid #e2e8f0', gap: '6px' }}>
                  {values.map((val, idx) => {
                    const heightPct = (val / maxVal) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px', height: '100%', minWidth: 0 }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                          <div
                            title={`${buckets[idx].label}: ${val} ${val === 1 ? 'case' : 'cases'}`}
                            style={{
                              width: '100%',
                              maxWidth: '35px',
                              height: val > 0 ? `${heightPct}%` : '3px',
                              backgroundColor: val > 0 ? 'var(--gcr-accent)' : '#e5e5ea',
                              borderRadius: val > 0 ? '6px 6px 0 0' : '2px',
                              transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'relative'
                            }}
                          >
                            {val > 0 && (
                              <div style={{ position: 'absolute', top: '-18px', width: '100%', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'var(--gcr-label)' }}>
                                {val}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--gcr-label-3)', whiteSpace: smallLabels ? 'normal' : 'nowrap', textAlign: 'center', lineHeight: '1.15', fontWeight: '500', paddingBottom: '4px' }}>
                          {buckets[idx].label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>
        )}
        {page === 'intake' && (() => {
          const period = computeIntakePeriod(trendFilter, customStartDate, customEndDate);
          return <IntakeBreakdown cases={cases} rangeStart={period.rangeStart} rangeEnd={period.rangeEnd} invalid={period.invalid} />;
        })()}
        {page === 'recent' && (
        <div className="admin-card" style={{ margin: 0, padding: '16px 16px 6px' }}>
          <div className="gcr-section-head">
            <div>
              <h3 className="gcr-section-title">Recent Cases</h3>
              <p className="gcr-section-sub">Latest valuation requests</p>
            </div>
          </div>

          {stats.allCases.length === 0 ? (
            <div style={{ padding: '20px 0 26px', color: 'var(--gcr-label-3)', fontSize: '14px' }}>
              No cases yet.
            </div>
          ) : (
            <div className="rc-list">
              {[...stats.allCases]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(c => {
                  const unassigned = !c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED';
                  const badge =
                    c.status === 'Approved' ? { tone: 'green', text: 'Approved', filter: 'Approved' } :
                    c.status === 'Rejected' ? { tone: 'red', text: 'Rejected', filter: '' } :
                    c.status === 'Returned' ? { tone: 'purple', text: 'Returned', filter: '' } :
                    unassigned ? { tone: 'gray', text: 'Unassigned', filter: '' } :
                    (c.status === 'Reviewing' || c.status === 'Completed') ? { tone: 'orange', text: 'In review', filter: 'Pending' } :
                    { tone: 'blue', text: 'In field', filter: 'Pending' };
                  const engineer = c.assignedEngineerName && c.assignedEngineerName !== 'Unknown' ? c.assignedEngineerName : null;
                  return (
                    <div key={c.id} className="rc-row">
                      <div className="rc-main">
                        <div className="rc-title">{c.clientName || `Case #${c.id}`}</div>
                        <div className="rc-sub">
                          {[c.bankName, c.bankBranch].filter(Boolean).join(' · ') || 'Bank not set'}
                        </div>
                        <div className="rc-meta">
                          #{c.id} · {timeAgo(c.createdAt)}{engineer ? ` · ${engineer}` : ''}
                        </div>
                      </div>
                      <div className="rc-side">
                        <span className={`gcr-badge ${badge.tone}`}>{badge.text}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <style>{`
            .rc-list { margin: 0 -16px; }
            .rc-row {
              display: flex; align-items: center; gap: 10px; padding: 11px 16px;
              font-family: var(--gcr-font); position: relative;
            }
            .rc-row + .rc-row::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 0.5px solid var(--gcr-separator); }
            .rc-main { flex: 1; min-width: 0; }
            .rc-title { font-size: 16px; font-weight: 600; color: var(--gcr-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.2px; }
            .rc-sub { font-size: 13px; color: var(--gcr-label-2); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .rc-meta { font-size: 12px; color: var(--gcr-label-3); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
            .rc-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
          `}</style>
        </div>
        )}
        <IosSettingsStyles />
        <DashStyles />
      </div>
    );
  }

  return (
    <div className="animate-fade-in gcr-dashboard ios-settings ios-dash">
      {/* Key numbers (live data) */}
      <DashboardSummary cases={cases} users={users} />

      {/* Only what needs action — or a single "All caught up" row */}
      <AdminInsights cases={cases} users={users} onNavigate={onNavigate} only="attention" />

      <div>
        <div className="ios-section">Insights</div>
        <div className="ios-group">
          <Row icon={Layers} color="indigo" label="Case Pipeline" value={`${openCount} open`} onClick={() => goTo('pipeline')} />
          <Row icon={BarChart3} color="blue" label="Case Intake" value={`${newThisWeek} this week`} onClick={() => goTo('intake')} />
          <Row icon={FileText} color="orange" label="Recent Cases" value={latest ? timeAgo(latest.createdAt) : 'None'} onClick={() => goTo('recent')} />
          <Row icon={Users} color="green" label="Engineer Workload" value={`${engineerCount} ${engineerCount === 1 ? 'engineer' : 'engineers'}`} onClick={() => goTo('workload')} />
          <Row icon={Landmark} color="purple" label="Top Banks" value={`${bankCount} ${bankCount === 1 ? 'bank' : 'banks'}`} onClick={() => goTo('banks')} />
        </div>
      </div>

      <IosSettingsStyles />
      <DashStyles />
    </div>
  );
}

function DashStyles() {
  return (
    <style>{`
      .ios-dash { max-width: 760px; gap: 16px; padding-bottom: 8px; }
      .ios-dash .ios-section { padding-top: 6px; }
      /* Detail pages: the large page title already names the card */
      .ios-dash.ios-subpage .ai-head h3, .ios-dash.ios-subpage .gcr-section-title { display: none; }
      .ios-dash.ios-subpage .gcr-section-sub { margin: 0; }
      .ios-dash.ios-subpage .admin-card { margin: 0 !important; }
      .ios-dash.ios-subpage .ios-large-title { margin-bottom: 4px; }
    `}</style>
  );
}
