// Headers for protected API calls: the saved login token, plus the signed-in user id
// (the backend's development fallback for sessions that started before the token was saved).
export function authHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('token');
  if (token) h.Authorization = `Bearer ${token}`;
  try {
    const user = JSON.parse(localStorage.getItem('sbi_valuation_current_user_v3') || 'null');
    if (user?.id) h['x-user-id'] = user.id;
  } catch { /* ignore */ }
  return h;
}

// Read a JSON error message from a failed response
export async function errorFrom(res, fallback = 'Request failed') {
  try {
    const d = await res.json();
    return d.error || d.details || fallback;
  } catch {
    return fallback;
  }
}
