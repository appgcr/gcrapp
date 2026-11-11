import localforage from 'localforage';
import { API_BASE_URL } from '../config/api';

const OFFLINE_QUEUE_KEY = 'gcr_offline_sync_queue_v1';

let isSyncing = false;
const listeners = new Set();

export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(status) {
  listeners.forEach(fn => fn(status));
}

/**
 * Queue a completed or draft case locally when network is unavailable
 */
export async function queueOfflineCase(payload, editingCaseId = null) {
  try {
    const queue = (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
    const syncId = payload.offlineSyncId || `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const queueItem = {
      syncId,
      editingCaseId,
      payload: {
        ...payload,
        offlineSyncId: syncId,
        offlineSavedAt: new Date().toISOString()
      },
      status: 'pending', // 'pending', 'syncing', 'failed'
      error: null,
      queuedAt: new Date().toISOString()
    };

    // Replace if same syncId exists, else push
    const existingIndex = queue.findIndex(q => q.syncId === syncId || (editingCaseId && q.editingCaseId === editingCaseId));
    if (existingIndex >= 0) {
      queue[existingIndex] = queueItem;
    } else {
      queue.push(queueItem);
    }

    await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
    notifyListeners({ status: 'queued', count: queue.length });
    return queueItem;
  } catch (err) {
    console.error('Failed to queue case offline:', err);
    throw err;
  }
}

/**
 * Get all pending offline items
 */
export async function getPendingOfflineQueue() {
  return (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
}

/**
 * Sync all queued offline cases to the server
 */
export async function syncPendingCases() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;
  notifyListeners({ status: 'syncing' });

  try {
    const queue = (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
    if (queue.length === 0) {
      isSyncing = false;
      notifyListeners({ status: 'idle', count: 0 });
      return;
    }

    const remaining = [];
    const synced = [];

    for (const item of queue) {
      try {
        let response;
        if (item.editingCaseId) {
          response = await fetch(`${API_BASE_URL}/api/cases/${item.editingCaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
        } else {
          response = await fetch(`${API_BASE_URL}/api/cases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
        }

        if (response.ok) {
          synced.push(item);
        } else {
          item.status = 'failed';
          item.error = `HTTP ${response.status}`;
          remaining.push(item);
        }
      } catch (networkErr) {
        item.status = 'failed';
        item.error = networkErr.message;
        remaining.push(item);
      }
    }

    await localforage.setItem(OFFLINE_QUEUE_KEY, remaining);
    notifyListeners({
      status: remaining.length === 0 ? 'success' : 'partial_failure',
      count: remaining.length,
      syncedCount: synced.length
    });
  } catch (err) {
    console.error('Offline sync error:', err);
    notifyListeners({ status: 'error', error: err.message });
  } finally {
    isSyncing = false;
  }
}

// Automatically trigger sync when network comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingCases().catch(() => {});
  });
}
