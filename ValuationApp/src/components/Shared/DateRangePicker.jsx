import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// iOS-style inline date range picker (like the Calendar app's event editor).
// Values are local-date strings "YYYY-MM-DD" so there are no timezone shifts.

export const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const fromYMD = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const pretty = (d) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DateRangePicker({ start, end, max, onChange }) {
  const startD = fromYMD(start);
  const endD = fromYMD(end);
  const maxD = fromYMD(max) || new Date();
  const [active, setActive] = useState('start');
  const [view, setView] = useState(() => {
    const base = startD || maxD;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const atMaxMonth = view.getFullYear() === maxD.getFullYear() && view.getMonth() === maxD.getMonth();
  const firstWeekday = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));

  const pick = (d) => {
    if (d > maxD) return;
    if (active === 'start') {
      const newEnd = endD && d > endD ? d : endD || d;
      onChange(toYMD(d), toYMD(newEnd));
      setActive('end');
    } else if (startD && d < startD) {
      onChange(toYMD(d), toYMD(startD));
    } else {
      onChange(toYMD(startD || d), toYMD(d));
    }
  };

  const shiftMonth = (n) => {
    const next = new Date(view.getFullYear(), view.getMonth() + n, 1);
    if (n > 0 && next > maxD) return;
    setView(next);
  };

  const preset = (days) => {
    const e = new Date(maxD);
    const s = new Date(maxD);
    s.setDate(s.getDate() - (days - 1));
    onChange(toYMD(s), toYMD(e));
    setView(new Date(s.getFullYear(), s.getMonth(), 1));
    setActive('start');
  };

  const dayCount = startD && endD ? Math.round((endD - startD) / 86400000) + 1 : 0;

  return (
    <div className="drp">
      {/* From / To rows */}
      <div className="drp-group">
        {[
          { key: 'start', label: 'From', d: startD },
          { key: 'end', label: 'To', d: endD },
        ].map(({ key, label, d }) => (
          <button
            key={key}
            type="button"
            className={`drp-row ${active === key ? 'is-active' : ''}`}
            onClick={() => {
              setActive(key);
              if (d) setView(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            <span className="drp-row-label">{label}</span>
            <span className="drp-chip">{pretty(d)}</span>
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="drp-cal">
        <div className="drp-cal-head">
          <span className="drp-month">{view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          <div className="drp-nav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={22} strokeWidth={2.4} /></button>
            <button type="button" onClick={() => shiftMonth(1)} disabled={atMaxMonth} aria-label="Next month"><ChevronRight size={22} strokeWidth={2.4} /></button>
          </div>
        </div>

        <div className="drp-grid drp-weekdays">
          {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
        </div>

        <div className="drp-grid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const disabled = d > maxD;
            const isStart = sameDay(d, startD);
            const isEnd = sameDay(d, endD);
            const inRange = startD && endD && d > startD && d < endD;
            const bandStart = isStart && endD && !sameDay(startD, endD);
            const bandEnd = isEnd && startD && !sameDay(startD, endD);
            const cls = [
              'drp-day',
              disabled && 'is-disabled',
              (isStart || isEnd) && 'is-selected',
              inRange && 'in-range',
              bandStart && 'band-start',
              bandEnd && 'band-end',
              sameDay(d, maxD) && 'is-today',
            ].filter(Boolean).join(' ');
            return (
              <button
                key={d.getDate()}
                type="button"
                className={cls}
                disabled={disabled}
                onClick={() => pick(d)}
                aria-label={d.toDateString()}
                aria-pressed={isStart || isEnd}
              >
                <span>{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="drp-foot">
          <div className="drp-presets">
            <button type="button" onClick={() => preset(7)}>7 days</button>
            <button type="button" onClick={() => preset(30)}>30 days</button>
            <button type="button" onClick={() => preset(90)}>90 days</button>
          </div>
          <span className="drp-count">{dayCount ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'}` : ''}</span>
        </div>
      </div>

      <style>{`
        .drp { margin-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', sans-serif; }
        .drp-group { background: #f2f2f7; border-radius: 12px; overflow: hidden; }
        .drp-row {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 9px 12px 9px 14px; min-height: 46px; border: none; background: transparent;
          font-family: inherit; cursor: pointer; position: relative; -webkit-tap-highlight-color: transparent;
        }
        .drp-row + .drp-row::before { content: ''; position: absolute; top: 0; left: 14px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.22); }
        .drp-row-label { font-size: 16px; color: #000; }
        .drp-chip {
          font-size: 15px; color: #000; background: rgba(118,118,128,0.12);
          padding: 6px 11px; border-radius: 8px; font-variant-numeric: tabular-nums; transition: color .15s, background .15s;
        }
        .drp-row.is-active .drp-chip { color: #007aff; background: rgba(0,122,255,0.12); }

        .drp-cal { padding: 14px 4px 4px; }
        .drp-cal-head { display: flex; justify-content: space-between; align-items: center; padding: 0 8px 10px; }
        .drp-month { font-size: 17px; font-weight: 600; color: #000; letter-spacing: -0.2px; }
        .drp-nav { display: flex; gap: 14px; }
        .drp-nav button { border: none; background: none; color: #007aff; cursor: pointer; padding: 2px; display: flex; }
        .drp-nav button:disabled { color: #c7c7cc; cursor: default; }

        .drp-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 4px; }
        .drp-weekdays span { text-align: center; font-size: 13px; font-weight: 600; color: rgba(60,60,67,0.3); padding-bottom: 4px; }

        .drp-day {
          position: relative; height: 40px; border: none; background: none; padding: 0;
          font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center;
          -webkit-tap-highlight-color: transparent;
        }
        .drp-day span {
          position: relative; z-index: 1; width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: #000; font-variant-numeric: tabular-nums; transition: background .12s;
        }
        .drp-day:hover:not(:disabled) span { background: rgba(118,118,128,0.12); }
        .drp-day.is-today span { color: #007aff; font-weight: 600; }
        .drp-day.in-range::before, .drp-day.band-start::before, .drp-day.band-end::before {
          content: ''; position: absolute; top: 1px; bottom: 1px; left: 0; right: 0; background: rgba(0,122,255,0.12);
        }
        .drp-day.band-start::before { left: 50%; }
        .drp-day.band-end::before { right: 50%; }
        .drp-day.is-selected span, .drp-day.is-selected:hover span { background: #007aff; color: #fff; font-weight: 600; }
        .drp-day.is-disabled span { color: rgba(60,60,67,0.2); }
        .drp-day.is-disabled { cursor: default; }
        .drp-day:focus-visible span { outline: 2px solid #007aff; outline-offset: 1px; }

        .drp-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 6px 0; flex-wrap: wrap; }
        .drp-presets { display: flex; gap: 6px; }
        .drp-presets button {
          border: none; background: rgba(118,118,128,0.12); color: #007aff; font-family: inherit;
          font-size: 13px; font-weight: 600; padding: 6px 10px; border-radius: 14px; cursor: pointer;
        }
        .drp-presets button:active { background: rgba(118,118,128,0.24); }
        .drp-count { font-size: 13px; color: #8e8e93; }

        @media (max-width: 340px) {
          .drp-day { height: 36px; }
          .drp-day span { width: 34px; height: 34px; font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
