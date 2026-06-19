/**
 * Offline Mutation Queue — AutomotiveOS PWA
 *
 * Queues POST/PUT/DELETE operations when offline.
 * Replays them in order when connectivity is restored.
 * Integrates with Background Sync API when available.
 *
 * @module offline-queue
 */

(function () {
  'use strict';

  const QUEUE_STORE = 'syncQueue';
  let _isSyncing = false;

  // ═════════════════════════════════════════════════
  //  QUEUE OPERATIONS
  // ═════════════════════════════════════════════════

  /**
   * Add a mutation to the offline queue.
   * @param {object} mutation
   * @param {string} mutation.method - HTTP method (POST, PUT, DELETE)
   * @param {string} mutation.url - API endpoint
   * @param {object|null} mutation.body - Request body
   * @param {string} [mutation.description] - Human-readable description
   * @param {number} [mutation.priority] - Higher = processed first (default 0)
   * @returns {Promise<string>} Queue entry ID
   */
  async function enqueue(mutation) {
    const id = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      method: mutation.method?.toUpperCase() || 'POST',
      url: mutation.url,
      body: mutation.body || null,
      description: mutation.description || `${mutation.method} ${mutation.url}`,
      priority: mutation.priority || 0,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
      lastAttemptAt: null,
      error: null,
    };

    if (window.OfflineDB) {
      await window.OfflineDB.put(QUEUE_STORE, entry);
    } else {
      // Fallback to localStorage if IndexedDB unavailable
      _enqueueFallback(entry);
    }

    // Notify UI
    _dispatchQueueEvent('queued', entry);
    _updateQueueBadge();

    // Try background sync if available
    _requestBackgroundSync();

    return id;
  }

  /**
   * Get all pending mutations.
   * @returns {Promise<object[]>}
   */
  async function getPending() {
    if (window.OfflineDB) {
      const all = await window.OfflineDB.getAll(QUEUE_STORE);
      return all
        .filter((e) => e.status === 'pending')
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    }
    return _getPendingFallback();
  }

  /**
   * Get the count of pending mutations.
   * @returns {Promise<number>}
   */
  async function getPendingCount() {
    if (window.OfflineDB) {
      const all = await window.OfflineDB.getAll(QUEUE_STORE);
      return all.filter((e) => e.status === 'pending').length;
    }
    return _getPendingFallback().length;
  }

  /**
   * Remove a completed/failed mutation from the queue.
   * @param {string} id
   */
  async function remove(id) {
    if (window.OfflineDB) {
      await window.OfflineDB.del(QUEUE_STORE, id);
    } else {
      _removeFallback(id);
    }
    _updateQueueBadge();
  }

  /**
   * Mark a mutation as failed.
   * @param {string} id
   * @param {string} error
   */
  async function markFailed(id, error) {
    if (window.OfflineDB) {
      const entry = await window.OfflineDB.get(QUEUE_STORE, id);
      if (entry) {
        entry.status = entry.attempts >= entry.maxAttempts ? 'failed' : 'pending';
        entry.attempts++;
        entry.lastAttemptAt = Date.now();
        entry.error = error;
        await window.OfflineDB.put(QUEUE_STORE, entry);
      }
    }
    _updateQueueBadge();
  }

  /**
   * Clear all completed entries from the queue.
   */
  async function clearCompleted() {
    if (window.OfflineDB) {
      const all = await window.OfflineDB.getAll(QUEUE_STORE);
      for (const entry of all) {
        if (entry.status === 'completed' || entry.status === 'failed') {
          await window.OfflineDB.del(QUEUE_STORE, entry.id);
        }
      }
    }
    _updateQueueBadge();
  }

  /**
   * Get queue statistics.
   * @returns {Promise<{pending: number, failed: number, completed: number, total: number}>}
   */
  async function getStats() {
    if (window.OfflineDB) {
      const all = await window.OfflineDB.getAll(QUEUE_STORE);
      return {
        pending: all.filter((e) => e.status === 'pending').length,
        failed: all.filter((e) => e.status === 'failed').length,
        completed: all.filter((e) => e.status === 'completed').length,
        total: all.length,
      };
    }
    const pending = _getPendingFallback();
    return { pending: pending.length, failed: 0, completed: 0, total: pending.length };
  }

  // ═════════════════════════════════════════════════
  //  QUEUE FLUSHING (SYNC)
  // ═════════════════════════════════════════════════

  /**
   * Flush the offline queue by replaying all pending mutations.
   * Called when connectivity is restored.
   * @returns {Promise<{success: number, failed: number}>}
   */
  async function flush() {
    if (_isSyncing) return { success: 0, failed: 0 };
    _isSyncing = true;

    _dispatchQueueEvent('sync-start', {});

    const pending = await getPending();
    let success = 0;
    let failed = 0;

    for (const entry of pending) {
      try {
        const headers = {
          'Content-Type': 'application/json',
        };

        // Add auth token if available
        const token = localStorage.getItem('x-auth-token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(entry.url, {
          method: entry.method,
          headers,
          body: entry.body ? JSON.stringify(entry.body) : undefined,
        });

        if (response.ok || response.status < 500) {
          // Success or client error (don't retry 4xx)
          if (window.OfflineDB) {
            entry.status = 'completed';
            entry.completedAt = Date.now();
            await window.OfflineDB.put(QUEUE_STORE, entry);
          }
          success++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        failed++;
        await markFailed(entry.id, err.message);
      }
    }

    _isSyncing = false;
    _dispatchQueueEvent('sync-complete', { success, failed });
    _updateQueueBadge();

    return { success, failed };
  }

  // ═════════════════════════════════════════════════
  //  BACKGROUND SYNC
  // ═════════════════════════════════════════════════

  function _requestBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.sync.register('flush-offline-queue').catch(() => {
          // Background sync not supported or quota exceeded
        });
      });
    }
  }

  // Listen for sync messages from service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_STARTED') {
        flush();
      }
    });
  }

  // ═════════════════════════════════════════════════
  //  UI HELPERS
  // ═════════════════════════════════════════════════

  function _updateQueueBadge() {
    getPendingCount().then((count) => {
      const badge = document.getElementById('offline-badge');
      if (badge) {
        if (count > 0) {
          badge.textContent = String(count);
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // Dispatch for other modules
      window.dispatchEvent(
        new CustomEvent('queue-updated', { detail: { count } }),
      );
    });
  }

  function _dispatchQueueEvent(type, detail) {
    window.dispatchEvent(
      new CustomEvent('offline-queue', {
        detail: { type, ...detail },
      }),
    );
  }

  // ═════════════════════════════════════════════════
  //  LOCALSTORAGE FALLBACK
  // ═════════════════════════════════════════════════

  const FALLBACK_KEY = 'automotiveos_offline_queue';

  function _getFallbackQueue() {
    try {
      return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _setFallbackQueue(queue) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(queue));
  }

  function _enqueueFallback(entry) {
    const queue = _getFallbackQueue();
    queue.push(entry);
    _setFallbackQueue(queue);
  }

  function _getPendingFallback() {
    return _getFallbackQueue().filter((e) => e.status === 'pending');
  }

  function _removeFallback(id) {
    const queue = _getFallbackQueue().filter((e) => e.id !== id);
    _setFallbackQueue(queue);
  }

  // ═════════════════════════════════════════════════
  //  AUTO-FLUSH ON RECONNECT
  // ═════════════════════════════════════════════════

  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Online — flushing queue');
    setTimeout(() => flush(), 1000); // Small delay to let connection stabilize
  });

  // ═════════════════════════════════════════════════
  //  EXPOSE TO GLOBAL SCOPE
  // ═════════════════════════════════════════════════

  window.OfflineQueue = {
    enqueue,
    getPending,
    getPendingCount,
    remove,
    markFailed,
    clearCompleted,
    flush,
    getStats,
  };
})();
