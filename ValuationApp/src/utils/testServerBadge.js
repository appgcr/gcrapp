import { API_BASE_URL } from '../config/api';

// A small yellow "TEST SERVER" tag on every screen whenever the app talks to a server that is not the live one
// (staging, or a server on this computer), so practice work is never taken for real work. Nothing on live.
export function installTestServerBadge() {
  fetch(`${API_BASE_URL}/api/health`).then((r) => (r.ok ? r.json() : null)).then((h) => {
    const env = String((h && h.environment) || '').toLowerCase();
    if (!env || env === 'production') return;
    const tag = document.createElement('div');
    tag.setAttribute('role', 'status');
    tag.textContent = env === 'staging' ? 'TEST SERVER · practice data only' : `${env.toUpperCase()} SERVER · not live`;
    Object.assign(tag.style, {
      position: 'fixed', left: '50%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)', transform: 'translateX(-50%)', zIndex: 2147483000,
      background: '#facc15', color: '#422006', font: '800 11.5px/1 system-ui, sans-serif', letterSpacing: '.04em', padding: '6px 12px',
      borderRadius: '999px', boxShadow: '0 2px 10px rgba(0,0,0,.18)', pointerEvents: 'none', whiteSpace: 'nowrap',
    });
    document.body.appendChild(tag);
  }).catch(() => {});
}
