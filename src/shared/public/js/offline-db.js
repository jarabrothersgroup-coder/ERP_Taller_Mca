/**
 * IndexedDB Offline Cache Layer — AutomotiveOS PWA
 *
 * Provides offline-first CRUD for critical data:
 *   - Ordenes de Trabajo (OTs)
 *   - Inventario (repuestos)
 *   - Clientes
 *   - Configuración (tenant, user prefs)
 *
 * All reads hit IndexedDB first (instant, offline-capable).
 * Writes go to IndexedDB immediately + queue for server sync.
 *
 * @module offline-db
 */

(function () {
  'use strict';

  const DB_NAME = 'automotiveos-offline';
  const DB_VERSION = 1;

  const STORES = {
    ordenes: { keyPath: 'id', indexes: ['status', 'clienteId', 'updatedAt'] },
    inventario: { keyPath: 'id', indexes: ['codigo', 'categoria', 'stock'] },
    clientes: { keyPath: 'id', indexes: ['nombre', 'ruc', 'ci'] },
    config: { keyPath: 'key' },
    syncQueue: { keyPath: 'id', indexes: ['createdAt', 'status'] },
    metadata: { keyPath: 'key' },
  };

  let _db = null;

  // ═════════════════════════════════════════════════
  //  DATABASE INITIALIZATION
  // ═════════════════════════════════════════════════

  /**
   * Open (or create) the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  function openDB() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const [storeName, config] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
            });
            if (config.indexes) {
              for (const idx of config.indexes) {
                store.createIndex(idx, idx, { unique: false });
              }
            }
          }
        }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        _db.onversionchange = () => {
          _db.close();
          _db = null;
        };
        resolve(_db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ═════════════════════════════════════════════════
  //  GENERIC CRUD OPERATIONS
  // ═════════════════════════════════════════════════

  /**
   * Get a record by primary key.
   * @param {string} storeName
   * @param {string|number} key
   * @returns {Promise<object|undefined>}
   */
  async function get(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all records in a store.
   * @param {string} storeName
   * @returns {Promise<object[]>}
   */
  async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Query by index.
   * @param {string} storeName
   * @param {string} indexName
   * @param {*} value
   * @returns {Promise<object[]>}
   */
  async function getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Put (insert or update) a record.
   * @param {string} storeName
   * @param {object} record
   * @returns {Promise<string|number>}
   */
  async function put(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Put multiple records in one transaction.
   * @param {string} storeName
   * @param {object[]} records
   * @returns {Promise<void>}
   */
  async function putAll(storeName, records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const record of records) {
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete a record by key.
   * @param {string} storeName
   * @param {string|number} key
   * @returns {Promise<void>}
   */
  async function del(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Clear all records in a store.
   * @param {string} storeName
   * @returns {Promise<void>}
   */
  async function clear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Count records in a store.
   * @param {string} storeName
   * @returns {Promise<number>}
   */
  async function count(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ═════════════════════════════════════════════════
  //  DOMAIN-SPECIFIC HELPERS
  // ═════════════════════════════════════════════════

  /**
   * Cache an OT for offline access.
   * @param {object} orden - Full OT record from server
   */
  async function cacheOrden(orden) {
    const record = {
      ...orden,
      _cachedAt: Date.now(),
      _syncStatus: 'synced',
    };
    await put('ordenes', record);
  }

  /**
   * Cache multiple OTs at once (bulk sync).
   * @param {object[]} ordenes
   */
  async function cacheOrdenes(ordenes) {
    const records = ordenes.map((o) => ({
      ...o,
      _cachedAt: Date.now(),
      _syncStatus: 'synced',
    }));
    await putAll('ordenes', records);
  }

  /**
   * Get a cached OT (offline-first).
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async function getOrden(id) {
    return get('ordenes', id);
  }

  /**
   * Get all cached OTs, optionally filtered by status.
   * @param {string} [status]
   * @returns {Promise<object[]>}
   */
  async function listOrdenes(status) {
    if (status) return getByIndex('ordenes', 'status', status);
    return getAll('ordenes');
  }

  /**
   * Cache inventory items.
   * @param {object[]} items
   */
  async function cacheInventario(items) {
    const records = items.map((item) => ({
      ...item,
      _cachedAt: Date.now(),
      _syncStatus: 'synced',
    }));
    await putAll('inventario', records);
  }

  /**
   * Get a cached inventory item.
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async function getRepuesto(id) {
    return get('inventario', id);
  }

  /**
   * Search inventory by code or description (offline).
   * @param {string} query
   * @returns {Promise<object[]>}
   */
  async function searchInventario(query) {
    const all = await getAll('inventario');
    const q = query.toLowerCase();
    return all.filter(
      (item) =>
        (item.codigo && item.codigo.toLowerCase().includes(q)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(q)),
    );
  }

  /**
   * Cache clients.
   * @param {object[]} clientes
   */
  async function cacheClientes(clientes) {
    const records = clientes.map((c) => ({
      ...c,
      _cachedAt: Date.now(),
      _syncStatus: 'synced',
    }));
    await putAll('clientes', records);
  }

  /**
   * Get a cached client.
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async function getCliente(id) {
    return get('clientes', id);
  }

  // ═════════════════════════════════════════════════
  //  METADATA / SYNC TRACKING
  // ═════════════════════════════════════════════════

  /**
   * Get the last sync timestamp for a store.
   * @param {string} storeName
   * @returns {Promise<number|null>}
   */
  async function getLastSync(storeName) {
    const meta = await get('metadata', `lastSync:${storeName}`);
    return meta ? meta.value : null;
  }

  /**
   * Update the last sync timestamp.
   * @param {string} storeName
   * @param {number} timestamp
   */
  async function setLastSync(storeName, timestamp) {
    await put('metadata', { key: `lastSync:${storeName}`, value: timestamp });
  }

  /**
   * Get database size estimate (for UI display).
   * @returns {Promise<{ordenes: number, inventario: number, clientes: number, total: number}>}
   */
  async function getStorageStats() {
    const [ordenes, inventario, clientes] = await Promise.all([
      count('ordenes'),
      count('inventario'),
      count('clientes'),
    ]);
    return { ordenes, inventario, clientes, total: ordenes + inventario + clientes };
  }

  /**
   * Close the database connection.
   */
  function close() {
    if (_db) {
      _db.close();
      _db = null;
    }
  }

  // ═════════════════════════════════════════════════
  //  EXPOSE TO GLOBAL SCOPE
  // ═════════════════════════════════════════════════

  window.OfflineDB = {
    // Core CRUD
    open: openDB,
    get,
    getAll,
    getByIndex,
    put,
    putAll,
    del,
    clear,
    count,
    close,

    // Domain helpers
    cacheOrden,
    cacheOrdenes,
    getOrden,
    listOrdenes,
    cacheInventario,
    getRepuesto,
    searchInventario,
    cacheClientes,
    getCliente,

    // Metadata
    getLastSync,
    setLastSync,
    getStorageStats,

    // Expose store names
    STORES,
  };
})();
