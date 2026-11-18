import React from 'react';
import { Check } from 'lucide-react';

/**
 * Progress across the top of the case form: where the engineer is and what is left.
 * Finished steps show a tick and can be tapped to go back; the next steps stay grey.
 */
export const CASE_STEPS = [
  { id: 'setup', short: 'Setup', hint: 'Customer, bank and report type.' },
  { id: 'docs', short: 'Docs', hint: 'Upload the 5 documents — Mahe AI checks each one.' },
  { id: 'check', short: 'Check', hint: 'Check what Mahe AI read from your documents.' },
  { id: 'site', short: 'Site', hint: 'What you see at the site: boundaries, building, extras.' },
  { id: 'photos', short: 'Photos', hint: 'Geo-tagged site photos.' },
  { id: 'sign', short: 'Sign', hint: 'Review the values, sign and submit.' },
];

/** Office sheet route: the filled sheet replaces Docs, Check and Site */
export const SHEET_STEPS = [
  { id: 'setup', short: 'Setup', hint: 'Customer, bank and report type.' },
  { id: 'sheet', short: 'Sheet', hint: 'Upload the filled office sheet and check what Mahe AI read.' },
  { id: 'photos', short: 'Photos', hint: 'Geo-tagged site photos and your selfie at the site.' },
  { id: 'sign', short: 'Sign', hint: 'Review the values, sign and submit.' },
];
export function sheetStepIndex(modalStep) {
  if (modalStep <= 1) return 0;
  if (modalStep === 8) return 1;
  if (modalStep === 4) return 2;
  return 3;
}

/** Internal form position (modalStep 1–7 + Step 3 phase) → stepper index */
export function stepIndex(modalStep, step3Phase) {
  if (modalStep <= 1) return 0;
  if (modalStep === 2) return 1;
  if (modalStep === 3) return step3Phase === 'site' ? 3 : 2;
  if (modalStep === 4) return 4;
  return 5; // 5–7: extraction / review / sign
}

export default function CaseStepper({ current, onGo, steps = CASE_STEPS }) {
  const CASE_STEPS_ = steps;
  const pct = (current / (CASE_STEPS_.length - 1)) * 100;
  return (
    <div className="cst" aria-label={`Step ${current + 1} of ${CASE_STEPS_.length}`}>
      <div className="cst-track">
        <div className="cst-line"><span style={{ width: `${pct}%` }} /></div>
        {CASE_STEPS_.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'next';
          return (
            <button
              key={s.id}
              type="button"
              className={`cst-step ${state}`}
              disabled={state !== 'done'}
              onClick={() => onGo && onGo(i)}
              aria-current={state === 'now' ? 'step' : undefined}
              title={state === 'done' ? `Back to ${s.short}` : s.short}
            >
              <span className="cst-dot">{state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <span className="cst-name">{s.short}</span>
            </button>
          );
        })}
      </div>
      <div className="cst-hint"><b>Step {current + 1} of {CASE_STEPS_.length}</b> · {CASE_STEPS_[current].hint}</div>
      <style>{`
        .cst { flex-shrink: 0; margin: -4px 0 14px; }
        .cst-track { position: relative; display: grid; grid-template-columns: repeat(${CASE_STEPS_.length}, 1fr); }
        .cst-line { position: absolute; top: 13px; left: calc(100% / ${CASE_STEPS_.length * 2}); right: calc(100% / ${CASE_STEPS_.length * 2}); height: 3px; border-radius: 3px; background: #e2e8f0; }
        .cst-line span { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #16a34a, #2563eb); transition: width .45s cubic-bezier(.2,.9,.25,1); }
        .cst-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .cst-step:disabled { cursor: default; }
        .cst-dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12.5px; font-weight: 800; background: #fff; color: #94a3b8; border: 2px solid #e2e8f0; transition: all .25s; }
        .cst-step.done .cst-dot { background: #16a34a; border-color: #16a34a; color: #fff; }
        .cst-step.now .cst-dot { background: #2563eb; border-color: #2563eb; color: #fff; box-shadow: 0 0 0 5px rgba(37,99,235,.16); transform: scale(1.06); }
        .cst-name { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
        .cst-step.done .cst-name { color: #16a34a; }
        .cst-step.now .cst-name { color: #1d4ed8; font-weight: 800; }
        .cst-hint { margin-top: 10px; padding: 8px 12px; border-radius: 10px; background: #f1f5f9; font-size: 12.5px; color: #475569; line-height: 1.35; }
        .cst-hint b { color: #0f172a; }
        body.dark-theme .cst-dot { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .cst-line { background: #3a3a3c; }
        body.dark-theme .cst-hint { background: #1c1c1e; color: #aeaeb2; }
        body.dark-theme .cst-hint b { color: #fff; }
      `}</style>
    </div>
  );
}
