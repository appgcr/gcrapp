import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Camera, Bell, Check, Loader2, ShieldCheck, BatteryCharging } from 'lucide-react';
import { BackgroundGeolocation } from '../../utils/backgroundGeolocation';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import IconTile from '../Shared/IconTile';
import PermissionsHeroIcon from './PermissionsHeroIcon';
import './LoginScreen.css';
import { isAdminRole } from '../../utils/session';

// "Allow access" screen shown once after first sign-in (and from Settings → App Permissions).
// Each permission is explained before the system prompt appears, which is what Apple and
// Google review expect, and what makes people actually tap Allow.

const doneKey = (userId) => `gcr_perm_setup_v1_${userId}`;
export const permissionsSetupDone = (userId) => {
  try { return localStorage.getItem(doneKey(userId)) === '1'; } catch { return true; }
};
const markDone = (userId) => { try { localStorage.setItem(doneKey(userId), '1'); } catch { /* ignore */ } };

const isNative = () => Capacitor.isNativePlatform?.();

const ITEMS = {
  location: {
    icon: MapPin, color: 'green', title: 'Location',
    why: 'Mark attendance at the site and share your location with the office at all times (24/7).',
  },
  camera: {
    icon: Camera, color: 'gray', title: 'Camera',
    why: 'Take site photos for reports and your selfie when you check in.',
  },
  notifications: {
    icon: Bell, color: 'red', title: 'Notifications',
    why: 'Get alerts for new cases, reports sent back, approvals and reminders.',
  },
  // Android phones (Xiaomi, Oppo, Vivo, Samsung…) stop background apps to save battery,
  // which would stop location sharing during duty. Can't be checked — the user confirms.
  battery: {
    icon: BatteryCharging, color: 'orange', title: 'Battery',
    why: 'Set Gouru Valuations to “Unrestricted” / “No restrictions” so your phone doesn’t stop location sharing.',
  },
};

async function queryBrowser(name) {
  try {
    const r = await navigator.permissions?.query({ name });
    return r?.state || 'prompt'; // granted | denied | prompt
  } catch { return 'prompt'; }
}

async function check(kind) {
  if (kind === 'battery') { try { return localStorage.getItem('gcr_battery_ok') === '1' ? 'granted' : 'prompt'; } catch { return 'prompt'; } }
  if (kind === 'notifications') {
    if (isNative()) {
      const p = await PushNotifications.checkPermissions();
      return p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'prompt';
    }
    if (!('Notification' in window)) return 'unavailable';
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }
  if (kind === 'location') return navigator.geolocation ? queryBrowser('geolocation') : 'unavailable';
  if (kind === 'camera') return navigator.mediaDevices?.getUserMedia ? queryBrowser('camera') : 'unavailable';
  return 'prompt';
}

async function request(kind) {
  if (kind === 'battery') {
    // Opens Gouru's app settings → Battery. We can't read the setting back, so we trust the tap.
    try { await BackgroundGeolocation.openSettings(); } catch { /* ignore */ }
    try { localStorage.setItem('gcr_battery_ok', '1'); } catch { /* ignore */ }
    return 'granted';
  }
  if (kind === 'notifications') {
    if (isNative()) {
      const p = await PushNotifications.requestPermissions();
      return p.receive === 'granted' ? 'granted' : 'denied';
    }
    const r = await Notification.requestPermission();
    return r === 'default' ? 'prompt' : r;
  }
  if (kind === 'location') {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (err) => resolve(err.code === 1 ? 'denied' : 'granted'), // timeout / no GPS fix still means allowed
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
      );
    });
  }
  if (kind === 'camera') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (err) {
      if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'unavailable';
      return 'denied';
    }
  }
  return 'prompt';
}

export default function PermissionsSetup({ currentUser, onDone, fromSettings = false }) {
  const kinds = isAdminRole(currentUser)
    ? ['notifications']
    : ['location', 'camera', 'notifications', ...(isNative() && Capacitor.getPlatform() === 'android' ? ['battery'] : [])];
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    const next = {};
    for (const k of kinds) next[k] = await check(k).catch(() => 'prompt');
    setState(next);
  }, [kinds.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  const allow = async (kind) => {
    setBusy(kind);
    const result = await request(kind).catch(() => 'denied');
    setState((s) => ({ ...s, [kind]: result }));
    setBusy(null);
    if (kind === 'notifications' && result === 'granted') window.dispatchEvent(new Event('gcr_push_permission'));
  };

  const finish = () => { markDone(currentUser.id); onDone?.(); };
  const allGranted = kinds.every((k) => state[k] === 'granted' || state[k] === 'unavailable');

  return (
    <div className="lg-root ps-root">
      <main className="lg-main">
        <div className="lg-form-wrap ps-wrap">
          <header className="lg-head">
            <div className="ps-hero"><PermissionsHeroIcon size={132} /></div>
            <h2>{fromSettings ? 'App Permissions' : 'Allow access'}</h2>
            <p className="ps-sub">
              {isAdminRole(currentUser)
                ? 'Turn on alerts so you know the moment a report is ready for review.'
                : 'Gouru Valuations needs these to work in the field. You can change them anytime in Settings.'}
            </p>
          </header>

          <div className="lg-group ps-list">
            {kinds.map((k) => {
              const it = ITEMS[k];
              const st = state[k];
              return (
                <div className="ps-item" key={k}>
                  <IconTile icon={it.icon} color={it.color} size={36} />
                  <div className="ps-text">
                    <div className="ps-title">{it.title}</div>
                    <div className="ps-why">{it.why}</div>
                    {st === 'denied' && (
                      <div className="ps-blocked">
                        {isNative()
                          ? 'Blocked — turn it on in your phone’s Settings → Gouru Valuations.'
                          : 'Blocked — tap the lock icon in the address bar and allow it for this site.'}
                      </div>
                    )}
                  </div>
                  <div className="ps-act">
                    {st === 'granted' ? (
                      <span className="ps-ok" aria-label="Allowed"><Check size={16} strokeWidth={3} /></span>
                    ) : st === 'unavailable' ? (
                      <span className="ps-na">Not available</span>
                    ) : st === 'denied' ? (
                      <span className="ps-na">Off</span>
                    ) : (
                      <button className="ps-allow" onClick={() => allow(k)} disabled={!!busy || st === undefined}>
                        {busy === k ? <Loader2 size={14} className="spin" /> : (k === 'battery' ? 'Open' : 'Allow')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="ps-privacy">Your location is shared with the office 24/7, as you agreed. Photos are used only in your valuation reports.</p>

          <button className="lg-primary" onClick={finish}>{allGranted || fromSettings ? 'Done' : 'Continue'}</button>
          {!allGranted && !fromSettings && <button className="lg-link ps-later" onClick={finish}>Set up later</button>}
        </div>
      </main>
      <style>{`
        .ps-root { position: fixed; inset: 0; z-index: 10050; overflow-y: auto; }
        .ps-wrap { max-width: 420px; }
        .ps-hero { display: flex; justify-content: center; margin: 0 auto 10px; animation: psHeroIn .6s cubic-bezier(.2,.9,.25,1) both; }
        @keyframes psHeroIn { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ps-hero { animation: none; } }
        .ps-sub { white-space: normal !important; line-height: 1.4; }
        .ps-list { margin-bottom: 12px; }
        .ps-item { display: flex; align-items: flex-start; gap: 14px; padding: 14px 14px 14px 16px; position: relative; }
        .ps-item + .ps-item::before { content: ''; position: absolute; top: 0; left: 66px; right: 0; height: .5px; background: var(--lg-sep); }
        .ps-text { flex: 1; min-width: 0; }
        .ps-title { font-size: 16px; font-weight: 600; color: var(--lg-text); margin-bottom: 2px; }
        .ps-why { font-size: 13px; line-height: 1.38; color: var(--lg-sub); }
        .ps-blocked { margin-top: 6px; font-size: 12px; color: var(--lg-red); line-height: 1.35; }
        .ps-act { flex: none; align-self: center; }
        .ps-allow { min-width: 68px; height: 30px; padding: 0 14px; border: none; border-radius: 15px; background: var(--lg-fill); color: var(--lg-accent); font: inherit; font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .ps-allow:disabled { opacity: .6; }
        .ps-ok { width: 26px; height: 26px; border-radius: 50%; background: #34c759; color: #fff; display: inline-flex; align-items: center; justify-content: center; animation: psPop .3s cubic-bezier(.3,1.6,.5,1); }
        .ps-na { font-size: 14px; color: var(--lg-hint); }
        .ps-privacy { font-size: 12px; line-height: 1.4; color: var(--lg-hint); text-align: center; margin: 0 8px 22px; }
        .ps-later { display: block; margin: 10px auto 0; font-weight: 500; }
        @keyframes psPop { from { transform: scale(.4); } to { transform: none; } }
      `}</style>
    </div>
  );
}
