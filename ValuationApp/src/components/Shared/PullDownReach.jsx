import React, { useEffect, useRef, useState } from 'react';

/**
 * One-handed "reach" mode, like iPhone Reachability (touch screens only).
 *
 *  • Drag down from the top of a screen → the whole screen follows the finger; let go past a short
 *    distance and it settles about 40% down the display and STAYS there, with a navy area and a gold
 *    handle above it — the top of the app is now within thumb reach.
 *  • Back to full screen: swipe up, tap the navy area, or simply use the app (tap a button, scroll) —
 *    the screen slides back up, as on iPhone.
 *
 * props
 *   scrollSelector — CSS selector of the element that scrolls (omit when the page itself scrolls)
 *   disabled       — e.g. while a full-screen chat is open
 */
const ARM = 64;          // px of drag needed for the screen to stay down
const LOWER_RATIO = 0.4; // how far down the screen rests (share of the display height)

// Places where a downward drag means something else (maps, chats, sheets, form fields…)
const SKIP = 'input, textarea, select, [contenteditable="true"], .leaflet-container, .maplibregl-map, [role="dialog"], .fs-sheet, .ch-list, .ch-thread, .ch-messages, [data-no-reach]';

function scrolledParent(el, stopAt) {
  for (let n = el; n && n !== stopAt && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return n;
  }
  return null;
}

export default function PullDownReach({ scrollSelector, disabled = false, children }) {
  const [offset, setOffset] = useState(0);       // how far the screen is moved down (px)
  const [phase, setPhase] = useState('idle');    // idle | dragging | lowered | moving
  const phaseRef = useRef('idle');
  const offsetRef = useRef(0);
  const drag = useRef(null);
  const rootRef = useRef(null);
  const pageRef = useRef(null);
  // Once the screen has settled down, it is moved with real layout (top) rather than a transform:
  // iOS web views hit-test scrolling areas at their un-transformed place, so taps would miss.
  const [settled, setSettled] = useState(false);
  const settleTimer = useRef(null);
  const set = (o, p) => {
    offsetRef.current = o; setOffset(o);
    if (p) { phaseRef.current = p; setPhase(p); }
    clearTimeout(settleTimer.current);
    if (p === 'lowered') settleTimer.current = setTimeout(() => { if (phaseRef.current === 'lowered') setSettled(true); }, 450);
    else setSettled(false);
  };
  const lowerTo = () => Math.round(window.innerHeight * LOWER_RATIO);
  const raise = () => {
    // Back to the transform at the same spot first (no jump), then slide up on the next frames
    setSettled(false); clearTimeout(settleTimer.current);
    phaseRef.current = 'moving'; setPhase('moving');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      set(0, 'moving');
      setTimeout(() => { if (phaseRef.current === 'moving' && offsetRef.current === 0) set(0, 'idle'); }, 450);
    }));
  };

  useEffect(() => {
    if (disabled) { if (phaseRef.current !== 'idle') set(0, 'idle'); return undefined; }
    const scroller = () => (scrollSelector ? document.querySelector(scrollSelector) : null);
    const atTop = () => {
      const el = scroller();
      return (el ? el.scrollTop : (window.scrollY || document.documentElement.scrollTop)) <= 0;
    };

    const onStart = (e) => {
      if (e.touches.length !== 1) { drag.current = null; return; }
      const t = e.target;
      const y = e.touches[0].clientY, x = e.touches[0].clientX;
      if (phaseRef.current === 'lowered') {
        // While lowered: a swipe up anywhere, or any gesture, brings the screen back
        drag.current = { y, x, from: offsetRef.current, mode: 'lowered', onPage: !!pageRef.current?.contains(t) };
        return;
      }
      if (phaseRef.current !== 'idle') return;
      if (!rootRef.current?.contains(t) || t.closest?.(SKIP) || !atTop() || scrolledParent(t, scroller())) { drag.current = null; return; }
      drag.current = { y, x, from: 0, mode: 'down', armed: false };
    };

    const onMove = (e) => {
      const d = drag.current;
      if (!d) return;
      const dy = e.touches[0].clientY - d.y;
      const dx = Math.abs(e.touches[0].clientX - d.x);
      if (d.mode === 'lowered') {
        if (Math.abs(dy) < 8 && dx < 8) return;
        if (dy < 0 || !d.onPage) {                       // swipe up (or drag on the navy area) → follow, then go back
          if (e.cancelable) e.preventDefault();
          set(Math.max(0, Math.min(lowerTo(), d.from + dy)), 'dragging');
          d.moved = true;
        } else if (!d.moved) {                           // scrolling the lowered screen → back to full screen, like iPhone
          drag.current = null;
          raise();
        }
        return;
      }
      if (!d.armed) {
        if (dy > 6 && dy > dx && atTop()) d.armed = true;
        else if (dy < -4 || dx > 10) { drag.current = null; return; }
        else return;
      }
      if (e.cancelable) e.preventDefault();             // stop the page / iOS bounce from scrolling too
      const max = lowerTo() + 40;
      const o = dy <= 0 ? 0 : Math.min(max, dy * 0.85);
      const wasArmed = offsetRef.current >= ARM;
      set(o, 'dragging');
      if (!wasArmed && o >= ARM && navigator.vibrate) navigator.vibrate(8);
    };

    const onEnd = () => {
      const d = drag.current; drag.current = null;
      if (!d) return;
      if (d.mode === 'lowered') {
        if (!d.moved) return;                            // a tap: handled by the click listener below
        if (offsetRef.current < lowerTo() - 50) raise(); else set(lowerTo(), 'lowered');
        return;
      }
      if (phaseRef.current !== 'dragging') return;
      if (offsetRef.current >= ARM) set(lowerTo(), 'lowered');
      else raise();
    };

    // While lowered, using the app (a tap on the screen) brings it back up after the tap does its job
    const onClick = (e) => {
      if (phaseRef.current !== 'lowered') return;
      if (pageRef.current?.contains(e.target)) setTimeout(raise, 0);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    window.addEventListener('click', onClick, true);
    const onResize = () => { if (phaseRef.current === 'lowered') set(lowerTo(), 'lowered'); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', onResize);
    };
  }, [disabled, scrollSelector]);

  const active = phase !== 'idle';
  const animate = (phase === 'lowered' || phase === 'moving') && !settled;
  return (
    <div className={`reach ${active ? 'reach-on' : ''}`} ref={rootRef}>
      {active && (
        <button type="button" className="reach-top" style={{ height: offset + 2 }} onClick={raise} aria-label="Back to full screen">
          <svg className="reach-handle" width="38" height="12" viewBox="0 0 38 12" aria-hidden="true" style={{ opacity: Math.min(1, Math.max(0, (offset - 30) / 40)) }}>
            <path d="M4 9.5 19 3l15 6.5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div
        ref={pageRef}
        className={`reach-page ${animate ? 'reach-anim' : ''}`}
        style={active ? {
          ...(settled ? { top: offset, transform: 'none' } : { transform: `translate3d(0, ${offset}px, 0)` }),
          borderRadius: offset > 4 ? '30px 30px 0 0' : 0
        } : undefined}
      >
        {children}
      </div>
      <style>{`
        html, body { overscroll-behavior-y: none; }
        .reach-top { position: fixed; top: 0; left: 0; right: 0; z-index: 0; border: 0; margin: 0; padding: 0 0 18px; cursor: pointer;
          display: flex; align-items: flex-end; justify-content: center; -webkit-tap-highlight-color: transparent;
          background: radial-gradient(120% 90% at 50% 0%, #1e3a8a 0%, #0b1533 72%); color: #f6c85c; }
        .reach-handle { transition: opacity .15s; filter: drop-shadow(0 2px 6px rgba(0,0,0,.35)); }
        .reach-on .reach-page { position: relative; z-index: 1; overflow: hidden; background: var(--bg-app, #f2f2f7);
          box-shadow: 0 -12px 34px rgba(0,0,0,.4); }
        .reach-anim { transition: transform .42s cubic-bezier(.2,.9,.25,1), border-radius .42s; }
        @media (prefers-reduced-motion: reduce) { .reach-anim { transition: none; } }
      `}</style>
    </div>
  );
}
