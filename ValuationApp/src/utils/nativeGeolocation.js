import { Capacitor } from '@capacitor/core';

/**
 * On iPhone the in-app browser asks "localhost would like to use your current location" on its own.
 * Route navigator.geolocation through the native plugin instead (one proper iOS prompt with the app's name).
 */
export function installNativeGeolocation() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios' || !navigator.geolocation) return;
  let mod = null;
  const plugin = () => (mod ? Promise.resolve(mod) : import('@capacitor/geolocation').then((m) => (mod = m.Geolocation)));
  const toPosition = (p) => ({
    coords: {
      latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy,
      altitude: p.coords.altitude ?? null, altitudeAccuracy: p.coords.altitudeAccuracy ?? null,
      heading: p.coords.heading ?? null, speed: p.coords.speed ?? null,
    },
    timestamp: p.timestamp || Date.now(),
  });
  const toError = (e) => {
    const msg = String((e && e.message) || e || '');
    const denied = /denied|permission|not authorized|disabled/i.test(msg);
    return { code: denied ? 1 : /timeout/i.test(msg) ? 3 : 2, message: msg, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  };
  const opts = (o = {}) => ({ enableHighAccuracy: !!o.enableHighAccuracy, timeout: o.timeout ?? 20000, maximumAge: o.maximumAge ?? 0 });
  const watches = new Map();
  let nextId = 1;
  const geo = {
    getCurrentPosition(ok, fail, o) {
      plugin().then((G) => G.getCurrentPosition(opts(o))).then((p) => ok && ok(toPosition(p))).catch((e) => fail && fail(toError(e)));
    },
    watchPosition(ok, fail, o) {
      const id = nextId++;
      plugin().then((G) => G.watchPosition(opts(o), (p, err) => {
        if (err) { if (fail) fail(toError(err)); return; }
        if (p && ok) ok(toPosition(p));
      })).then((nativeId) => { if (watches.has(id)) watches.set(id, nativeId); else plugin().then((G) => G.clearWatch({ id: nativeId })); });
      watches.set(id, null);
      return id;
    },
    clearWatch(id) {
      const nativeId = watches.get(id);
      watches.delete(id);
      if (nativeId) plugin().then((G) => G.clearWatch({ id: nativeId })).catch(() => {});
    },
  };
  try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch { /* read-only: keep the browser's */ }
}
