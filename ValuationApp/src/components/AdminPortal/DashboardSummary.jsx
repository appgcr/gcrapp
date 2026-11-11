import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

// One read-only summary card with the four numbers an admin checks first.
// Navigation lives in the tab bar, so these are information only (no taps).
// All values come from live data: /api/cases (passed in), /api/users (passed in)
// and today's /api/attendance.

const DAY = 24 * 3600 * 1000;

export const caseValue = (c) => {
  const v = c.valuation?.realizableValue || c.valuation?.fairMarketValue || parseFloat(c.propertyDetails?.marketValueAmount) || 0;
  return Number.isFinite(v) ? v : 0;
};

// ₹ in Indian short units: 4,50,000 -> ₹4.5 L, 2,30,00,000 -> ₹2.3 Cr
export const formatINRShort = (n) => {
  if (!n) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

const localYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function DashboardSummary({ cases = [], users = [] }) {
  const [attendance, setAttendance] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`${API_BASE_URL}/api/attendance?date=${localYMD(new Date())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => { if (alive) setAttendance(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (alive) setAttendance([]); });
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const m = useMemo(() => {
    const now = Date.now();
    const open = cases.filter((c) => c.status !== 'Approved' && c.status !== 'Rejected');
    const created = cases
      .map((c) => new Date(c.createdAt).getTime())
      .filter((t) => !Number.isNaN(t));
    const newThisWeek = created.filter((t) => now - t <= 7 * DAY).length;
    const newPrevWeek = created.filter((t) => now - t > 7 * DAY && now - t <= 14 * DAY).length;
    const approved = cases.filter((c) => c.status === 'Approved');
    const approvedValue = approved.reduce((sum, c) => sum + caseValue(c), 0);
    return { open: open.length, newThisWeek, newPrevWeek, approvedCount: approved.length, approvedValue };
  }, [cases]);

  const att = useMemo(() => {
    if (!attendance) return null;
    const engineers = users.filter((u) => u.role === 'ENGINEER');
    const ids = new Set(engineers.map((e) => e.id));
    const state = new Map();
    attendance
      .filter((r) => (r.attendanceType === 'Clock-In' || r.attendanceType === 'Clock-Out') && (ids.size === 0 || ids.has(r.userId)))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((r) => {
        const s = state.get(r.userId) || { in: false, last: null };
        if (r.attendanceType === 'Clock-In') s.in = true;
        s.last = r.attendanceType;
        state.set(r.userId, s);
      });
    const vals = [...state.values()];
    return { checkedIn: vals.filter((s) => s.in).length, onDuty: vals.filter((s) => s.last === 'Clock-In').length, total: engineers.length };
  }, [attendance, users]);

  const diff = m.newThisWeek - m.newPrevWeek;
  const items = [
    {
      key: 'open', label: 'Open cases', value: m.open,
      sub: m.open === 0 ? 'Nothing pending' : 'Not yet approved',
    },
    {
      key: 'new', label: 'New this week', value: m.newThisWeek,
      sub: diff === 0 ? 'Same as last week' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs last week`,
      tone: diff > 0 ? 'up' : diff < 0 ? 'down' : '',
    },
    {
      key: 'value', label: 'Approved value', value: formatINRShort(m.approvedValue),
      sub: `${m.approvedCount} approved ${m.approvedCount === 1 ? 'report' : 'reports'}`,
    },
    {
      key: 'att', label: 'Checked in today',
      value: att ? <>{att.checkedIn}<span className="ds-of"> / {att.total}</span></> : '–',
      sub: att ? `${att.onDuty} on duty now` : 'Loading…',
    },
  ];

  return (
    <section className="admin-card ds-card" aria-label="Summary">
      {items.map((it) => (
        <div key={it.key} className="ds-item">
          <span className="ds-label">{it.label}</span>
          <span className="ds-value">{it.value}</span>
          <span className={`ds-sub ${it.tone || ''}`}>{it.sub}</span>
        </div>
      ))}

      <style>{`
        .ds-card {
          margin: 0 !important; padding: 0 !important; overflow: hidden;
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 900px) { .ds-card { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .ds-item {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0;
          padding: 14px 16px 15px; font-family: var(--gcr-font); position: relative;
        }
        /* hairline grid separators */
        .ds-item:nth-child(odd)::after { content: ''; position: absolute; top: 14px; bottom: 14px; right: 0; border-right: 0.5px solid var(--gcr-separator); }
        .ds-item:nth-child(n+3)::before { content: ''; position: absolute; top: 0; left: 16px; right: 16px; border-top: 0.5px solid var(--gcr-separator); }
        @media (min-width: 900px) {
          .ds-item:nth-child(n+3)::before { display: none; }
          .ds-item:not(:last-child)::after { content: ''; position: absolute; top: 14px; bottom: 14px; right: 0; border-right: 0.5px solid var(--gcr-separator); }
        }
        .ds-label { font-size: 13px; font-weight: 500; color: var(--gcr-label-3); }
        .ds-value {
          font-size: 28px; font-weight: 700; letter-spacing: -0.6px; color: var(--gcr-label);
          font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: 2px;
          max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ds-of { font-size: 17px; font-weight: 600; color: var(--gcr-label-3); letter-spacing: 0; }
        .ds-sub { font-size: 12px; color: var(--gcr-label-3); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ds-sub.up { color: var(--gcr-green); font-weight: 600; }
        .ds-sub.down { color: var(--gcr-orange); font-weight: 600; }
      `}</style>
    </section>
  );
}
