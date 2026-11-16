import React, { useEffect, useState } from 'react';
import { WifiOff, CloudUpload, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { subscribeSyncStatus, syncPendingCases, startAutoSync } from '../../services/offlineSyncService';

/**
 * One line under the header on every engineer screen:
 *   no signal · cases waiting to upload · uploading · uploaded · refused (needs fixing)
 */
export default function OfflineBar({ onOpenCase }) {
  const [s, setS] = useState({ count: 0, refused: [], online: typeof navigator === 'undefined' ? true : navigator.onLine !== false });
  const [cached, setCached] = useState(null);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    startAutoSync();
    const off = subscribeSyncStatus((st) => {
      setS((prev) => ({ ...prev, ...st }));
      if (st.status === 'success' && st.syncedCount) { setFlash(st.syncedCount); setTimeout(() => setFlash(0), 5000); }
    });
    const onCache = (e) => setCached(e.detail?.at || Date.now());
    const onOnline = () => setCached(null);
    window.addEventListener('gcr_offline_cache', onCache);
    window.addEventListener('online', onOnline);
    return () => { off(); window.removeEventListener('gcr_offline_cache', onCache); window.removeEventListener('online', onOnline); };
  }, []);

  const refused = s.refused || [];
  let tone = null; let icon = null; let text = null; let action = null;
  if (refused.length) {
    tone = 'bad'; icon = <AlertTriangle size={16} />;
    const r = refused[0];
    text = <><b>{r.clientName || 'A case'} was not accepted:</b> {r.error}</>;
    if (r.caseId && onOpenCase) action = <button type="button" onClick={() => onOpenCase(r.caseId)}>Fix</button>;
  } else if (s.online === false) {
    tone = 'off'; icon = <WifiOff size={16} />;
    text = <><b>No signal.</b> {s.count ? `${s.count} case${s.count > 1 ? 's' : ''} saved on this phone — ` : ''}Keep working; everything uploads when you're back online.{cached ? ` Showing cases saved ${ago(cached)}.` : ''}</>;
  } else if (s.status === 'syncing') {
    tone = 'up'; icon = <Loader2 size={16} className="spin" />; text = <b>Uploading your saved work…</b>;
  } else if (s.count) {
    tone = 'up'; icon = <CloudUpload size={16} />;
    text = <><b>{s.count} case{s.count > 1 ? 's' : ''} waiting to upload.</b> Retrying by itself.</>;
    action = <button type="button" onClick={() => syncPendingCases()}>Upload now</button>;
  } else if (flash) {
    tone = 'ok'; icon = <Check size={16} />; text = <b>{flash} saved case{flash > 1 ? 's' : ''} uploaded.</b>;
  }
  if (!tone) return null;
  return (
    <div className={`obar ${tone}`} role="status">
      {icon}<span className="obar-t">{text}</span>{action}
      <style>{`
        .obar { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 9px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.35; }
        .obar svg { flex-shrink: 0; }
        .obar-t { flex: 1; min-width: 0; }
        .obar button { flex-shrink: 0; border: 0; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 800; cursor: pointer; background: #fff; color: inherit; }
        .obar.off { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
        .obar.up { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .obar.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .obar.bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        body.dark-theme .obar { background: #1c1c1e; border-color: #3a3a3c; }
      `}</style>
    </div>
  );
}

function ago(at) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
