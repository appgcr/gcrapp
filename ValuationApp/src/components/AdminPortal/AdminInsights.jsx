import React, { useMemo } from 'react';
import { ChevronRight, AlertTriangle, Hourglass, RotateCcw, Inbox, Users, Landmark, CheckCircle2 } from 'lucide-react';
import IconTile from '../Shared/IconTile';
import { STAGES as SHARED_STAGES, stageOf } from '../Shared/caseStages';

// Admin operations statistics. Every number is computed from live data:
// /api/cases (passed in), /api/users (passed in) and today's /api/attendance.

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const isUnassigned = (c) => !c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED';
const isClosed = (c) => c.status === 'Approved' || c.status === 'Rejected';

// Stage colours are shared and validated (see Shared/caseStages.js)
const STAGES = SHARED_STAGES.map((st) => ({ key: st.key, label: st.label, color: st.light }));

const ageText = (ms) => {
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const hrs = Math.floor(ms / HOUR);
  if (hrs < 1) {
    const mins = Math.max(1, Math.round(ms / 60000));
    return `${mins} min`;
  }
  return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
};

// `only` shows a single section: 'pipeline' | 'attention' | 'workload' | 'banks' (default: all)
export default function AdminInsights({ cases = [], users = [], onNavigate, only }) {
  const data = useMemo(() => {
    const now = Date.now();
    const engineers = users.filter((u) => u.role === 'ENGINEER');

    const stageCounts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
    cases.forEach((c) => { stageCounts[stageOf(c)] += 1; });

    const created = (c) => {
      const t = new Date(c.createdAt).getTime();
      return Number.isNaN(t) ? null : t;
    };
    const open = cases.filter((c) => !isClosed(c));
    const unassignedOver24h = open.filter((c) => isUnassigned(c) && created(c) !== null && now - created(c) > DAY);
    const openOver7d = open.filter((c) => created(c) !== null && now - created(c) > 7 * DAY);
    const awaitingReview = cases.filter((c) => stageOf(c) === 'review');
    const returned = cases.filter((c) => stageOf(c) === 'returned');

    const openAges = open.map(created).filter((t) => t !== null).map((t) => now - t);
    const avgOpenAge = openAges.length ? openAges.reduce((a, b) => a + b, 0) / openAges.length : null;
    const oldest = open
      .filter((c) => created(c) !== null)
      .sort((a, b) => created(a) - created(b))[0] || null;

    // Engineer workload
    const workload = engineers.map((e) => {
      const mine = cases.filter((c) => c.assignedEngineerId === e.id || c.assignedEngineerId === e.username);
      return {
        id: e.id,
        name: e.name || e.username || e.id,
        open: mine.filter((c) => !isClosed(c)).length,
        approved: mine.filter((c) => c.status === 'Approved').length,
      };
    }).sort((a, b) => b.open - a.open || b.approved - a.approved);

    // Banks
    const bankMap = new Map();
    cases.forEach((c) => {
      const bank = (c.bankName || '').trim() || 'Bank not set';
      const branch = (c.bankBranch || '').trim();
      const key = `${bank}|${branch}`;
      const row = bankMap.get(key) || { bank, branch, count: 0 };
      row.count += 1;
      bankMap.set(key, row);
    });
    const banks = [...bankMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      engineers, stageCounts, unassignedOver24h, openOver7d, awaitingReview, returned,
      avgOpenAge, oldest, openCount: open.length, workload, banks,
    };
  }, [cases, users]);

  const total = cases.length;
  const go = (tab, filter) => onNavigate && onNavigate(tab, filter);

  const attention = [
    { key: 'u24', icon: Inbox, color: 'red', title: 'Unassigned over 24 hrs', sub: 'Waiting for a valuer', count: data.unassignedOver24h.length, onClick: () => go('cases', '') },
    { key: 'rev', icon: Hourglass, color: 'orange', title: 'Awaiting your review', sub: 'Submitted by engineers', count: data.awaitingReview.length, onClick: () => go('cases', 'Pending') },
    { key: 'ret', icon: RotateCcw, color: 'purple', title: 'Returned for corrections', sub: 'Sent back to engineers', count: data.returned.length, onClick: () => go('cases', 'Returned') },
    { key: 'old', icon: AlertTriangle, color: 'pink', title: 'Open over 7 days', sub: 'Not yet approved or rejected', count: data.openOver7d.length, onClick: () => go('cases', '') },
  ];

  const show = (k) => !only || only === k;
  const visibleAttention = only === 'attention' ? attention.filter((a) => a.count > 0) : attention;

  return (
    <div className={`ai-wrap ${only ? 'ai-single' : ''}`}>
      {show('pipeline') && (
        <>
      {/* Pipeline */}
      <section className="admin-card ai-card">
        <div className="ai-head">
          <h3>Case Pipeline</h3>
          <span className="ai-muted">{total} total</span>
        </div>
        {total === 0 ? (
          <div className="ai-empty">No cases yet.</div>
        ) : (
          <>
            <div className="ai-bar" role="img" aria-label={STAGES.map((s) => `${s.label} ${data.stageCounts[s.key]}`).join(', ')}>
              {STAGES.filter((s) => data.stageCounts[s.key] > 0).map((s) => (
                <span key={s.key} style={{ flexGrow: data.stageCounts[s.key], background: s.color }} title={`${s.label}: ${data.stageCounts[s.key]}`} />
              ))}
            </div>
            <div className="ai-legend">
              {STAGES.map((s) => (
                <div key={s.key} className={`ai-legend-item ${data.stageCounts[s.key] === 0 ? 'is-zero' : ''}`}>
                  <span className="ai-dot" style={{ background: s.color }} />
                  <span className="ai-legend-label">{s.label}</span>
                  <strong>{data.stageCounts[s.key]}</strong>
                </div>
              ))}
            </div>
            <div className="ai-footnote">
              {data.avgOpenAge !== null ? <>Open cases are {ageText(data.avgOpenAge)} old on average</> : 'No open cases'}
              {data.oldest && <> · oldest: {data.oldest.clientName || data.oldest.id} ({ageText(Date.now() - new Date(data.oldest.createdAt).getTime())})</>}
            </div>
          </>
        )}
      </section>
        </>
      )}

      {show('attention') && (
        <>
      {/* Needs attention */}
      <section className="admin-card ai-card ai-list-card">
        <div className="ai-head"><h3>Needs Attention</h3></div>
        <div className="ai-list">
          {visibleAttention.length === 0 && (
            <div className="ai-row ai-clear-row">
              <IconTile icon={CheckCircle2} color="green" size={30} />
              <div className="ai-row-text">
                <div className="ai-row-title">All caught up</div>
                <div className="ai-row-sub">Nothing is waiting on you right now</div>
              </div>
            </div>
          )}
          {visibleAttention.map((a) => (
            <button
              key={a.key}
              className={`ai-row ${a.count === 0 ? 'is-clear' : ''}`}
              onClick={a.count > 0 ? a.onClick : undefined}
              disabled={a.count === 0}
              aria-label={a.count > 0 ? `${a.title}: ${a.count}. Open` : `${a.title}: all clear`}
            >
              <IconTile icon={a.icon} color={a.count === 0 ? 'gray' : a.color} size={30} />
              <div className="ai-row-text">
                <div className="ai-row-title">{a.title}</div>
                <div className="ai-row-sub">{a.count === 0 ? 'All clear' : a.sub}</div>
              </div>
              <span className={`ai-count ${a.count === 0 ? 'zero' : ''}`}>{a.count}</span>
              {a.count > 0 && <ChevronRight size={18} className="ai-chev" />}
            </button>
          ))}
        </div>
      </section>
        </>
      )}

      {show('workload') && (
        <>
      {/* Engineer workload */}
      <section className="admin-card ai-card ai-list-card">
        <div className="ai-head">
          <h3>Engineer Workload</h3>
          <span className="ai-muted">open · approved</span>
        </div>
        {data.workload.length === 0 ? (
          <div className="ai-empty"><Users size={16} /> No engineers added yet.</div>
        ) : (
          <div className="ai-list">
            <div className="ai-table-head"><span>Engineer</span><span>Open</span><span>Approved</span></div>
            {data.workload.map((w) => (
              <div key={w.id} className="ai-table-row">
                <span className="ai-name">{w.name}</span>
                <span className={`ai-pill ${w.open === 0 ? 'zero' : 'blue'}`}>{w.open}</span>
                <span className={`ai-pill ${w.approved === 0 ? 'zero' : 'green'}`}>{w.approved}</span>
              </div>
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {show('banks') && (
        <>
      {/* Banks */}
      <section className="admin-card ai-card ai-list-card ai-span">
        <div className="ai-head">
          <h3>Top Banks</h3>
          <span className="ai-muted">by number of cases</span>
        </div>
        {data.banks.length === 0 ? (
          <div className="ai-empty">No cases yet.</div>
        ) : (
          <div className="ai-list">
            {data.banks.map((b) => (
              <div key={`${b.bank}|${b.branch}`} className="ai-bank">
                <IconTile icon={Landmark} color="indigo" size={30} />
                <div className="ai-row-text">
                  <div className="ai-row-title">{b.bank}</div>
                  {b.branch && <div className="ai-row-sub">{b.branch}</div>}
                  <div className="ai-bank-bar"><span style={{ width: `${Math.round((b.count / data.banks[0].count) * 100)}%` }} /></div>
                </div>
                <span className="ai-count">{b.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
        </>
      )}

      <style>{`
        .ai-wrap { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        @media (min-width: 900px) {
          .ai-wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ai-span { grid-column: 1 / -1; }
          .ai-wrap.ai-single { grid-template-columns: minmax(0, 1fr); }
        }
        .ai-clear-row { cursor: default; }
        .ai-card { margin: 0 !important; }
        .ai-list-card { padding-bottom: 6px !important; }
        .ai-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 12px; }
        .ai-head h3 { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; margin: 0; color: var(--gcr-label); }
        .ai-muted { font-size: 13px; color: var(--gcr-label-3); }
        .ai-link { background: none; border: none; padding: 0; font: inherit; font-size: 15px; font-weight: 500; color: var(--gcr-accent); cursor: pointer; }
        .ai-empty { display: flex; align-items: center; gap: 6px; padding: 18px 0; font-size: 13px; color: #8e8e93; }

        .ai-bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; background: #f2f2f7; }
        .ai-bar span { min-width: 6px; }
        .ai-legend { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 8px; margin-top: 14px; }
        @media (max-width: 480px) { .ai-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; } }
        .ai-legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #3c3c43; min-width: 0; }
        .ai-legend-item strong { margin-left: auto; font-size: 14px; color: #0f172a; font-variant-numeric: tabular-nums; padding-right: 6px; }
        .ai-legend-item.is-zero { opacity: 0.45; }
        .ai-legend-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ai-footnote { margin-top: 14px; padding-top: 12px; border-top: 0.5px solid rgba(60,60,67,0.18); font-size: 12px; color: #6d6d72; line-height: 1.45; }

        .ai-list { margin: 0 -16px; }
        .ai-row, .ai-bank {
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 16px;
          background: none; border: none; text-align: left; font: inherit; position: relative;
        }
        .ai-row { cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .ai-row:disabled { cursor: default; }
        .ai-row:disabled:active { background: none; }
        .ai-row:active { background: #f2f2f7; }
        .ai-row + .ai-row::before, .ai-bank + .ai-bank::before {
          content: ''; position: absolute; top: 0; right: 0; left: 58px; border-top: 0.5px solid rgba(60,60,67,0.18);
        }
        .ai-row-text { flex: 1; min-width: 0; }
        .ai-row-title { font-size: 15px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-row-sub { font-size: 12px; color: #8e8e93; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-count { font-size: 17px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
        .ai-count.zero { color: #c7c7cc; font-weight: 600; }
        .ai-chev { color: #c7c7cc; flex-shrink: 0; margin-left: -4px; }

        .ai-att { display: flex; align-items: center; gap: 14px; }
        .ai-att-main { flex: 1; min-width: 0; }
        .ai-att-num strong { font-size: 30px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .ai-att-num span { font-size: 17px; font-weight: 600; color: #8e8e93; }
        .ai-att-side { font-size: 12px; color: #6d6d72; text-align: right; line-height: 1.7; }
        .ai-att-side strong { color: #0f172a; font-size: 14px; }
        .ai-progress { height: 6px; border-radius: 3px; background: #f2f2f7; margin-top: 14px; overflow: hidden; }
        .ai-progress span { display: block; height: 100%; background: #34c759; border-radius: 3px; transition: width .4s ease; }

        .ai-table-head, .ai-table-row {
          display: grid; grid-template-columns: minmax(0, 1fr) 64px 76px; align-items: center; gap: 8px; padding: 9px 16px;
        }
        .ai-table-head { padding-top: 0; font-size: 11px; font-weight: 600; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.3px; }
        .ai-table-head span:not(:first-child), .ai-table-row > span:not(:first-child) { text-align: center; justify-self: center; }
        .ai-table-row { border-top: 0.5px solid rgba(60,60,67,0.18); }
        .ai-name { font-size: 15px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-unassigned .ai-name { color: #8e8e93; }
        .ai-pill { min-width: 30px; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ai-pill.blue { background: rgba(0,122,255,0.12); color: #007aff; }
        .ai-pill.green { background: rgba(52,199,89,0.15); color: #248a3d; }
        .ai-pill.gray { background: rgba(142,142,147,0.15); color: #636366; }
        .ai-pill.zero { color: #c7c7cc; }

        .ai-bank-bar { height: 4px; border-radius: 2px; background: #f2f2f7; margin-top: 6px; overflow: hidden; }
        .ai-bank-bar span { display: block; height: 100%; background: #5856d6; border-radius: 2px; }
      `}</style>
    </div>
  );
}
