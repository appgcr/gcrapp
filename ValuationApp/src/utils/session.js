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
export function installApiAuth() {
  if (typeof window === 'undefined' || window.__gcrFetchPatched) return;
  window.__gcrFetchPatched = true;
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
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const cacheKey = method === 'GET' && offlineCacheable(url) ? `apiCache:${u?.id || 'anon'}:${url.slice(API_BASE_URL.length)}` : null;
    const p = original(input, { ...init, headers });
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
