import localforage from 'localforage';
import { API_BASE_URL } from '../config/api';

/**
 * Cases finished with no signal wait here (on the phone) and upload by themselves:
 * when the app opens, when the phone is back online, when the app comes to the front,
 * and every 45 seconds while something is waiting.
 * The form's draft stays on the phone until the upload succeeds, so nothing is lost.
 * If the server refuses a case (e.g. a document is missing), it is kept as "needs fixing"
 * with the reason — reopening the case restores everything to correct and submit again.
 */

const OFFLINE_QUEUE_KEY = 'gcr_offline_sync_queue_v1';
const RETRY_MS = 45 * 1000;

let isSyncing = false;
const listeners = new Set();
let lastStatus = { status: 'idle', count: 0, refused: [] };

export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  listener(lastStatus);
  return () => listeners.delete(listener);
}

function notifyListeners(status) {
  lastStatus = { ...lastStatus, ...status };
  listeners.forEach(fn => fn(lastStatus));
}

async function readQueue() {
  return (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
}

async function publishCounts(extra = {}) {
  const q = await readQueue();
  notifyListeners({
    count: q.filter(i => i.status !== 'refused').length,
    refused: q.filter(i => i.status === 'refused').map(i => ({ syncId: i.syncId, caseId: i.editingCaseId, clientName: i.payload?.clientName, error: i.error })),
    ...extra,
  });
}

/** Queue a case to upload when there is signal */
export async function queueOfflineCase(payload, editingCaseId = null, draftKey = null) {
  const queue = await readQueue();
  const syncId = payload.offlineSyncId || `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const queueItem = {
    syncId,
    editingCaseId,
    draftKey,
    payload: { ...payload, offlineSyncId: syncId, offlineSavedAt: new Date().toISOString() },
    status: 'pending',
    error: null,
    tries: 0,
    queuedAt: new Date().toISOString(),
  };
  const i = queue.findIndex(q => q.syncId === syncId || (editingCaseId && q.editingCaseId === editingCaseId));
  if (i >= 0) queue[i] = queueItem; else queue.push(queueItem);
  await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
  await publishCounts({ status: 'queued' });
  scheduleRetry();
  return queueItem;
}

export async function getPendingOfflineQueue() {
  return readQueue();
}

/** Is this case waiting to upload (or refused)? → queue item or null */
export async function queuedItemFor(caseId) {
  const q = await readQueue();
  return q.find(i => i.editingCaseId && String(i.editingCaseId) === String(caseId)) || null;
}

/** Forget a refused item (the engineer opened the case to fix it) */
export async function dropQueued(syncId) {
  const q = await readQueue();
  await localforage.setItem(OFFLINE_QUEUE_KEY, q.filter(i => i.syncId !== syncId));
  await publishCounts();
}

/** Upload every waiting case */
export async function syncPendingCases() {
  if (isSyncing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const queue = await readQueue();
  const todo = queue.filter(i => i.status !== 'refused');
  if (!todo.length) { await publishCounts({ status: 'idle' }); return; }
  isSyncing = true;
  notifyListeners({ status: 'syncing' });
  let synced = 0;
  try {
    for (const item of todo) {
      try {
        const res = await fetch(item.editingCaseId ? `${API_BASE_URL}/api/cases/${item.editingCaseId}` : `${API_BASE_URL}/api/cases`, {
          method: item.editingCaseId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          item.status = 'done';
          synced += 1;
          if (item.draftKey) await localforage.removeItem(item.draftKey).catch(() => {});
        } else if (res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status)) {
          // The server looked at it and said no — retrying will not help; the engineer must fix it
          const d = await res.json().catch(() => ({}));
          item.status = 'refused';
          item.error = d.details || d.error || `The server refused this case (${res.status}).`;
        } else {
          item.status = 'pending'; item.tries = (item.tries || 0) + 1; item.error = `Server busy (${res.status}). Will retry.`;
        }
      } catch (networkErr) {
        item.status = 'pending'; item.tries = (item.tries || 0) + 1; item.error = 'No signal. Will retry.';
      }
    }
    // Keep everything not uploaded (and anything queued meanwhile)
    const latest = await readQueue();
    const doneIds = new Set(todo.filter(i => i.status === 'done').map(i => i.syncId));
    const byId = new Map(todo.map(i => [i.syncId, i]));
    const next = latest.filter(i => !doneIds.has(i.syncId)).map(i => byId.get(i.syncId) || i);
    await localforage.setItem(OFFLINE_QUEUE_KEY, next);
    if (synced) window.dispatchEvent(new CustomEvent('gcr_cases_changed'));
    await publishCounts({ status: synced && !next.some(i => i.status === 'pending') ? 'success' : next.length ? 'waiting' : 'idle', syncedCount: synced });
  } catch (err) {
    notifyListeners({ status: 'error', error: err.message });
  } finally {
    isSyncing = false;
    scheduleRetry();
  }
}

let retryTimer = null;
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const q = await readQueue();
    if (q.some(i => i.status === 'pending')) { await syncPendingCases(); }
  }, RETRY_MS);
}

let started = false;
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { notifyListeners({ online: true }); syncPendingCases().catch(() => {}); });
  window.addEventListener('offline', () => notifyListeners({ online: false }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncPendingCases().catch(() => {}); });
  notifyListeners({ online: navigator.onLine !== false });
  setTimeout(() => syncPendingCases().catch(() => {}), 3000);
}
