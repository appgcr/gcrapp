import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation } from '../../utils/backgroundGeolocation';
import { API_BASE_URL } from '../../config/api';
import { isAdminRole } from '../../utils/session';

// Sends the engineer's live position to the server while they are on duty
// (checked in and not yet checked out today), so the admin Live Field Map is real-time.
//
// - Phone app: uses the background-geolocation plugin, so tracking continues
//   with the screen off, and resumes automatically if the app restarts.
// - Web: uses the browser's geolocation while the page is open.
// - Throttled: sends when moved ≥ 20 m (at most every 15 s), plus a heartbeat
//   every 2 minutes when standing still, so the admin sees "updated just now".
// - Stops immediately on Clock-Out (AttendanceView dispatches 'gcr_duty_changed').


const MIN_INTERVAL_MS = 15 * 1000;
const HEARTBEAT_MS = 2 * 60 * 1000;
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
    if (!currentUser?.id || isAdminRole(currentUser)) return undefined;
    let cancelled = false;

    const report = (type) => fetch(`${API_BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, name: currentUser.name || currentUser.username || currentUser.id, attendanceType: type }),
    }).catch(() => {});

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
        if (since < MIN_INTERVAL_MS) return;
        if (moved < MIN_MOVE_M && since < HEARTBEAT_MS) return;
      }
      lastSent.current = { ...fix, at: now };
      fetch(`${API_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: currentUser.name || currentUser.username || currentUser.id,
          lat: String(fix.lat),
          lng: String(fix.lng),
          accuracy: fix.accuracy,
          attendanceType: 'Location Update',
          status: 'Background',
        }),
      }).catch(() => { lastSent.current = prev; }); // retry on next fix
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
            backgroundMessage: 'Sharing your location with GCR while you are on duty.',
            backgroundTitle: 'GCR — On duty',
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
        const onDuty = await isOnDuty(currentUser.id);
        if (cancelled) return;
        if (onDuty) await start();
        else stop();
      } catch { /* offline: keep current state */ }
    };

    // Heartbeat while standing still
    const heartbeat = setInterval(() => {
      if (watcher.current && latest.current && !locOff.current) send(latest.current);
    }, HEARTBEAT_MS);

    sync();
    const recheck = setInterval(sync, DUTY_RECHECK_MS);
    const onDutyChanged = () => { lastSent.current = null; sync(); };
    window.addEventListener('gcr_duty_changed', onDutyChanged);

    return () => {
      cancelled = true;
      clearInterval(recheck);
      clearInterval(heartbeat);
      window.removeEventListener('gcr_duty_changed', onDutyChanged);
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
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.35 }}>You’re on duty — turn it back on. Your admin has been notified.</div>
      </div>
      <button onClick={turnOn} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: '#fff', color: '#ff3b30', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Turn On
      </button>
    </div>
  );
}
