import { API_BASE_URL } from '../config/api';

// ----- Roles -----
// SUPER_ADMIN: every branch · ADMIN: one branch (Branch Admin) · ENGINEER: field staff
export const isSuperAdmin = (u) => u?.role === 'SUPER_ADMIN';
export const isBranchAdmin = (u) => u?.role === 'ADMIN';
export const isAdminRole = (u) => isSuperAdmin(u) || isBranchAdmin(u);
export const isBankUser = (u) => u?.role === 'BANK';
export const roleLabel = (u) => (isSuperAdmin(u) ? 'Super Admin' : isBranchAdmin(u) ? 'Branch Admin' : isBankUser(u) ? 'Bank Employee' : 'Field Engineer');

// ----- Super Admin: which branch is being viewed ('all' or a branch id) -----
const SCOPE_KEY = 'gcr_branch_scope';
export const getBranchScope = () => { try { return localStorage.getItem(SCOPE_KEY) || 'all'; } catch { return 'all'; } };
export function setBranchScope(id) {
  try { localStorage.setItem(SCOPE_KEY, id || 'all'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('gcr_branch_scope', { detail: id || 'all' }));
}

const currentUser = () => { try { return JSON.parse(localStorage.getItem('sbi_valuation_current_user_v3') || 'null'); } catch { return null; } };

// Every request to our API carries the login token (and, for the Super Admin, the branch
// being viewed), so the server can return only what this person is allowed to see.
// The phone's brand, model and name (Capacitor Device plugin, phone app only), read once at start and
// sent with requests so the Super Admin's device list shows e.g. "Samsung Galaxy A14 5G" instead of a code.
let deviceHeader = '';
function readDeviceInfo() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  import('@capacitor/device').then(({ Device }) => Device.getInfo()).then((d) => {
    const clean = (v) => String(v || '').replace(/[|\r\n]/g, ' ').trim().slice(0, 60);
    deviceHeader = encodeURIComponent([clean(d.manufacturer), clean(d.model), clean(d.name), clean(d.osVersion)].join('|'));
  }).catch(() => {});
}

// A lasting id for this phone / computer (kept in the app's storage). A sign-in from a device the
// Super Admin hasn't approved yet waits for approval; an approved device signs in normally.
const DEVICE_ID_KEY = 'gcr_device_id';
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '');
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch { return ''; }
}

export function installApiAuth() {
  if (typeof window === 'undefined' || window.__gcrFetchPatched) return;
  window.__gcrFetchPatched = true;
  readDeviceInfo();
  const original = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.startsWith(API_BASE_URL)) return original(input, init);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    const token = localStorage.getItem('token');
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const u = currentUser();
    if (u?.id && !headers.has('x-user-id')) headers.set('x-user-id', u.id);
    if (isSuperAdmin(u) && !headers.has('x-branch-scope')) headers.set('x-branch-scope', getBranchScope());
    // Which app this is (for the Super Admin's list of signed-in devices)
    if (!headers.has('x-client')) {
      const cap = window.Capacitor;
      headers.set('x-client', cap?.isNativePlatform?.() ? `app-${cap.getPlatform?.() || 'mobile'}` : 'web');
    }
    if (deviceHeader && !headers.has('x-device')) headers.set('x-device', deviceHeader);
    const deviceId = getDeviceId();
    if (deviceId && !headers.has('x-device-id')) headers.set('x-device-id', deviceId);
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const cacheKey = method === 'GET' && offlineCacheable(url) ? `apiCache:${u?.id || 'anon'}:${url.slice(API_BASE_URL.length)}` : null;
    // A device the Super Admin signed out: tell the app, which returns to the login screen.
    // No connection (no signal, or the server is restarting) → a plain message instead of the browser's "Failed to fetch".
    const p = original(input, { ...init, headers }).catch((err) => {
      if (!err || err.name === 'AbortError' || err.name === 'TimeoutError') throw err;
      const e = new TypeError(typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'No internet connection. Please check your signal and try again.'
        : 'Can’t reach the Gouru server right now. Please try again in a moment.');
      e.cause = err;
      throw e;
    }).then((res) => {
      if (res.status === 401 && token) {
        res.clone().json().then((j) => { if (j && j.code === 'SIGNED_OUT') window.dispatchEvent(new CustomEvent('gcr_signed_out')); }).catch(() => {});
      }
      return res;
    });
    if (!cacheKey) return p;
    // Keep the last answer on the phone; with no signal, serve it instead of failing
    return p.then((res) => {
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
        res.clone().text().then((text) => {
          if (text.length < 8 * 1024 * 1024) offlineStore().then((st) => st.setItem(cacheKey, { text, at: Date.now() })).catch(() => {});
        }).catch(() => {});
      }
      return res;
    }, async (err) => {
      try {
        const st = await offlineStore();
        const hit = await st.getItem(cacheKey);
        if (hit && hit.text) {
          window.dispatchEvent(new CustomEvent('gcr_offline_cache', { detail: { at: hit.at } }));
          return new Response(hit.text, { status: 200, headers: { 'Content-Type': 'application/json', 'X-Offline-Cache': String(hit.at) } });
        }
      } catch { /* no saved copy */ }
      throw err;
    });
  };
}

// What an engineer needs at a site with no signal: their cases, a case's details, attendance, banks, settings
const OFFLINE_PATHS = [/\/api\/cases(\?|$)/, /\/api\/cases\/[^/?]+(\?|$)/, /\/api\/attendance(\?|$)/, /\/api\/banks(\?|$)/, /\/api\/auth\/me(\?|$)/, /\/api\/config(\?|$)/];
const offlineCacheable = (url) => OFFLINE_PATHS.some((r) => r.test(url.slice(API_BASE_URL.length).split('#')[0]));
let storePromise = null;
function offlineStore() {
  if (!storePromise) storePromise = import('localforage').then((m) => m.default.createInstance({ name: 'gcr', storeName: 'apiCache' }));
  return storePromise;
}

/** Remove saved copies (on logout, so the next person on this phone sees nothing) */
export async function clearOfflineCache() {
  try { const st = await offlineStore(); await st.clear(); } catch { /* ignore */ }
}
