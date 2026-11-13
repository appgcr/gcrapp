import React, { useEffect, useState } from 'react';
import GcrLogo from './GcrLogo';

// Picks up exactly where the phone's native launch screen ends (same logo, same place,
// white / black background), then fades into the app — so start-up feels like one motion.
export default function LaunchSplash({ minMs = 900 }) {
  const [phase, setPhase] = useState('show'); // show → leave → gone

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setPhase('leave'), reduce ? 300 : minMs);
    const t2 = setTimeout(() => setPhase('gone'), (reduce ? 300 : minMs) + 420);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minMs]);

  if (phase === 'gone') return null;
  return (
    <div className={`ls-root ${phase === 'leave' ? 'ls-leave' : ''}`} aria-hidden="true">
      <div className="ls-center">
        <div className="ls-logo"><GcrLogo size={96} /></div>
        <div className="ls-name">Gouru Valuations</div>
      </div>
      <div className="ls-foot">
        <span className="ls-bar"><span /></span>
        Property Valuation · Bank Panel
      </div>
      <style>{`
        .ls-root { position: fixed; inset: 0; z-index: 100000; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; transition: opacity .42s ease; }
        .ls-center { display: flex; flex-direction: column; align-items: center; gap: 18px; margin-top: -4vh; }
        .ls-logo { animation: lsIn .6s cubic-bezier(.2,.9,.25,1) both; transition: transform .42s cubic-bezier(.4,0,.2,1); }
        .ls-name { font-size: 22px; font-weight: 700; letter-spacing: -.3px; color: #0f172a; animation: lsUp .6s .12s cubic-bezier(.2,.9,.25,1) both; }
        .ls-foot { position: absolute; bottom: calc(env(safe-area-inset-bottom, 0px) + 44px); display: flex; flex-direction: column; align-items: center; gap: 14px; font-size: 13px; color: #8e8e93; letter-spacing: .2px; }
        .ls-bar { width: 120px; height: 3px; border-radius: 3px; background: rgba(120,120,128,.16); overflow: hidden; }
        .ls-bar span { display: block; height: 100%; width: 40%; border-radius: 3px; background: #007aff; animation: lsBar 1s ease-in-out infinite; }
        .ls-leave { opacity: 0; pointer-events: none; }
        .ls-leave .ls-logo { transform: scale(1.08); }
        @keyframes lsIn { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: none; } }
        @keyframes lsUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes lsBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @media (prefers-color-scheme: dark) { .ls-root { background: #000; } .ls-name { color: #fff; } }
        @media (prefers-reduced-motion: reduce) { .ls-logo, .ls-name, .ls-bar span { animation: none; } }
      `}</style>
    </div>
  );
}
