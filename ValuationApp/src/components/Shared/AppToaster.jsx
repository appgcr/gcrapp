import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-react';
import ToastLimit from './ToastLimit';

// The app's message cards: clear icon, readable text, a real close (X) button,
// and tap or swipe up/sideways to close.
const KIND = {
  success: { color: '#16a34a', bg: '#dcfce7', Icon: CheckCircle2, title: 'Done' },
  error: { color: '#dc2626', bg: '#fee2e2', Icon: AlertCircle, title: 'Needs attention' },
  loading: { color: '#2563eb', bg: '#dbeafe', Icon: Loader2, title: '' },
  blank: { color: '#2563eb', bg: '#dbeafe', Icon: Info, title: '' },
};

function Card({ t, message }) {
  const k = KIND[t.type] || KIND.blank;
  const start = useRef(null);
  const close = () => toast.dismiss(t.id);
  const onTouchStart = (e) => { const p = e.touches[0]; start.current = { x: p.clientX, y: p.clientY }; };
  const onTouchEnd = (e) => {
    if (!start.current) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.current.x; const dy = p.clientY - start.current.y;
    start.current = null;
    if (dy < -30 || Math.abs(dx) > 60) close();
  };
  const emoji = typeof t.icon === 'string' ? t.icon : null;
  return (
    <div className={`gt-card gt-${t.type}`} onClick={close} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="gt-icon" style={{ background: k.bg, color: k.color }}>
        {emoji ? <span style={{ fontSize: 18 }}>{emoji}</span> : <k.Icon size={20} strokeWidth={2.4} className={t.type === 'loading' ? 'gt-spin' : ''} />}
      </div>
      <div className="gt-body">{message}</div>
      {t.type !== 'loading' && (
        <button type="button" className="gt-x" aria-label="Close message" onClick={(e) => { e.stopPropagation(); close(); }}>
          <X size={16} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

export default function AppToaster({ duration = 4000 }) {
  // Rendered at the top of the page (outside one-handed mode's lowered screen) so messages always show
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <ToastLimit />
      <style>{CSS}</style>
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: 12, right: 12 }}
        toastOptions={{ duration, error: { duration: Math.max(duration, 5000) } }}
      >
        {(t) => (
          <ToastBar toast={t} style={{ padding: 0, background: 'transparent', boxShadow: 'none', maxWidth: 'min(460px, 100%)', width: '100%' }}>
            {({ message }) => <Card t={t} message={message} />}
          </ToastBar>
        )}
      </Toaster>
    </>,
    document.body
  );
}

/** Message body with a bold heading and a short list, e.g. the fields still to fill. */
export function ListMessage({ title, items, hint, tone = 'error' }) {
  return (
    <div>
      <div className="gt-title">{title}</div>
      <ul className={`gt-list gt-list-${tone}`}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
      {hint && <div className="gt-hint">{hint}</div>}
    </div>
  );
}

const CSS = `
.gt-card { display: flex; align-items: flex-start; gap: 12px; width: 100%; box-sizing: border-box; background: rgba(255,255,255,.97); color: #0f172a; border-radius: 16px; padding: 12px 10px 12px 12px; box-shadow: 0 10px 30px rgba(15,23,42,.18), 0 1px 3px rgba(15,23,42,.08); border: 1px solid rgba(15,23,42,.06); border-left: 4px solid #2563eb; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); pointer-events: auto; cursor: pointer; font-family: inherit; }
.gt-card.gt-success { border-left-color: #16a34a; }
.gt-card.gt-error { border-left-color: #dc2626; }
.gt-icon { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
.gt-body { flex: 1; min-width: 0; font-size: 14.5px; line-height: 1.45; font-weight: 500; padding-top: 7px; white-space: pre-line; overflow-wrap: anywhere; }
.gt-body > div[role] { margin: 0 !important; justify-content: flex-start !important; text-align: left; }
.gt-title { font-weight: 800; font-size: 15px; margin-top: -2px; }
.gt-list { margin: 6px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.gt-list li { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; font-weight: 700; }
.gt-list-success li { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
body.dark-theme .gt-list-success li { background: rgba(22,163,74,.15); color: #86efac; border-color: rgba(22,163,74,.35); }
.gt-hint { margin-top: 8px; font-size: 12.5px; color: #64748b; }
.gt-x { flex: 0 0 30px; width: 30px; height: 30px; border: 0; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-top: 3px; }
.gt-x:active { background: #e2e8f0; }
.gt-spin { animation: gtSpin 1s linear infinite; }
@keyframes gtSpin { to { transform: rotate(360deg); } }
body.dark-theme .gt-card { background: rgba(28,28,30,.97); color: #fff; border-color: rgba(255,255,255,.08); }
body.dark-theme .gt-x { background: #2c2c2e; color: #d1d5db; }
body.dark-theme .gt-list li { background: rgba(220,38,38,.15); color: #fca5a5; border-color: rgba(220,38,38,.35); }
body.dark-theme .gt-hint { color: #9ca3af; }
`;
