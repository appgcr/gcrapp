import React, { useEffect, useRef, useState } from 'react';

/**
 * Pull down from the top of a screen to refresh (touch screens only), Safari-style:
 * the page slides down with resistance onto a navy background with a handle, the label
 * changes to "Release to refresh", and on release the screen reloads and springs back.
 *
 * props
 *   onRefresh()      — may return a promise; the spinner shows until it settles
 *   scrollSelector   — CSS selector of the element that scrolls (omit when the page itself scrolls)
 *   disabled         — e.g. while a full-screen chat is open
 */
const THRESHOLD = 72;   // px the page must travel before a release refreshes
const MAX = 150;        // furthest the page can be pulled
const HOLD = 60;        // where the page rests while refreshing

// Places where a downward drag means something else (maps, chats, sheets, form fields…)
const SKIP = 'input, textarea, select, [contenteditable="true"], .leaflet-container, .maplibregl-map, [role="dialog"], .fs-sheet, .ch-list, .ch-thread, .ch-messages, [data-no-ptr]';

function scrolledParent(el, stopAt) {
  for (let n = el; n && n !== stopAt && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return n;
  }
  return null;
}

export default function PullToRefresh({ onRefresh, scrollSelector, disabled = false, children }) {
  const [pull, setPull] = useState(0);            // current distance in px
  const [phase, setPhase] = useState('idle');     // idle | pulling | refreshing | settling
  const start = useRef(null);
  const pullRef = useRef(0);
  const phaseRef = useRef('idle');
  const rootRef = useRef(null);
  const set = (d, p) => { pullRef.current = d; setPull(d); if (p) { phaseRef.current = p; setPhase(p); } };

  useEffect(() => {
    if (disabled) return undefined;
    const scroller = () => (scrollSelector ? document.querySelector(scrollSelector) : null);
    const atTop = () => {
      const el = scroller();
      return (el ? el.scrollTop : (window.scrollY || document.documentElement.scrollTop)) <= 0;
    };
    const onStart = (e) => {
      if (phaseRef.current !== 'idle' || e.touches.length !== 1) return;
      const t = e.target;
      if (!rootRef.current?.contains(t) || t.closest?.(SKIP) || !atTop() || scrolledParent(t, scroller())) { start.current = null; return; }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, armed: false };
    };
    const onMove = (e) => {
      const s = start.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = Math.abs(e.touches[0].clientX - s.x);
      if (!s.armed) {
        if (dy > 6 && dy > dx && atTop()) s.armed = true;
        else if (dy < -4 || dx > 10) { start.current = null; return; }
        else return;
      }
      if (e.cancelable) e.preventDefault();          // stop the page / iOS bounce from scrolling too
      const d = Math.min(MAX, dy <= 0 ? 0 : dy * 0.5 - (dy * dy) / 9000);
      const wasPast = pullRef.current >= THRESHOLD;
      set(Math.max(0, d), 'pulling');
      if (!wasPast && d >= THRESHOLD && navigator.vibrate) navigator.vibrate(8);
    };
    const onEnd = async () => {
      const s = start.current; start.current = null;
      if (!s || !s.armed || phaseRef.current !== 'pulling') return;
      if (pullRef.current >= THRESHOLD) {
        set(HOLD, 'refreshing');
        const t0 = Date.now();
        try { await onRefresh?.(); } catch { /* the screen shows its own errors */ }
        const wait = 650 - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      set(0, 'settling');
      setTimeout(() => { if (phaseRef.current === 'settling') set(0, 'idle'); }, 380);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled, onRefresh, scrollSelector]);

  const active = phase !== 'idle';
  const past = pull >= THRESHOLD;
  const label = phase === 'refreshing' ? 'Refreshing…' : past ? 'Release to refresh' : 'Pull to refresh';
  return (
    <div className={`ptr ${active ? 'ptr-on' : ''}`} ref={rootRef}>
      {active && (
        <div className="ptr-reveal" style={{ height: Math.max(pull, 0) + 2 }} aria-live="polite">
          <div className="ptr-hint" style={{ opacity: Math.max(0, Math.min(1, (pull - 30) / 40)) }}>
            {phase === 'refreshing'
              ? <span className="ptr-spin" />
              : <svg className={`ptr-chev ${past ? 'up' : ''}`} width="34" height="12" viewBox="0 0 34 12" aria-hidden="true"><path d="M3 9.5 17 3l14 6.5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            <span className="ptr-label">{label}</span>
          </div>
        </div>
      )}
      <div
        className={`ptr-page ${phase === 'settling' || phase === 'refreshing' ? 'ptr-anim' : ''}`}
        style={active ? { transform: `translate3d(0, ${pull}px, 0)`, borderRadius: pull > 4 ? '28px 28px 0 0' : 0 } : undefined}
      >
        {children}
      </div>
      <style>{`
        html, body { overscroll-behavior-y: none; }
        .ptr-reveal { position: fixed; top: 0; left: 0; right: 0; z-index: 0; display: flex; align-items: flex-end; justify-content: center;
          padding-top: env(safe-area-inset-top, 0px); background: radial-gradient(120% 80% at 50% 0%, #1e3a8a 0%, #0b1533 70%); color: #f6c85c; pointer-events: none; }
        .ptr-hint { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-bottom: 18px; transition: opacity .15s; }
        .ptr-chev { transform: rotate(180deg); transition: transform .25s cubic-bezier(.2,.8,.2,1); color: rgba(255,255,255,.75); }
        .ptr-chev.up { transform: rotate(0deg); color: #f6c85c; }
        .ptr-label { font: 600 12.5px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif; letter-spacing: .2px; color: rgba(255,255,255,.8); }
        .ptr-spin { width: 22px; height: 22px; border-radius: 50%; border: 2.6px solid rgba(246,200,92,.25); border-top-color: #f6c85c; animation: ptrSpin .7s linear infinite; }
        @keyframes ptrSpin { to { transform: rotate(360deg); } }
        .ptr-on .ptr-page { position: relative; z-index: 1; overflow: hidden; background: var(--bg-app, #f2f2f7); box-shadow: 0 -10px 30px rgba(0,0,0,.35); will-change: transform; }
        .ptr-anim { transition: transform .38s cubic-bezier(.2,.9,.25,1), border-radius .38s; }
        @media (prefers-reduced-motion: reduce) { .ptr-anim { transition: none; } }
      `}</style>
    </div>
  );
}
