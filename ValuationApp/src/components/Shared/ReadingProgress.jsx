import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, X, RotateCcw, CheckCircle2, Pause } from 'lucide-react';

/**
 * A waiting card: title, percentage bar, what is happening now, and two small games to pass the wait.
 * pct 0–100, stage: short text ("Uploading 1 of 2", "Reading the office sheet"), done: finished.
 * games=false for waits where a game would be in the way (login, voice at the site).
 */
export default function ReadingProgress({
  pct = 0, stage = '', done = false, note = '',
  title = 'Gouru AI is reading the documents', doneTitle = 'Gouru AI finished reading',
  doneNote = 'The details below are filled. Please check them.', games = true,
}) {
  const [play, setPlay] = useState(false);
  // Reading finished → the game stops at once and closes a moment later, so the engineer goes back to the form
  useEffect(() => {
    if (!done || !play) return undefined;
    const t = setTimeout(() => setPlay(false), 1500);
    return () => clearTimeout(t);
  }, [done, play]);
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`rp${done ? ' rp-done' : ''}`} role="status" aria-live="polite">
      <div className="rp-top">
        {done && <CheckCircle2 size={17} />}
        <span className="rp-t">{done ? doneTitle : title}</span>
        <b className="rp-pct">{p}%</b>
      </div>
      <div className="rp-bar" aria-hidden="true"><i style={{ width: `${p}%` }} /></div>
      <div className="rp-sub">
        <span>{done ? note || doneNote : stage || 'Starting…'}</span>
        {games && !play && !done && <button type="button" className="rp-game-btn" onClick={() => setPlay(true)}><Gamepad2 size={15} /> Play while you wait</button>}
      </div>
      {play && <GamePanel done={done} onClose={() => setPlay(false)} />}
      <style>{`
        .rp { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 16px; padding: 12px; margin: 6px 0 4px; display: flex; flex-direction: column; gap: 8px; }
        .rp-done { background: #ecfdf5; border-color: #a7f3d0; }
        .rp-top { display: flex; align-items: center; gap: 8px; color: #4338ca; }
        .rp-done .rp-top { color: #047857; }
        .rp-t { flex: 1; font-weight: 700; font-size: 14.5px; }
        .rp-pct { font-size: 18px; font-variant-numeric: tabular-nums; }
        .rp-bar { height: 8px; border-radius: 99px; background: #e0e7ff; overflow: hidden; }
        .rp-done .rp-bar { background: #d1fae5; }
        .rp-bar i { display: block; height: 100%; border-radius: 99px; background: #4f46e5; transition: width .6s ease; position: relative; overflow: hidden; }
        .rp-done .rp-bar i { background: #10b981; }
        .rp-bar i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: rpShine 1.3s linear infinite; }
        .rp-done .rp-bar i::after { display: none; }
        @keyframes rpShine { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        .rp-sub { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: #64748b; }
        .rp-game-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #c7d2fe; background: #fff; color: #4338ca; border-radius: 99px; padding: 5px 11px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
        body.dark-theme .rp { background: #1e1b4b; border-color: #3730a3; }
        body.dark-theme .rp-done { background: #052e2b; border-color: #065f46; }
        body.dark-theme .rp-top { color: #c7d2fe; } body.dark-theme .rp-done .rp-top { color: #6ee7b7; }
        body.dark-theme .rp-game-btn { background: #1c1c1e; color: #c7d2fe; border-color: #3730a3; }
      `}</style>
    </div>
  );
}

/**
 * Same card for a wait that only has busy = true / false: the percentage climbs with time (expectSec ≈ a usual
 * wait), the stage text moves through `stages`, then 100% and green for a moment when busy turns false.
 */
export function WaitCard({ busy, title, doneTitle = 'Done', doneNote = '', stages = [], expectSec = 25, games = true }) {
  const [view, setView] = useState(null); // { pct, stage, done }
  const was = useRef(false);
  useEffect(() => {
    if (busy) {
      was.current = true;
      const t0 = Date.now();
      const tick = () => {
        const sec = (Date.now() - t0) / 1000;
        const i = Math.min(stages.length - 1, Math.floor((sec / expectSec) * stages.length));
        setView({ pct: 3 + 92 * (1 - Math.exp((-2.3 * sec) / expectSec)), stage: stages[Math.max(0, i)] || '', done: false });
      };
      tick();
      const id = setInterval(tick, 400);
      return () => clearInterval(id);
    }
    if (!was.current) return undefined;
    was.current = false;
    setView({ pct: 100, stage: '', done: true });
    const t = setTimeout(() => setView(null), 1800);
    return () => clearTimeout(t);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return null;
  return <ReadingProgress pct={view.pct} stage={view.stage} done={view.done} title={title} doneTitle={doneTitle} doneNote={doneNote} games={games} />;
}

// ── Games: Snake and Pop, picked with two tabs; the last one played is remembered ──
const GAME_KEY = 'gouru_wait_game';
function GamePanel({ done, onClose }) {
  const [game, setGame] = useState(() => (localStorage.getItem(GAME_KEY) === 'pop' ? 'pop' : 'snake'));
  const pick = (g) => { setGame(g); localStorage.setItem(GAME_KEY, g); };
  return (
    <div className="sg">
      <div className="sg-tabs" role="tablist">
        {[['snake', 'Snake'], ['pop', 'Pop the dots']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={game === k} className={game === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      {game === 'snake' ? <SnakeGame key="snake" done={done} onClose={onClose} /> : <PopGame key="pop" done={done} onClose={onClose} />}
      <style>{GAME_CSS}</style>
    </div>
  );
}

// ── Snake: eat the dots, don't hit yourself. Walls wrap around (kinder on a phone). ──
// Phone first: swipe anywhere on the board (turns as soon as the finger moves; arrow keys on a computer), a little buzz on each dot, sharp drawing on any screen, and it pauses when the app goes to the background.
const N = 15;          // grid cells per side
const SPEED = 175;     // ms per step at the start; a little faster every 5 dots
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const BEST_KEY = 'gouru_snake_best';
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ } };

function SnakeGame({ onClose, done }) {
  const canvas = useRef(null);
  const board = useRef(null);
  const g = useRef(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0));
  const [state, setState] = useState('ready'); // ready | playing | paused | over
  const [newBest, setNewBest] = useState(false);
  const [pop, setPop] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;

  const newFood = (snake) => {
    for (;;) {
      const f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
      if (!snake.some(([x, y]) => x === f[0] && y === f[1])) return f;
    }
  };
  const reset = () => {
    const snake = [[7, 7], [6, 7], [5, 7]];
    g.current = { snake, dir: [1, 0], queue: [], food: newFood(snake), score: 0, last: 0 };
    setScore(0); setNewBest(false);
  };
  const start = () => {
    if (stateRef.current === 'finished') return;
    if (stateRef.current === 'over' || !g.current) reset();
    setState('playing');
  };
  const turn = (name) => {
    const s = g.current; if (!s) return;
    const d = DIRS[name];
    const lastDir = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if ((d[0] === -lastDir[0] && d[1] === -lastDir[1]) || (d[0] === lastDir[0] && d[1] === lastDir[1])) {
      if (stateRef.current !== 'playing') start();
      return;
    }
    if (s.queue.length < 2) s.queue.push(d); // two quick swipes in a row both count
    if (stateRef.current !== 'playing') start();
  };

  useEffect(() => { reset(); }, []);

  // Reading finished: stop the game (the score still counts for "Best")
  useEffect(() => {
    if (!done) return;
    const s = g.current;
    if (s && s.score > Number(localStorage.getItem(BEST_KEY) || 0)) { localStorage.setItem(BEST_KEY, String(s.score)); setBest(s.score); }
    setState('finished');
  }, [done]);

  // Sharp on any phone screen: canvas pixels = shown size × screen density
  useEffect(() => {
    const fit = () => {
      const c = canvas.current; const b = board.current; if (!c || !b) return;
      const px = Math.round(b.clientWidth * (window.devicePixelRatio || 1));
      if (c.width !== px) { c.width = px; c.height = px; }
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && board.current) ro.observe(board.current);
    return () => ro && ro.disconnect();
  }, []);

  // Pause when the app goes to the background
  useEffect(() => {
    const onHide = () => { if (document.hidden && stateRef.current === 'playing') setState('paused'); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const draw = (t) => {
    const c = canvas.current; const s = g.current; if (!c || !s) return;
    const ctx = c.getContext('2d'); const size = c.width; const cell = size / N;
    const dark = document.body.classList.contains('dark-theme');
    const cx = (v) => (v + 0.5) * cell;
    ctx.fillStyle = dark ? '#111827' : '#fbfbfd'; ctx.fillRect(0, 0, size, size);
    // a soft dot in the middle of every cell
    ctx.fillStyle = dark ? '#374151' : '#dfe3ea';
    for (let x = 0; x < N; x += 1) for (let y = 0; y < N; y += 1) { ctx.beginPath(); ctx.arc(cx(x), cx(y), Math.max(1, cell * 0.06), 0, Math.PI * 2); ctx.fill(); }
    // food: a gently pulsing dot
    const r = cell * (0.27 + 0.04 * Math.sin(t / 200));
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(cx(s.food[0]), cx(s.food[1]), r, 0, Math.PI * 2); ctx.fill();
    // snake: round beads, smallest and lightest at the tail, biggest at the head
    const len = s.snake.length;
    for (let i = len - 1; i >= 0; i -= 1) {
      const [x, y] = s.snake[i];
      const k = len > 1 ? i / (len - 1) : 0; // 0 head … 1 tail
      ctx.fillStyle = i === 0 ? '#2563eb' : `rgba(59,130,246,${(1 - 0.45 * k).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(cx(x), cx(y), cell * (i === 0 ? 0.42 : 0.36 - 0.13 * k), 0, Math.PI * 2); ctx.fill();
    }
    const [hx, hy] = s.snake[0];
    const [dx, dy] = s.dir;
    ctx.fillStyle = '#0f172a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx(hx) + (dx * 0.12 + side * dy * 0.14) * cell, cx(hy) + (dy * 0.12 + side * dx * 0.14) * cell, cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Game loop
  useEffect(() => {
    let raf;
    const step = (t) => {
      const s = g.current;
      if (s && state === 'playing' && t - s.last > Math.max(80, SPEED - Math.floor(s.score / 5) * 12)) {
        s.last = t;
        if (s.queue.length) s.dir = s.queue.shift();
        const head = [(s.snake[0][0] + s.dir[0] + N) % N, (s.snake[0][1] + s.dir[1] + N) % N];
        if (s.snake.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1])) {
          setState('over');
          buzz([60, 40, 60]);
          if (s.score > best) { setBest(s.score); setNewBest(true); localStorage.setItem(BEST_KEY, String(s.score)); }
        } else {
          s.snake.unshift(head);
          if (head[0] === s.food[0] && head[1] === s.food[1]) {
            s.score += 1; setScore(s.score); setPop((n) => n + 1); buzz(15);
            s.food = newFood(s.snake);
          } else s.snake.pop();
        }
      }
      draw(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state, best]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard (web)
  useEffect(() => {
    const onKey = (e) => {
      const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
      if (k) { e.preventDefault(); turn(k); } else if (e.key === ' ') { e.preventDefault(); setState((x) => (x === 'playing' ? 'paused' : x === 'paused' || x === 'ready' ? 'playing' : x)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe: turns as soon as the finger has moved ~22 px; the page does not scroll while the finger is on the board
  useEffect(() => {
    const el = board.current; if (!el) return undefined;
    let from = null;
    const down = (e) => { const t = e.touches[0]; from = [t.clientX, t.clientY]; };
    const move = (e) => {
      e.preventDefault();
      if (!from) return;
      const t = e.touches[0]; const dx = t.clientX - from[0]; const dy = t.clientY - from[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      from = [t.clientX, t.clientY]; // keep swiping without lifting the finger
    };
    const up = () => { if (from && stateRef.current !== 'playing') start(); from = null; };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up, { passive: true });
    return () => { el.removeEventListener('touchstart', down); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', up); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="sg-h">
        <span className="sg-chip">Score <b key={pop} className="sg-pop">{score}</b></span>
        <span className="sg-chip">Best <b>{best}</b></span>
        {state === 'playing' && <button type="button" className="sg-ic" onClick={() => setState('paused')} aria-label="Pause"><Pause size={18} /></button>}
        <button type="button" className="sg-ic" onClick={onClose} aria-label="Close the game"><X size={18} /></button>
      </div>
      <div className="sg-board" ref={board} onClick={() => { if (state !== 'playing' && !('ontouchstart' in window)) start(); }}>
        <canvas ref={canvas} />
        {state !== 'playing' && (
          <div className="sg-over">
            {state === 'finished' ? (
              <><CheckCircle2 size={34} /><b>All done</b><span>Score {score} · back to your work…</span></>
            ) : state === 'over' ? (
              <><b>{newBest ? 'New best!' : 'Game over'}</b><span className="sg-big">{score}</span><span><RotateCcw size={15} /> Tap to play again</span></>
            ) : state === 'paused' ? (
              <><b>Paused</b><span>Tap to carry on</span></>
            ) : (
              <><b>Snake</b><span>Tap to start · swipe to turn</span></>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const GAME_CSS = `
        .sg { display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: 100%; max-width: 380px; margin: 0 auto; padding-top: 2px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        .sg-h { display: flex; align-items: center; gap: 8px; }
        .sg-chip { display: inline-flex; align-items: baseline; gap: 6px; background: #fff; border: 1px solid #e0e7ff; border-radius: 99px; padding: 5px 12px; font-size: 13px; color: #64748b; }
        .sg-chip b { color: #3730a3; font-size: 17px; font-variant-numeric: tabular-nums; }
        .sg-pop { display: inline-block; animation: sgPop .35s ease; }
        @keyframes sgPop { 40% { transform: scale(1.45); color: #f97316; } }
        .sg-ic { width: 38px; height: 38px; border-radius: 50%; border: 1px solid #e0e7ff; background: #fff; color: #475569; display: grid; place-items: center; cursor: pointer; }
        .sg-ic:first-of-type { margin-left: auto; }
        .sg-board { position: relative; width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; touch-action: none; border: 1px solid #e5e7eb; }
        .sg-board canvas { width: 100%; height: 100%; display: block; }
        .sg-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(251,251,253,.88); color: #1e3a8a; cursor: pointer; text-align: center; padding: 16px; }
        .sg-over b { font-size: 22px; } .sg-over span { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; }
        .sg-over .sg-big { font-size: 44px; font-weight: 800; line-height: 1; }
        body.dark-theme .sg-chip, body.dark-theme .sg-ic { background: #1c1c1e; border-color: #3730a3; color: #c7d2fe; }
        body.dark-theme .sg-chip b { color: #c7d2fe; }
        body.dark-theme .sg-over { background: rgba(17,24,39,.86); color: #c7d2fe; }
        .sg-tabs { display: flex; gap: 4px; background: #e0e7ff; border-radius: 99px; padding: 3px; align-self: center; }
        .sg-tabs button { border: 0; background: none; border-radius: 99px; padding: 6px 14px; font-size: 13px; font-weight: 700; color: #4338ca; cursor: pointer; font-family: inherit; }
        .sg-tabs button.on { background: #fff; color: #1e3a8a; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .sg-lives { display: inline-flex; gap: 4px; align-items: center; }
        .sg-lives i { width: 9px; height: 9px; border-radius: 50%; background: #3b82f6; display: block; }
        .sg-lives i.gone { background: #dbe3f0; }
        body.dark-theme .sg-tabs { background: #1e1b4b; } body.dark-theme .sg-tabs button { color: #c7d2fe; }
        body.dark-theme .sg-tabs button.on { background: #312e81; color: #fff; }
`;

// ── Pop the dots: tap each blue dot before it fades away. Three missed dots and the round ends. Faster as you go. ──
const POP_BEST = 'gouru_pop_best';
function PopGame({ onClose, done }) {
  const canvas = useRef(null);
  const board = useRef(null);
  const g = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(() => Number(localStorage.getItem(POP_BEST) || 0));
  const [state, setState] = useState('ready'); // ready | playing | paused | over | finished
  const [newBest, setNewBest] = useState(false);
  const [pop, setPop] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;

  const saveBest = (sc) => { if (sc > Number(localStorage.getItem(POP_BEST) || 0)) { localStorage.setItem(POP_BEST, String(sc)); setBest(sc); return true; } return false; };
  const start = () => {
    if (stateRef.current === 'finished') return;
    if (stateRef.current !== 'paused') { g.current = { dots: [], score: 0, lives: 3, next: 0, bursts: [] }; setScore(0); setLives(3); setNewBest(false); }
    setState('playing');
  };

  useEffect(() => {
    const fit = () => {
      const c = canvas.current; const b = board.current; if (!c || !b) return;
      const px = Math.round(b.clientWidth * (window.devicePixelRatio || 1));
      if (c.width !== px) { c.width = px; c.height = px; }
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && board.current) ro.observe(board.current);
    const onHide = () => { if (document.hidden && stateRef.current === 'playing') setState('paused'); };
    document.addEventListener('visibilitychange', onHide);
    return () => { if (ro) ro.disconnect(); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  useEffect(() => {
    if (!done) return;
    if (g.current) saveBest(g.current.score);
    setState('finished');
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loop: new dots appear, each grows then shrinks away; a dot that shrinks away unpopped costs a life
  useEffect(() => {
    let raf; let last = performance.now();
    const step = (t) => {
      const dt = t - last; last = t;
      const c = canvas.current; const s = g.current;
      if (c) {
        const ctx = c.getContext('2d'); const size = c.width;
        const dark = document.body.classList.contains('dark-theme');
        ctx.fillStyle = dark ? '#111827' : '#fbfbfd'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = dark ? '#374151' : '#dfe3ea';
        const cell = size / 15;
        for (let x = 0; x < 15; x += 1) for (let y = 0; y < 15; y += 1) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, Math.max(1, cell * 0.06), 0, Math.PI * 2); ctx.fill(); }
        if (s && state === 'playing') {
          const life = Math.max(900, 2000 - s.score * 35);       // ms a dot stays
          const gap = Math.max(380, 950 - s.score * 18);         // ms between new dots
          s.next -= dt;
          if (s.next <= 0 && s.dots.length < 4) {
            s.next = gap;
            const r = size * 0.075;
            s.dots.push({ x: r + Math.random() * (size - 2 * r), y: r + Math.random() * (size - 2 * r), age: 0, life, r });
          }
          for (const d of s.dots) d.age += dt;
          const missed = s.dots.filter((d) => d.age >= d.life).length;
          if (missed) {
            s.dots = s.dots.filter((d) => d.age < d.life);
            s.lives -= missed; setLives(Math.max(0, s.lives)); buzz(30);
            if (s.lives <= 0) { setState('over'); buzz([60, 40, 60]); if (saveBest(s.score)) setNewBest(true); }
          }
        }
        if (s) {
          for (const d of s.dots) {
            const k = d.age / d.life; // 0 → 1
            const rr = d.r * (k < 0.2 ? k / 0.2 : 1 - 0.55 * ((k - 0.2) / 0.8));
            ctx.fillStyle = `rgba(59,130,246,${(0.18 + 0.12 * (1 - k)).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(d.x, d.y, rr * 1.45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = k > 0.75 ? '#93c5fd' : '#3b82f6';
            ctx.beginPath(); ctx.arc(d.x, d.y, rr, 0, Math.PI * 2); ctx.fill();
          }
          s.bursts = s.bursts.filter((b) => (b.age += dt) < 300);
          for (const b of s.bursts) {
            ctx.strokeStyle = `rgba(59,130,246,${(1 - b.age / 300).toFixed(2)})`; ctx.lineWidth = size * 0.008;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + b.age / 150), 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // A touch anywhere: pops the dot under the finger (a little bigger than it looks, kind to thumbs)
  const onDown = (e) => {
    e.preventDefault();
    if (stateRef.current !== 'playing') { start(); return; }
    const c = canvas.current; const s = g.current; if (!c || !s) return;
    const rect = c.getBoundingClientRect(); const k = c.width / rect.width;
    const x = (e.clientX - rect.left) * k; const y = (e.clientY - rect.top) * k;
    const hit = s.dots.find((d) => Math.hypot(d.x - x, d.y - y) < d.r * 1.6);
    if (!hit) return;
    s.dots = s.dots.filter((d) => d !== hit);
    s.bursts.push({ x: hit.x, y: hit.y, r: hit.r, age: 0 });
    s.score += 1; setScore(s.score); setPop((n) => n + 1); buzz(12);
  };

  return (
    <>
      <div className="sg-h">
        <span className="sg-chip">Score <b key={pop} className="sg-pop">{score}</b></span>
        <span className="sg-chip">Best <b>{best}</b></span>
        <span className="sg-lives" aria-label={`${lives} lives left`}>{[0, 1, 2].map((i) => <i key={i} className={i < lives ? '' : 'gone'} />)}</span>
        {state === 'playing' && <button type="button" className="sg-ic" onClick={() => setState('paused')} aria-label="Pause"><Pause size={18} /></button>}
        <button type="button" className="sg-ic" onClick={onClose} aria-label="Close the game"><X size={18} /></button>
      </div>
      <div className="sg-board" ref={board} onPointerDown={onDown}>
        <canvas ref={canvas} />
        {state !== 'playing' && (
          <div className="sg-over">
            {state === 'finished' ? (
              <><CheckCircle2 size={34} /><b>All done</b><span>Score {score} · back to your work…</span></>
            ) : state === 'over' ? (
              <><b>{newBest ? 'New best!' : 'Round over'}</b><span className="sg-big">{score}</span><span><RotateCcw size={15} /> Tap to play again</span></>
            ) : state === 'paused' ? (
              <><b>Paused</b><span>Tap to carry on</span></>
            ) : (
              <><b>Pop the dots</b><span>Tap each dot before it fades</span></>
            )}
          </div>
        )}
      </div>
    </>
  );
}
