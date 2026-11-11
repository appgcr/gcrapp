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
    return original(input, { ...init, headers });
  };
}
