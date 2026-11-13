import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation } from '../../utils/backgroundGeolocation';
import { API_BASE_URL } from '../../config/api';

// Sends the live position of engineers and branch admins to the server.
//
// - Phone app: ALWAYS on (24/7), on or off duty — company policy the person agreed to at
//   first sign-in. There is no switch in the app to stop it. If the phone's location is
//   turned off or the permission removed, the office is alerted at once.
// - Web (browser): engineers only, while on duty.
//
// - Phone app: uses the background-geolocation plugin, so tracking continues
//   with the screen off, and resumes automatically if the app restarts.
// - Web: uses the browser's geolocation while the page is open.
// - Throttled: sends when moved ≥ 20 m (at most every 15 s), plus a heartbeat
//   every 2 minutes when standing still, so the admin sees "updated just now".
// - Stops immediately on Clock-Out (AttendanceView dispatches 'gcr_duty_changed').


const MIN_INTERVAL_MS = 15 * 1000;          // on duty
const HEARTBEAT_MS = 2 * 60 * 1000;
const OFF_DUTY_MIN_INTERVAL_MS = 60 * 1000;  // off duty: gentler on the battery
const OFF_DUTY_HEARTBEAT_MS = 5 * 60 * 1000;
const MIN_MOVE_M = 20;
const DUTY_RECHECK_MS = 60 * 1000;

const localYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const metersBetween = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function isOnDuty(userId) {
  const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${encodeURIComponent(userId)}&date=${localYMD(new Date())}`);
  if (!res.ok) return false;
  const rows = await res.json();
  const last = (Array.isArray(rows) ? rows : [])
    .filter((r) => r.attendanceType === 'Clock-In' || r.attendanceType === 'Clock-Out')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  return last?.attendanceType === 'Clock-In';
}

export default function LiveLocationReporter({ currentUser }) {
  const watcher = useRef(null); // { kind: 'native' | 'web', id }
  const lastSent = useRef(null); // { lat, lng, at }
  const latest = useRef(null);   // most recent fix, used by the heartbeat
  const locOff = useRef(false);  // location switched off / denied while on duty
  const [showOff, setShowOff] = useState(false);
  const native = Capacitor.isNativePlatform?.();

  useEffect(() => {
    const role = currentUser?.role;
    if (!currentUser?.id || !['ENGINEER', 'ADMIN'].includes(role)) return undefined;
    if (!native && role !== 'ENGINEER') return undefined;
    const always = native; // phone app: 24/7
    let cancelled = false;
    const onDutyNow = { current: false };

    const ping = (body) => fetch(`${API_BASE_URL}/api/live/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, platform: Capacitor.getPlatform?.() || 'web' }),
    });
    const report = (type) => ping({ state: type === 'Location Off' ? 'off' : 'on' }).catch(() => {});

    // Location turned off (or permission removed) while on duty → record it, alert the admin
    // (server side), and show the engineer a bar to turn it back on.
    const markOff = () => {
      if (locOff.current || !watcher.current) return;
      locOff.current = true;
      setShowOff(true);
      report('Location Off');
    };
    const markOn = () => {
      if (!locOff.current) return;
      locOff.current = false;
      setShowOff(false);
      report('Location On');
    };

    const send = (fix, force = false) => {
      const now = Date.now();
      const prev = lastSent.current;
      if (!force && prev) {
        const moved = metersBetween(prev, fix);
        const since = now - prev.at;
        const duty = onDutyNow.current;
        if (since < (duty ? MIN_INTERVAL_MS : OFF_DUTY_MIN_INTERVAL_MS)) return;
        if (moved < MIN_MOVE_M && since < (duty ? HEARTBEAT_MS : OFF_DUTY_HEARTBEAT_MS)) return;
      }
      lastSent.current = { ...fix, at: now };
      ping({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
        .then((r) => { if (!r.ok) lastSent.current = prev; })
        .catch(() => { lastSent.current = prev; }); // retry on next fix
    };

    const onFix = (lat, lng, accuracy) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      markOn();
      latest.current = { lat, lng, accuracy };
      send(latest.current);
    };

    const start = async () => {
      if (watcher.current) return;
      if (native) {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Your location is shared with the Gouru office.',
            backgroundTitle: 'Gouru Valuations — Location sharing',
            requestPermissions: true,
            stale: false,
            distanceFilter: MIN_MOVE_M,
          },
          (loc, err) => {
            if (err) { if (err.code === 'NOT_AUTHORIZED') markOff(); return; }
            if (loc) onFix(loc.latitude, loc.longitude, loc.accuracy);
          },
        );
        watcher.current = { kind: 'native', id };
      } else if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (p) => onFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
          (e) => { if (e.code === 1 || e.code === 2) markOff(); }, // denied / location services off
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
        );
        watcher.current = { kind: 'web', id };
      }
    };

    const stop = () => {
      const w = watcher.current;
      if (!w) return;
      if (w.kind === 'native') BackgroundGeolocation.removeWatcher({ id: w.id }).catch(() => {});
      else navigator.geolocation?.clearWatch(w.id);
      watcher.current = null;
      lastSent.current = null;
      latest.current = null;
      locOff.current = false;
      setShowOff(false);
    };

    const sync = async () => {
      try {
        const onDuty = role === 'ENGINEER' ? await isOnDuty(currentUser.id) : false;
        if (cancelled) return;
        onDutyNow.current = onDuty;
        if (always || onDuty) await start();
        else stop();
      } catch { /* offline: keep current state */ }
    };

    // Heartbeat while standing still
    const heartbeat = setInterval(() => {
      if (watcher.current && latest.current && !locOff.current) send(latest.current);
    }, 60 * 1000);

    sync();
    const recheck = setInterval(sync, DUTY_RECHECK_MS);
    const onDutyChanged = () => { lastSent.current = null; sync(); };
    // Coming back to the app: send a fresh position straight away
    const onVisible = () => { if (!document.hidden && latest.current) { lastSent.current = null; send(latest.current); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('gcr_duty_changed', onDutyChanged);

    return () => {
      cancelled = true;
      clearInterval(recheck);
      clearInterval(heartbeat);
      window.removeEventListener('gcr_duty_changed', onDutyChanged);
      document.removeEventListener('visibilitychange', onVisible);
      stop();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.name, currentUser?.username]);

  if (!showOff) return null;
  const turnOn = () => {
    if (native) BackgroundGeolocation.openSettings?.().catch(() => {});
    else window.dispatchEvent(new Event('gcr_open_permissions'));
  };
  return (
    <div role="alert" style={{
      position: 'fixed', left: 12, right: 12, top: 'calc(env(safe-area-inset-top, 0px) + 66px)', zIndex: 10020,
      background: '#ff3b30', color: '#fff', borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 24px rgba(255,59,48,.35)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Location is off</div>
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.35 }}>Location must stay on at all times. The office has been notified — please turn it back on.</div>
      </div>
      <button onClick={turnOn} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: '#fff', color: '#ff3b30', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Turn On
      </button>
    </div>
  );
}
