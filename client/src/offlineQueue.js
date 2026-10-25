// client/src/offlineQueue.js
/**
 * Offline Injection Queue Manager for InsuMinder
 * Handles client-side queue persistence in localStorage,
 * optimistic UI integration, and automatic background synchronization.
 */

const OFFLINE_QUEUE_KEY = 'insuminder_offline_queue';

export function getOfflineQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[OfflineQueue] Failed to parse offline queue:', e);
    return [];
  }
}

export function saveOfflineQueue(queue) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Failed to save offline queue:', e);
  }
}

export function enqueueOfflineInjection({ type = 'bolus', delivery_method = 'pen', injected_at = null, manual = false, date = null, time = null }) {
  const queue = getOfflineQueue();
  const nowIso = injected_at || new Date().toISOString();
  const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const item = {
    tempId,
    type: type === 'basal' ? 'basal' : 'bolus',
    delivery_method: delivery_method === 'pump' ? 'pump' : 'pen',
    injected_at: nowIso,
    created_at: new Date().toISOString(),
    manual: Boolean(manual),
    date,
    time,
    sync_attempts: 0
  };

  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeOfflineInjection(tempId) {
  const queue = getOfflineQueue();
  const updated = queue.filter(item => item.tempId !== tempId);
  saveOfflineQueue(updated);
  return updated;
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (e) {
    console.error('[OfflineQueue] Failed to clear offline queue:', e);
  }
}

export async function syncOfflineQueue(authHeaders, onSingleSuccess = null) {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const res = await fetch('/api/injections', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: item.type,
          delivery_method: item.delivery_method,
          injected_at: item.injected_at,
          manual: item.manual,
          date: item.date,
          time: item.time,
          is_offline_sync: true
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        syncedCount++;
        if (typeof onSingleSuccess === 'function') {
          onSingleSuccess(item, data);
        }
      } else if (res.status === 409 || (data.error && /already appears|already recorded/i.test(data.error))) {
        // Injection was already recorded on the server previously; safely dequeue
        syncedCount++;
        if (typeof onSingleSuccess === 'function') {
          onSingleSuccess(item, { ...data, duplicate: true });
        }
      } else {
        // Validation rejection or server issue
        console.warn('[OfflineQueue] Server rejected offline item:', data.error);
        item.sync_attempts = (item.sync_attempts || 0) + 1;
        if (res.status === 400 && data.error && /not allowed|older than 1 month/i.test(data.error)) {
          console.warn('[OfflineQueue] Dropping unrecoverable offline item:', item);
        } else {
          remaining.push(item);
        }
      }
    } catch (networkErr) {
      console.warn('[OfflineQueue] Network error during sync, preserving queue:', networkErr);
      remaining.push(item);
      break;
    }
  }

  saveOfflineQueue(remaining);
  return { syncedCount, remainingCount: remaining.length };
}

export function registerOfflineSyncListeners(onOnlineTrigger) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    if (typeof onOnlineTrigger === 'function') {
      onOnlineTrigger();
    }
  };

  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

