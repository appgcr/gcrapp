import React, { useMemo } from 'react';
import { STAGES, stageOf, MAGNITUDE } from '../Shared/caseStages';

// Case Intake → two breakdowns for the SAME period the chart shows:
//   1. "Where these cases are now"  thin segmented bar + list rows (swatch, name, count, share)
//   2. "By bank"                     ranked horizontal bars, one hue, largest first (top 5 + Other)
// Real data only; nothing is shown when the period has no cases.

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export default function IntakeBreakdown({ cases = [], rangeStart, rangeEnd, invalid }) {
  const data = useMemo(() => {
    if (invalid || !rangeStart || !rangeEnd) return null;
    const inRange = cases.filter((c) => {
      const d = new Date(c.createdAt);
      return !Number.isNaN(d.getTime()) && d >= rangeStart && d < rangeEnd;
    });
    const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
    inRange.forEach((c) => { counts[stageOf(c)] += 1; });

    const bankMap = new Map();
    inRange.forEach((c) => {
      const bank = (c.bankName || '').trim() || 'Bank not set';
      bankMap.set(bank, (bankMap.get(bank) || 0) + 1);
    });
    let banks = [...bankMap.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    if (banks.length > 6) {
      const rest = banks.slice(5).reduce((t, b) => t + b.n, 0);
      banks = [...banks.slice(0, 5), { name: 'Other banks', n: rest }];
    }
    return { total: inRange.length, counts, banks };
  }, [cases, rangeStart, rangeEnd, invalid]);

  if (!data || data.total === 0) return null;
  const { total, counts, banks } = data;
  const present = STAGES.filter((s) => counts[s.key] > 0);
  const maxBank = Math.max(...banks.map((b) => b.n), 1);

  return (
    <>
      <section className="admin-card ib-card" aria-labelledby="ib-status-title">
        <h3 id="ib-status-title" className="ib-title">Where these cases are now</h3>
        <p className="ib-sub">{total} {total === 1 ? 'case' : 'cases'} received in this period</p>

        <div className="ib-bar" role="img" aria-label={present.map((s) => `${s.label} ${counts[s.key]}`).join(', ')}>
          {present.map((s) => (
            <span
              key={s.key}
              className="ib-seg"
              style={{ flexGrow: counts[s.key], '--seg': s.light, '--seg-dark': s.dark }}
              title={`${s.label}: ${counts[s.key]} (${pct(counts[s.key], total)}%)`}
            />
          ))}
        </div>

        <ul className="ib-list">
          {STAGES.map((s) => (
            <li key={s.key} className={counts[s.key] === 0 ? 'is-zero' : ''}>
              <span className="ib-swatch" style={{ '--seg': s.light, '--seg-dark': s.dark }} aria-hidden="true" />
              <span className="ib-name">{s.label}</span>
              <span className="ib-count">{counts[s.key]}</span>
              <span className="ib-pct">{pct(counts[s.key], total)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-card ib-card" aria-labelledby="ib-bank-title">
        <h3 id="ib-bank-title" className="ib-title">By bank</h3>
        <p className="ib-sub">Which banks sent these cases</p>
        <ul className="ib-banks">
          {banks.map((b) => (
            <li key={b.name} title={`${b.name}: ${b.n} ${b.n === 1 ? 'case' : 'cases'}`}>
              <div className="ib-bank-row">
                <span className="ib-bank-name">{b.name}</span>
                <span className="ib-count">{b.n}</span>
              </div>
              <div className="ib-track" aria-hidden="true">
                <span style={{ width: `${(b.n / maxBank) * 100}%`, '--seg': MAGNITUDE.light, '--seg-dark': MAGNITUDE.dark }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .ib-card { margin: 0 !important; padding: 16px !important; font-family: var(--gcr-font); }
        .ib-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.3px; color: var(--gcr-label, #000); }
        .ib-sub { margin: 2px 0 14px; font-size: 13px; color: var(--gcr-label-3, #8e8e93); }

        /* Thin segmented bar: 2px surface gaps between parts, rounded outer ends */
        .ib-bar { display: flex; gap: 2px; height: 14px; border-radius: 7px; overflow: hidden; background: #f2f2f7; }
        .ib-seg { min-width: 6px; background: var(--seg); transition: flex-grow 0.4s ease; }
        .ib-seg:hover { filter: brightness(1.08); }

        .ib-list { list-style: none; margin: 12px 0 0; padding: 0; }
        .ib-list li { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 44px; align-items: center; gap: 10px; padding: 8px 0; }
        .ib-list li + li { border-top: 0.5px solid var(--gcr-separator, rgba(60,60,67,0.18)); }
        .ib-list li.is-zero { opacity: 0.45; }
        .ib-swatch { width: 12px; height: 12px; border-radius: 3px; background: var(--seg); }
        .ib-name { font-size: 15px; color: var(--gcr-label, #000); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-count { font-size: 15px; font-weight: 600; color: var(--gcr-label, #000); font-variant-numeric: tabular-nums; }
        .ib-pct { font-size: 13px; color: var(--gcr-label-3, #8e8e93); text-align: right; font-variant-numeric: tabular-nums; }

        /* Ranked bars: one hue, largest first, label above each bar */
        .ib-banks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .ib-bank-row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
        .ib-bank-name { font-size: 15px; color: var(--gcr-label, #000); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-track { height: 8px; border-radius: 4px; background: #f2f2f7; overflow: hidden; }
        .ib-track > span { display: block; height: 100%; border-radius: 4px; background: var(--seg); transition: width 0.4s ease; }

        .dark-theme .ib-seg, .dark-theme .ib-swatch, .dark-theme .ib-track > span { background: var(--seg-dark); }
        .dark-theme .ib-bar, .dark-theme .ib-track { background: #2c2c2e; }
        @media (prefers-reduced-motion: reduce) { .ib-seg, .ib-track > span { transition: none; } }
      `}</style>
    </>
  );
}
