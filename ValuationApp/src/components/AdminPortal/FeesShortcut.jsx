import React, { useEffect, useState } from 'react';
import { IndianRupee, ChevronRight, CalendarRange } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

/** Dashboard row: money still due from banks this financial year → opens Fees */
export default function FeesShortcut({ onOpen, onMonthly }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    const now = new Date(Date.now() + 330 * 60000);
    const fy = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    fetch(`${API_BASE_URL}/api/billing?from=${fy}-04-01`).then((r) => (r.ok ? r.json() : null)).then((d) => setT(d && d.totals ? d.totals : null)).catch(() => {});
  }, []);
  if (!t) return null;
  const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  return (
    <>
    <button type="button" className="fsc" onClick={onOpen}>
      <span className="fsc-ic"><IndianRupee size={18} /></span>
      <span className="fsc-t"><b>Fees</b><small>{t.outstanding > 0 ? `${inr(t.outstanding)} due · ${t.unpaid} unpaid` : `${inr(t.received)} received this year`}</small></span>
      <ChevronRight size={18} className="fsc-ch" />
      <style>{`
        .fsc { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin: 0 0 14px; border-radius: 14px; border: 1px solid #eef2f7; background: #fff; cursor: pointer; text-align: left; font-family: inherit; }
        .fsc-ic { width: 34px; height: 34px; border-radius: 10px; background: #16a34a; color: #fff; display: grid; place-items: center; flex-shrink: 0; }
        .fsc-t { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .fsc-t b { font-size: 15px; color: #0f172a; }
        .fsc-t small { font-size: 12.5px; color: #c2410c; font-weight: 600; }
        .fsc-ch { color: #94a3b8; }
        body.dark-theme .fsc { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .fsc-t b { color: #fff; }
      `}</style>
    </button>
    {onMonthly && (
      <button type="button" className="fsc" onClick={onMonthly}>
        <span className="fsc-ic" style={{ background: '#6366f1' }}><CalendarRange size={18} /></span>
        <span className="fsc-t"><b>Monthly report</b><small style={{ color: '#64748b' }}>Work, time taken, engineers, banks, money</small></span>
        <ChevronRight size={18} className="fsc-ch" />
      </button>
    )}
    </>
  );
}
