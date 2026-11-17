import { API_BASE_URL } from '../config/api';
import { pendingAttendance } from '../services/offlineSyncService';
import askConfirm from '../components/Shared/askConfirm';

// Is this engineer checked in? The latest Check-In / Check-Out decides, counting check-ins
// saved on the phone with no signal. With no signal and nothing saved, field work isn't blocked.
export async function isOnDuty(userId) {
  const waiting = await pendingAttendance().catch(() => []);
  let server = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${encodeURIComponent(userId || '')}`);
    const data = await res.json();
    server = Array.isArray(data) ? data : [];
  } catch {
    if (typeof navigator !== 'undefined' && navigator.onLine === false && !waiting.length) return true;
  }
  const last = [...server, ...waiting.filter((w) => w.userId === userId)]
    .filter((l) => l.attendanceType === 'Clock-In' || l.attendanceType === 'Clock-Out')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  return last?.attendanceType === 'Clock-In';
}

let asking = null; // one sheet at a time, however many taps
/** true when checked in; otherwise shows "Check in first" with a Go to Today button. */
export async function ensureCheckedIn(userId) {
  if (await isOnDuty(userId)) return true;
  if (!asking) {
    asking = askConfirm({
      title: 'Check in first',
      message: 'You are not checked in today. Check in on the Today tab (selfie + location), then open the case.',
      confirmText: 'Go to Today',
      cancelText: 'Not now',
    }).then((go) => {
      if (go) window.dispatchEvent(new CustomEvent('gcr_quick_action', { detail: { action: 'attendance' } }));
    }).finally(() => { asking = null; });
  }
  return false;
}
