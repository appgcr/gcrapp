import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * In-app yes/no sheet (the browser's own confirm box is easy to miss on phones and is blocked in some app views).
 *   if (!(await askConfirm({ title: 'Approve case?', message: '…', confirmText: 'Approve' }))) return;
 */
export default function askConfirm({ title = 'Are you sure?', message = '', confirmText = 'Yes', cancelText = 'Cancel', tone = 'primary' } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<Sheet {...{ title, message, confirmText, cancelText, tone }} onDone={done} />);
  });
}

function Sheet({ title, message, confirmText, cancelText, tone, onDone }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDone(false); if (e.key === 'Enter') onDone(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);
  return (
    <div className="ack-bg" onClick={() => onDone(false)}>
      <div className="ack" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ack-t">{title}</div>
        {message && <div className="ack-m">{message}</div>}
        <div className="ack-b">
          <button type="button" className="ack-no" onClick={() => onDone(false)}>{cancelText}</button>
          <button type="button" className={`ack-yes ${tone}`} autoFocus onClick={() => onDone(true)}>{confirmText}</button>
        </div>
      </div>
      <style>{`
        .ack-bg { position: fixed; inset: 0; z-index: 2147483000; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; animation: ackIn .15s ease-out; }
        @media (min-width: 640px) { .ack-bg { align-items: center; } .ack { border-radius: 18px !important; } }
        .ack { width: 100%; max-width: 440px; background: #fff; border-radius: 18px 18px 0 0; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); font-family: inherit; }
        .ack-t { font-size: 17px; font-weight: 800; color: #0f172a; }
        .ack-m { margin-top: 6px; font-size: 14px; color: #475569; line-height: 1.45; white-space: pre-line; }
        .ack-b { display: flex; gap: 10px; margin-top: 18px; }
        .ack-b button { flex: 1; border: 0; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .ack-no { background: #f1f5f9; color: #334155; }
        .ack-yes.primary { background: #2563eb; color: #fff; }
        .ack-yes.success { background: #16a34a; color: #fff; }
        .ack-yes.danger { background: #dc2626; color: #fff; }
        @keyframes ackIn { from { opacity: 0; } to { opacity: 1; } }
        body.dark-theme .ack { background: #1c1c1e; }
        body.dark-theme .ack-t { color: #fff; }
        body.dark-theme .ack-m { color: #aeaeb2; }
        body.dark-theme .ack-no { background: #2c2c2e; color: #fff; }
      `}</style>
    </div>
  );
}
