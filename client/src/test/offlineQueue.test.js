import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOfflineQueue,
  saveOfflineQueue,
  enqueueOfflineInjection,
  removeOfflineInjection,
  clearOfflineQueue,
  syncOfflineQueue,
  registerOfflineSyncListeners
} from '../offlineQueue';

describe('Offline Injection Sync Queue Specifications', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with an empty queue and handles corrupted storage gracefully', () => {
    expect(getOfflineQueue()).toEqual([]);
    localStorage.setItem('insuminder_offline_queue', 'invalid_json');
    expect(getOfflineQueue()).toEqual([]);
  });

  it('saves and reads offline queue directly to/from localStorage', () => {
    saveOfflineQueue([{ tempId: 'test-1' }]);
    expect(getOfflineQueue()).toEqual([{ tempId: 'test-1' }]);
  });

  it('enqueues offline injections with tempId and exact timestamp', () => {
    const item = enqueueOfflineInjection({
      type: 'bolus',
      delivery_method: 'pen',
      injected_at: '2026-10-25T14:30:00.000Z'
    });

    expect(item.tempId).toMatch(/^offline-/);
    expect(item.type).toBe('bolus');
    expect(item.delivery_method).toBe('pen');
    expect(item.injected_at).toBe('2026-10-25T14:30:00.000Z');

    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].tempId).toBe(item.tempId);
  });

  it('removes specific offline injections and clears queue', () => {
    const item1 = enqueueOfflineInjection({ type: 'bolus' });
    const item2 = enqueueOfflineInjection({ type: 'basal' });

    expect(getOfflineQueue()).toHaveLength(2);
    removeOfflineInjection(item1.tempId);

    const remaining = getOfflineQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tempId).toBe(item2.tempId);

    clearOfflineQueue();
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('syncs offline injections successfully when network is online', async () => {
    const item = enqueueOfflineInjection({
      type: 'bolus',
      delivery_method: 'pump',
      injected_at: '2026-10-25T15:00:00.000Z'
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, id: 99 })
    });

    const successCallback = vi.fn();
    const result = await syncOfflineQueue({ Authorization: 'Bearer token' }, successCallback);

    expect(result.syncedCount).toBe(1);
    expect(result.remainingCount).toBe(0);
    expect(getOfflineQueue()).toHaveLength(0);
    expect(successCallback).toHaveBeenCalledWith(
      expect.objectContaining({ tempId: item.tempId }),
      expect.objectContaining({ success: true, id: 99 })
    );
  });

  it('preserves items in queue when network request fails', async () => {
    enqueueOfflineInjection({ type: 'bolus' });

    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await syncOfflineQueue({ Authorization: 'Bearer token' });

    expect(result.syncedCount).toBe(0);
    expect(result.remainingCount).toBe(1);
    expect(getOfflineQueue()).toHaveLength(1);
  });

  it('handles 409 duplicate response by safely dequeuing', async () => {
    enqueueOfflineInjection({ type: 'bolus' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: 'already recorded this minute' })
    });

    const successCallback = vi.fn();
    const result = await syncOfflineQueue({ Authorization: 'Bearer token' }, successCallback);

    expect(result.syncedCount).toBe(1);
    expect(result.remainingCount).toBe(0);
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('registers and unregisters window online event listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const trigger = vi.fn();

    const cleanup = registerOfflineSyncListeners(trigger);
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));

    cleanup();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
  });
});
