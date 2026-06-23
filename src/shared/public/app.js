const state = {
  auth: { slug: '', profile: null, tenant: null },
  wsConnected: false,
  activeView: 'dashboard',
  ws: null,
  wsReconnectTimer: null,
  pollTimer: null,
  settings: { companyName: '', ruc: '', address: '', phone: '', email: '', logoBase64: '' },
  cachedProfiles: [],
  subscribedOrderId: null,
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  loginScreen: $('login-screen'),
  loginForm: $('login-form'),
  loginSlug: $('login-slug'),
  loginEmail: $('login-email'),
  loginPassword: $('login-password'),
  loginBtn: $('login-btn'),
  loginBtnText: $('login-btn-text'),
  loginBtnSpinner: $('login-btn-spinner'),
  loginError: $('login-error'),
  loginErrorText: $('login-error-text'),
  loginLoading: $('login-loading'),
  loginFeedback: $('login-feedback'),
  appLayout: $('app-layout'),
  sidebarLogo: $('sidebar-logo'),
  sidebarCompany: $('sidebar-company'),
  sidebarSlug: $('sidebar-slug'),
  viewTitle: $('view-title'),
  viewSubtitle: $('view-subtitle'),
  viewContent: $('view-content'),
  modalOverlay: $('modal-overlay'),
  modalContent: $('modal-content'),
  wsDot: $('ws-dot'),
  wsLabel: $('ws-label'),
  sifenDot: $('sifen-dot'),
  sifenLabel: $('sifen-label'),
  clock: $('clock'),
  logoutBtn: $('logout-btn'),
};

/* ─── Offline-First Cache Layer ──────────────── */
const cache = {
  _store: {},
  _ttl: {},
  get(key) {
    const ttl = this._ttl[key];
    if (ttl && Date.now() > ttl) {
      delete this._store[key];
      delete this._ttl[key];
      return null;
    }
    return this._store[key] || null;
  },
  set(key, value, ttlMs = 300000) {
    this._store[key] = value;
    this._ttl[key] = Date.now() + ttlMs;
    try { localStorage.setItem(`cache_${key}`, JSON.stringify({ value, expires: this._ttl[key] })); } catch {}
  },
  load() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('cache_')) {
          const data = JSON.parse(localStorage.getItem(k));
          if (data && data.expires > Date.now()) {
            this._store[k.slice(6)] = data.value;
            this._ttl[k.slice(6)] = data.expires;
          } else {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {}
  },
  invalidate(pattern) {
    const keys = Object.keys(this._store);
    for (const k of keys) {
      if (k.includes(pattern)) {
        delete this._store[k];
        delete this._ttl[k];
        try { localStorage.removeItem(`cache_${k}`); } catch {}
      }
    }
  },
};
cache.load();

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (state.auth.slug) headers['X-Tenant-Slug'] = state.auth.slug;
  // CRIT-02 FIX: Send JWT token instead of email header
  if (state.auth.token) {
    headers['Authorization'] = `Bearer ${state.auth.token}`;
  } else if (state.auth.profile?.email) {
    headers['X-User-Email'] = state.auth.profile.email;
  }
  // MED-03 FIX: Send CSRF token from cookie on state-changing requests
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = document.cookie.split('; ').find(c => c.startsWith('_csrf='))?.split('=')[1];
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  // Offline-first: use cache for GET requests
  if (method === 'GET' && !opts.noCache) {
    const cached = cache.get(path);
    if (cached !== null) return cached;
  }

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const e = await res.json(); msg = e.message || e.error || msg; } catch {}
    throw new Error(msg);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  // Cache GET responses for 5 minutes
  if (method === 'GET' && data && !opts.noCache) {
    cache.set(path, data, 300000);
  }

  // Invalidate related cache on mutations
  if (method !== 'GET') {
    const basePath = path.split('?')[0].replace(/\/[^/]+$/, '');
    cache.invalidate(basePath);
  }

  return data;
}

/**
 * Returns common auth headers for raw fetch() calls.
 * Modules that bypass the global api() helper (e.g. budget.js) should
 * spread this into their fetch headers: { ...authHeaders() }.
 */
function authHeaders() {
  const h = {};
  if (state.auth.slug) h['X-Tenant-Slug'] = state.auth.slug;
  if (state.auth.token) {
    h['Authorization'] = `Bearer ${state.auth.token}`;
  } else if (state.auth.profile?.email) {
    h['X-User-Email'] = state.auth.profile.email;
  }
  const csrfToken = document.cookie.split('; ').find(c => c.startsWith('_csrf='))?.split('=')[1];
  if (csrfToken) h['X-CSRF-Token'] = csrfToken;
  return h;
}


async function login() {
  const slug = dom.loginSlug.value.trim();
  const email = dom.loginEmail.value.trim();
  const password = dom.loginPassword.value.trim();

  // Client-side validation
  if (!slug || !email) {
    showLoginError('Completa todos los campos (slug, email, contraseña)');
    if (!slug) dom.loginSlug.focus();
    else dom.loginEmail.focus();
    return;
  }

  // UI loading state
  dom.loginBtn.disabled = true;
  dom.loginBtnText.textContent = 'Ingresando...';
  dom.loginBtnSpinner.classList.remove('hidden');
  dom.loginError.classList.add('hidden');
  dom.loginBtn.classList.remove('ring-2', 'ring-blue-500/40');

  try {
    const result = await api('/api/auth/login', { method: 'POST', body: { tenantSlug: slug, email, password: password || undefined } });
    state.auth = { slug, profile: result.profile, tenant: result.tenant, token: result.token };
    localStorage.setItem('x-tenant-slug', slug);
    localStorage.setItem('x-tenant-email', email);
    // CRIT-03 FIX: Never store password — use JWT token instead
    if (result.token) localStorage.setItem('x-auth-token', result.token);
    enterApp();
    if (typeof showToast === 'function') showToast(`Bienvenido, ${result.profile?.fullName || email}`, 'success');
  } catch (e) {
    showLoginError(e.message);
    dom.loginSlug.focus();
  } finally {
    dom.loginBtn.disabled = false;
    dom.loginBtnText.textContent = 'Ingresar';
    dom.loginBtnSpinner.classList.add('hidden');
  }
}

function showLoginError(msg) {
  dom.loginErrorText.textContent = msg;
  dom.loginError.classList.remove('hidden');
  // Trigger shake animation
  dom.loginError.classList.remove('login-error-enter');
  void dom.loginError.offsetWidth; // Force reflow
  dom.loginError.classList.add('login-error-enter');
}

function hideLoginError() {
  dom.loginError.classList.add('hidden');
  dom.loginError.classList.remove('login-error-enter');
}

function logout() {
  localStorage.removeItem('x-tenant-slug');
  localStorage.removeItem('x-tenant-email');
  localStorage.removeItem('x-auth-token');
  state.auth = { slug: '', profile: null, tenant: null, token: null };
  if (state.ws) { state.ws.close(); state.ws = null; }
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  dom.appLayout.classList.add('hidden');
  dom.loginScreen.classList.remove('hidden');
  dom.loginSlug.value = '';
  dom.loginEmail.value = '';
  dom.loginPassword.value = '';
  hideLoginError();
  dom.loginBtn.disabled = false;
  dom.loginBtnText.textContent = 'Ingresar';
  dom.loginBtnSpinner.classList.add('hidden');
}

function enterApp() {
  dom.loginScreen.classList.add('hidden');
  dom.appLayout.classList.remove('hidden');
  dom.sidebarCompany.textContent = state.auth.tenant?.name || 'AutomotiveOS';
  dom.sidebarSlug.textContent = state.auth.slug;
  // Apply RBAC visibility
  applyRoleVisibility();
  // Render notification bell in header
  const bellContainer = document.getElementById('notif-bell-container');
  if (bellContainer && typeof renderNotifBell === 'function') {
    bellContainer.innerHTML = renderNotifBell();
    setupNotifListeners();
    startNotifPolling();
  }
  // Init global search bar (Ctrl+K)
  if (typeof initSearchBar === 'function') initSearchBar();
  fetchSettings();
  navigate('dashboard');
  connectWs();
  startPolling();
  restoreOfflineQueue();
}

async function checkAuth() {
  const slug = localStorage.getItem('x-tenant-slug');
  const email = localStorage.getItem('x-tenant-email');
  const token = localStorage.getItem('x-auth-token');
  if (slug && email && token) {
    dom.loginSlug.value = slug;
    dom.loginEmail.value = email;
    // CRIT-03 FIX: Restore token, not password
    state.auth = { slug, token };
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: { tenantSlug: slug, email, password: '__token_relogin__' } });
      state.auth = { slug, profile: result.profile, tenant: result.tenant, token: result.token || token };
      localStorage.setItem('x-auth-token', state.auth.token);
      enterApp();
      return true;
    } catch {
      localStorage.removeItem('x-tenant-slug');
      localStorage.removeItem('x-tenant-email');
      localStorage.removeItem('x-auth-token');
      state.auth = { slug: '', profile: null, tenant: null, token: null };
      return false;
    }
  }
  return false;
}


function navigate(view) {
  closeSidebarMobile();
  state.activeView = view;
  $$('.sidebar-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.sidebar-item[data-view="${view}"]`);
  if (btn) btn.classList.add('active');
  const titles = {
    dashboard: ['Dashboard', 'Resumen del taller'],
    analytics: ['Analytics', 'KPIs, productividad y reportes'],
    users: ['Usuarios', 'Gestión de perfiles del taller'],
    config: ['Configuración', 'Datos de la empresa y logo'],
    ordenes: ['Órdenes de Trabajo', 'Filtrar y gestionar'],
    ingreso: ['Ingreso de Vehículo', 'Registro de check-in y orden'],
    workshop: ['Taller', 'Bahía del mecánico'],
    tv: ['Quiosco TV', 'Pantalla de espera para clientes'],
    facturacion: ['Facturación', 'Emisión de facturas'],
    thinkcar: ['Thinkcar', 'Reportes de diagnóstico automotriz'],
    contabilidad: ['Contabilidad', 'Plan de Cuentas, Asientos y Estados Financieros'],
    servicios: ['Servicios', 'Catálogo de servicios del taller'],
    tesoreria: ['Tesorería', 'CxC, CxP, Cuentas y Flujo de Caja'],
    presupuestos: ['Presupuestos', 'Control de gestión: real vs presupuestado'],
    inventario: ['Inventario', 'Gestión de repuestos y herramientas'],
    whatsapp: ['WhatsApp', 'Conexión y envío de mensajes'],
    dvi: ['DVI', 'Inspección Digital de Vehículos'],
    calendario: ['Calendario', 'Turnos y agendamiento'],
    marketing: ['Marketing', 'Campañas y fidelización'],
    fleet: ['Flotas', 'Gestión de flotas corporativas'],
    'sifen-monitor': ['Monitor SIFEN', 'Estado de facturación electrónica DNIT'],
    'whatsapp-monitor': ['Monitor WhatsApp', 'Colas, entregas y errores de mensajería'],
    'label-printing': ['Impresión Etiquetas', 'Códigos de barras y QR para inventario'],
    'backup-restore': ['Backup & Restore', 'Copias de seguridad y restauración'],
    'security-hw': ['Seguridad Hardware', 'USB Dongle, Kill Switch y Fingerprinting'],
    'crm': ['CRM', 'Client Relationship Management'],
  };
  const [t, st] = titles[view] || ['', ''];
  dom.viewTitle.textContent = t;
  dom.viewSubtitle.textContent = st;
  renderView(view);
}

function renderView(view) {
  const c = dom.viewContent;
  c.innerHTML = '';
  // Performance instrumentation
  const render = () => {
    if (view === 'dashboard') renderDashboard(c);
    else if (view === 'analytics') renderAnalytics(c);
    else if (view === 'users') renderUsers(c);
    else if (view === 'config') renderConfig(c);
    else if (view === 'ordenes') renderOrdenes(c);
    else if (view === 'ingreso') renderIngreso(c);
    else if (view === 'workshop') renderWorkshop(c);
    else if (view === 'tv') renderTv(c);
    else if (view === 'facturacion') renderFacturacion(c);
    else if (view === 'thinkcar') renderThinkcar(c);
    else if (view === 'contabilidad') renderContabilidad(c);
    else if (view === 'tesoreria') renderTesorería(c);
    else if (view === 'presupuestos') renderBudget(c);
    else if (view === 'servicios') renderServicios(c);
    else if (view === 'inventario') renderInventario(c);
    else if (view === 'nomina') renderPayroll(c);
    else if (view === 'whatsapp') renderWhatsAppView(c);
    else if (view === 'dvi') renderDVI(c);
    else if (view === 'calendario') renderCalendario(c);
    else if (view === 'marketing') renderMarketing(c);
    else if (view === 'fleet') renderFleet(c);
    else if (view === 'sifen-monitor') renderSifenMonitor(c);
    else if (view === 'whatsapp-monitor') renderWhatsappMonitor(c);
    else if (view === 'label-printing') { c.innerHTML = '<div id="label-printing-view"></div>'; if (typeof initLabelPrinting === 'function') initLabelPrinting(); }
    else if (view === 'backup-restore') { c.innerHTML = '<div id="backup-view"></div>'; if (typeof initBackupRestore === 'function') initBackupRestore(); }
    else if (view === 'security-hw') { c.innerHTML = '<div id="security-hw-view"></div>'; if (typeof initSecurityHw === 'function') initSecurityHw(); }
    else if (view === 'crm') renderCRM(c);
  };
  window.PerfMonitor?.timeView(view, render);
  // Re-observe lazy-animate elements after view render
  window.observeLazyElements?.();
}

/* ─── Servicios (Catálogo) ──────────────── */

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function fmt(n) { return (Number(n) || 0).toLocaleString('es-PY', { minimumFractionDigits: 0 }); }

function roleBadge(role) {
  const m = { admin: 'bg-purple-900/50 text-purple-400', manager: 'bg-blue-900/50 text-blue-400', mechanic: 'bg-green-900/50 text-green-400', user: 'bg-gray-700 text-gray-300' };
  return m[role] || 'bg-gray-700 text-gray-300';
}

/* ─── RBAC View Visibility ─────────────────────── */
const ROLE_HIERARCHY = { user: 0, mechanic: 1, manager: 2, admin: 3 };

const VIEW_ROLES = {
  dashboard: 'user',
  analytics: 'manager',
  users: 'admin',
  config: 'admin',
  ordenes: 'mechanic',
  ingreso: 'mechanic',
  workshop: 'mechanic',
  tv: 'user',
  facturacion: 'manager',
  thinkcar: 'mechanic',
  contabilidad: 'manager',
  servicios: 'manager',
  tesoreria: 'manager',
  presupuestos: 'manager',
  inventario: 'manager',
  nomina: 'admin',
  whatsapp: 'manager',
  dvi: 'mechanic',
  calendario: 'manager',
  marketing: 'admin',
  fleet: 'admin',
  crm: 'manager',
};

function canAccessView(view) {
  const requiredRole = VIEW_ROLES[view];
  if (!requiredRole) return true; // Unknown views are accessible
  const userRole = state.auth.profile?.role || 'user';
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

function applyRoleVisibility() {
  $$('.sidebar-item[data-view]').forEach(btn => {
    const view = btn.dataset.view;
    if (view && !canAccessView(view)) {
      btn.classList.add('hidden');
    } else {
      btn.classList.remove('hidden');
    }
  });
}

function statusBadge(s) {
  const m = { Presupuestado: 'bg-gray-700 text-gray-300', Aprobado: 'bg-blue-900/50 text-blue-300', En_Proceso: 'bg-yellow-900/50 text-yellow-300', Control_Calidad: 'bg-purple-900/50 text-purple-300', Listo: 'bg-green-900/50 text-green-300' };
  return m[s] || 'bg-gray-700 text-gray-300';
}

function statusActionButton(ot) {
  const id = ot.id || ot.ordenTrabajoId || '';
  const s = ot.status || '';
  if (s === 'Listo') return '<span class="text-green-400 text-xs font-medium">✅ Listo para entregar</span>';
  if (s === 'En_Proceso') return `<button class="advance-status-btn w-full px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-800/30 rounded-lg text-xs text-purple-300 font-medium transition" data-id="${id}" data-status="Control_Calidad">→ Control de Calidad</button>`;
  if (s === 'Control_Calidad') return `<button class="advance-status-btn w-full px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-800/30 rounded-lg text-xs text-green-300 font-medium transition" data-id="${id}" data-status="Listo">→ Listo</button>`;
  if (s === 'Presupuestado' || s === 'Aprobado') return `<button class="advance-status-btn w-full px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-800/30 rounded-lg text-xs text-yellow-300 font-medium transition" data-id="${id}" data-status="En_Proceso">Iniciar Trabajo</button>`;
  return '';
}


/* ─── UI-005: Connectivity Indicator & Offline Queue ── */
const offlineQueue = [];
let queueFlushing = false;

function updateConnectivity(online) {
  const dot = dom.wsDot;
  const label = dom.wsLabel;
  const sifenDot = dom.sifenDot;
  const sifenLabel = dom.sifenLabel;
  if (online) {
    dot.className = 'ws-dot bg-green-500';
    label.textContent = 'Conectado';
    label.className = 'text-green-400';
    if (sifenDot) sifenDot.className = 'ws-dot bg-green-500';
    if (sifenLabel) sifenLabel.textContent = 'SIFEN: Conectado';
    void flushOfflineQueue();
  } else {
    dot.className = 'ws-dot bg-yellow-500';
    label.textContent = 'Offline';
    label.className = 'text-yellow-400';
    if (sifenDot) sifenDot.className = 'ws-dot bg-yellow-500';
    if (sifenLabel) sifenLabel.textContent = 'SIFEN: Offline';
  }
  updateOfflineBadge();
}

function updateOfflineBadge() {
  const badge = document.getElementById('offline-badge');
  if (!badge) return;
  const count = offlineQueue.length;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function enqueueOffline(entity, action, payload) {
  const op = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tenant: state.auth.slug,
    entity,
    action,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };
  offlineQueue.push(op);
  try {
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
  } catch {}
  updateConnectivity(false);
}

async function flushOfflineQueue() {
  if (queueFlushing || offlineQueue.length === 0) return;
  queueFlushing = true;
  try {
    const result = await api('/sync', { method: 'POST', body: { operations: [...offlineQueue] } });
    if (result && result.results) {
      const failed = result.results.filter((r) => r.status === 'failed');
      const applied = result.results.filter((r) => r.status === 'applied');
      if (applied.length > 0) {
        offlineQueue.splice(0, applied.length);
        localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
      }
      if (failed.length > 0) {
        console.warn('[OfflineQueue] Failed operations:', failed);
      }
    }
  } catch {
    // Still offline — keep queue
  } finally {
    queueFlushing = false;
    if (offlineQueue.length === 0) updateConnectivity(true);
  }
}

function restoreOfflineQueue() {
  try {
    const stored = localStorage.getItem('offline_queue');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        offlineQueue.push(...parsed);
        if (offlineQueue.length > 0) updateConnectivity(false);
      }
    }
  } catch {}
}

/* ─── WebSocket ─────────────────────────── */
function connectWs() {
  if (state.ws && (state.ws.readyState === 0 || state.ws.readyState === 1)) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${proto}//${location.host}/api/v1/visual/stream`);
  state.ws.onopen = () => {
    state.wsConnected = true;
    updateConnectivity(true);
    if (state.wsReconnectTimer) { clearTimeout(state.wsReconnectTimer); state.wsReconnectTimer = null; }
  };
  state.ws.onclose = () => {
    state.wsConnected = false;
    updateConnectivity(false);
    state.wsReconnectTimer = setTimeout(connectWs, 5000);
  };
  state.ws.onerror = () => state.ws.close();
  state.ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.event === 'CONNECTED' && msg.tenant) {
        if (msg.tenant.logoBase64) dom.sidebarLogo.src = msg.tenant.logoBase64;
        if (state.activeView === 'tv') updateTvView(null);
      }
      if (msg.event === 'WORKSHOP_UPDATE') {
        if (state.activeView === 'tv') updateTvView(msg.data);
        if (state.activeView === 'dashboard') fetchDashboardData();
        if (state.activeView === 'workshop') fetchWorkshopTasks();
        // UI-003: Live refresh modal if viewing this order
        if (state.subscribedOrderId && msg.data.orderId === state.subscribedOrderId) {
          api(`/workshop/ordenes/${state.subscribedOrderId}`).then(o => {
            dom.modalContent.innerHTML = renderOrdenModalBody(o);
          }).catch(() => {});
        }
      }
    } catch {}
  };
}

/* ─── Polling (fallback when WS disconnected) ── */
function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (state.activeView === 'dashboard') fetchDashboardData();
    if (state.activeView === 'ordenes') fetchOrdenes(document.querySelector('#filter-status')?.value || '');
    if (state.activeView === 'workshop') fetchWorkshopTasks();
    if (state.activeView === 'facturacion') { fetchOrdenesListas(); fetchFacturasEmitidas(); }
    if (state.activeView === 'thinkcar') fetchThinkcarImports();
    if (state.activeView === 'inventario') { if (invTab === 'repuestos') fetchRepuestos(); else fetchHerramientas(); }
  }, 15000);
}

/* ════════════════════════════════════════════
   Sprint 6: Contabilidad Frontend
   ════════════════════════════════════════════ */

const CONTABILIDAD_TABS = {
  cuentas: 'Plan de Cuentas',
  asientos: 'Asientos',
  balance: 'Balance General',
  resultados: 'Estado Resultados',
  libros: 'Libros Contables',
  impuestos: 'Impuestos',
  auditoria: 'Auditoría',
};

/* ─── Init ──────────────────────────────── */
setInterval(() => { dom.clock.textContent = new Date().toLocaleTimeString('es-PY'); }, 1000);

document.addEventListener('click', (e) => {
  const sidebarBtn = e.target.closest('.sidebar-item[data-view]');
  if (sidebarBtn) navigate(sidebarBtn.dataset.view);

  if (e.target.closest('#logout-btn')) logout();
  if (e.target.closest('#modal-close') || e.target.closest('#modal-cancel') || e.target === dom.modalOverlay) closeModal();
  if (e.target.closest('#payroll-calc-btn')) calcularNomina();
  if (e.target.closest('#add-user-btn')) showUserModal(null);
  if (e.target.closest('.edit-user-btn')) {
    const id = e.target.closest('.edit-user-btn').dataset.id;
    const p = state.cachedProfiles.find(x => x.id === id);
    if (p) showUserModal(p);
  }
  if (e.target.closest('.delete-user-btn')) {
    const id = e.target.closest('.delete-user-btn').dataset.id;
    if (confirm('¿Desactivar este usuario?')) {
      api(`/api/profiles/${id}`, { method: 'DELETE' }).then(fetchUsers).catch(() => {});
    }
  }
  if (e.target.closest('#scan-barcode')) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Código de barras / QR...';
    input.className = 'px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72';
    input.style.boxShadow = '0 0 40px rgba(0,0,0,0.8)';
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/70 z-40';
    overlay.addEventListener('click', () => { overlay.remove(); input.remove(); });
    document.body.appendChild(overlay);
    document.body.appendChild(input);
    input.focus();
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && input.value) { alert(`Código escaneado: ${input.value}`); overlay.remove(); input.remove(); }
      if (ev.key === 'Escape') { overlay.remove(); input.remove(); }
    });
  }

  // ── Inventario ──
  if (e.target.closest('#inv-create-btn')) showNuevoRepuestoModal();
  if (e.target.closest('.inv-entry-btn')) {
    const id = e.target.closest('.inv-entry-btn').dataset.id;
    showStockMovimientoModal('entrada', id);
  }
  if (e.target.closest('.inv-exit-btn')) {
    const id = e.target.closest('.inv-exit-btn').dataset.id;
    showStockMovimientoModal('salida', id);
  }

  // ── UI-001: Órdenes ──
  if (e.target.closest('#add-orden-btn')) {
    showNewOrdenModal();
  }
  if (e.target.closest('.view-orden-btn')) {
    const id = e.target.closest('.view-orden-btn').dataset.id;
    if (id) showOrdenModal(id);
  }
  if (e.target.closest('.print-orden-btn')) {
    const id = e.target.closest('.print-orden-btn').dataset.id;
    if (id && typeof printOT === 'function') printOT(id);
  }
  if (e.target.closest('#filter-apply')) {
    const status = document.querySelector('#filter-status')?.value || '';
    fetchOrdenes(status);
  }
  // ── UI-002: Ingreso ──
  if (e.target.closest('#ingreso-add-cliente')) {
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Nuevo Cliente</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <form id="quick-client-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre</label>
          <input id="qc-name" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">RUC (opcional)</label>
          <input id="qc-ruc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Teléfono (opcional)</label>
          <input id="qc-phone" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Cliente</button>
      </form>`;
    dom.modalOverlay.classList.remove('hidden');
  }
  // ── UI-004: VIN scanning ──
  if (e.target.closest('#scan-vin-btn')) {
    e.preventDefault();
    scanVinCamera();
  }
  // ── UI-004b: Manual VIN entry fallback ──
  if (e.target.closest('#scanner-manual-input')) {
    document.querySelector('#scanner-manual-input')?.remove();
    scanVinCamera(true);
  }
  // ── UI-004c: Close scanner ──
  if (e.target.closest('#scanner-close')) {
    closeScanner();
  }
  // ── UI-004d: Confirm manual VIN ──
  if (e.target.closest('#scanner-confirm-manual')) {
    const vin = document.getElementById('manual-vin-input')?.value?.trim();
    if (vin) {
      document.getElementById('ingreso-vin').value = vin;
    }
    closeScanner();
  }
  // ── UI-001b: Modal close bottom ──
  if (e.target.closest('#modal-close-bottom')) {
    closeModal();
  }

  // ── Taller: Status advancement buttons ──
  const advBtn = e.target.closest('.advance-status-btn');
  if (advBtn) {
    const id = advBtn.dataset.id;
    const status = advBtn.dataset.status;
    if (id && status) {
      advBtn.disabled = true;
      advBtn.textContent = 'Actualizando...';
      api(`/workshop/ordenes/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } })
        .then(() => fetchWorkshopTasks())
        .catch((err) => { advBtn.disabled = false; advBtn.textContent = 'Error'; alert('Error: ' + err.message); });
    }
  }

  // ── Facturación: Emitir desde orden ──
  if (e.target.closest('#facturar-orden-btn')) {
    const id = e.target.closest('#facturar-orden-btn').dataset.id;
    if (id) showFacturarModal(id);
  }

  // ── Inventario: tab toggle ──
  if (e.target.closest('.inv-tab')) {
    const tab = e.target.closest('.inv-tab').dataset.tab;
    if (tab) switchInventarioTab(tab);
  }

  // ── Contabilidad ──
  const btn = e.target;
  if (btn.classList.contains('contab-tab')) {
    showContabTab(btn.dataset.contabTab);
  }
  if (btn.classList.contains('view-asiento-btn')) {
    showAsientoModal(btn.dataset.id);
  }
  if (btn.classList.contains('anular-asiento-btn')) {
    if (confirm('¿Estás seguro de anular este asiento?')) {
      api(`/finance/contabilidad/asientos/${btn.dataset.id}/anular`, { method: 'POST', body: { motivo: 'Anulación manual desde frontend' } })
        .then(() => { showContabTab('asientos'); })
        .catch(e => alert('Error al anular: ' + e.message));
    }
  }
  if (btn.classList.contains('page-btn')) {
    asientosPage = parseInt(btn.dataset.page, 10);
    showContabTab('asientos');
  }
  if (btn.id === 'btn-filtrar-asientos') {
    asientosPage = 1;
    asientosFilter = {};
    const desde = document.querySelector('#filtro-asientos-desde')?.value;
    const hasta = document.querySelector('#filtro-asientos-hasta')?.value;
    const modulo = document.querySelector('#filtro-asientos-modulo')?.value;
    if (desde) asientosFilter.desde = desde;
    if (hasta) asientosFilter.hasta = hasta;
    if (modulo) asientosFilter.moduloOrigen = modulo;
    showContabTab('asientos');
  }
  if (btn.id === 'btn-limpiar-filtros') {
    asientosPage = 1;
    asientosFilter = {};
    const d = document.querySelector('#filtro-asientos-desde');
    const h = document.querySelector('#filtro-asientos-hasta');
    const m = document.querySelector('#filtro-asientos-modulo');
    if (d) d.value = '';
    if (h) h.value = '';
    if (m) m.value = '';
    showContabTab('asientos');
  }
  if (btn.id === 'btn-cargar-balance') {
    const fecha = document.querySelector('#balance-fecha')?.value;
    if (fecha) cargarBalance(fecha);
  }
  if (btn.id === 'btn-cargar-pnl') {
    const anho = parseInt(document.querySelector('#pnl-anho')?.value, 10);
    const mes = parseInt(document.querySelector('#pnl-mes')?.value, 10);
    const acum = document.querySelector('#pnl-acumulado')?.checked || false;
    cargarPnL(anho, mes, acum);
  }
  if (btn.classList.contains('libros-tab')) {
    librosTabActivo = btn.dataset.librosTab;
    showContabTab('libros');
    const cuentaSelect = document.querySelector('#libros-cuenta');
    if (cuentaSelect) {
      if (librosTabActivo === 'mayor') {
        cuentaSelect.classList.remove('hidden');
        // Populate accounts dropdown if empty
        if (cuentaSelect.options.length <= 1) {
          api('/finance/contabilidad/cuentas?activo=true').then(cuentas => {
            if (Array.isArray(cuentas)) {
              cuentas.filter(c => c.aceptaMovimientos !== false).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.codigo;
                opt.textContent = `${c.codigo} — ${c.nombre}`;
                cuentaSelect.appendChild(opt);
              });
            }
          }).catch(() => {});
        }
      } else {
        cuentaSelect.classList.add('hidden');
      }
    }
  }
  if (btn.id === 'btn-cargar-libro') {
    const anho = parseInt(document.querySelector('#libros-anho')?.value, 10);
    const mes = parseInt(document.querySelector('#libros-mes')?.value, 10);
    const cuentaCodigo = document.querySelector('#libros-cuenta')?.value || '';
    cargarLibro(anho, mes, cuentaCodigo);
  }
  if (btn.id === 'btn-nueva-cuenta') {
    mostrarModalNuevaCuenta();
  }
  if (btn.id === 'btn-nuevo-asiento') {
    mostrarModalNuevoAsiento();
  }
  if (btn.id === 'btn-guardar-cuenta') {
    guardarNuevaCuenta();
  }
  if (btn.id === 'btn-guardar-asiento') {
    guardarNuevoAsiento();
  }
  if (btn.id === 'btn-agregar-linea-asiento') {
    agregarLineaAsiento();
  }
  if (btn.classList.contains('btn-desactivar-cuenta')) {
    desactivarCuenta(btn.dataset.cuentaId);
  }
  // ── Impuestos tabs ──
  if (btn.classList.contains('impuesto-tab')) {
    impTabActivo = btn.dataset.impTab;
    const tabsContainer = btn.closest('.flex-wrap');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.impuesto-tab').forEach(t => {
        t.className = 'impuesto-tab px-4 py-2 text-sm font-medium rounded-t-lg transition text-gray-500 hover:text-gray-300 hover:bg-gray-800/50';
      });
      btn.className = 'impuesto-tab px-4 py-2 text-sm font-medium rounded-t-lg transition bg-gray-800 text-blue-400 border-b-2 border-blue-500';
    }
    loadImpTab(impTabActivo);
  }
  // ── Impuestos calculate buttons ──
  if (btn.id === 'btn-calcular-form120') { calcularForm120(); }
  if (btn.id === 'btn-calcular-ire') { calcularIre(); }
  if (btn.id === 'btn-calcular-idu') { calcularIdu(); }
  if (btn.id === 'btn-calcular-isc') { calcularIsc(); }
  if (btn.id === 'btn-calcular-inr') { calcularInr(); }
  if (btn.id === 'modal-close') {
    dom.modalOverlay.classList.add('hidden');
  }
  if (btn.id === 'modal-close-bottom') {
    dom.modalOverlay.classList.add('hidden');
  }
});

/* ─── UI-004: VIN Camera Scanner ────────── */
let scannerStream = null;

function closeScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  const overlay = document.getElementById('scanner-overlay');
  if (overlay) overlay.remove();
}

function scanVinCamera(forceManual) {
  if (!('BarcodeDetector' in window) || forceManual) {
    // Fallback: show manual text input overlay
    const overlay = document.createElement('div');
    overlay.id = 'scanner-overlay';
    overlay.className = 'scanner-overlay fixed inset-0 bg-black/80 flex items-center justify-center p-6';
    overlay.innerHTML = `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">Ingresar VIN manualmente</h3>
          <button id="scanner-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>
        <p class="text-xs text-gray-500 mb-3">${!('BarcodeDetector' in window) ? 'Tu navegador no soporta escaneo por cámara. Ingresá el VIN a mano.' : ''}</p>
        <input id="manual-vin-input" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4" placeholder="Ingresar VIN..." autofocus>
        <button id="scanner-confirm-manual" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Confirmar</button>
      </div>`;
    document.body.appendChild(overlay);
    // Focus + enter handler
    setTimeout(() => document.getElementById('manual-vin-input')?.focus(), 100);
    return;
  }

  // Native BarcodeDetector path
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } }).then(stream => {
    scannerStream = stream;
    const overlay = document.createElement('div');
    overlay.id = 'scanner-overlay';
    overlay.className = 'scanner-overlay fixed inset-0 bg-black/90 flex items-center justify-center p-6';
    overlay.innerHTML = `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md relative">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">Escanear VIN</h3>
          <button id="scanner-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>
        <video id="scanner-video" autoplay playsinline class="w-full rounded-lg bg-black mb-4" style="max-height:50vh"></video>
        <canvas id="scanner-canvas"></canvas>
        <p id="scanner-status" class="text-xs text-gray-500 text-center">Enfocá el código de barras del VIN...</p>
        <button id="scanner-manual-input" class="w-full mt-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Ingresar manualmente</button>
      </div>`;
    document.body.appendChild(overlay);
    const video = document.getElementById('scanner-video');
    video.srcObject = stream;
    const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'codabar', 'ean_13', 'ean_8', 'qr_code'] });
    let scanning = true;
    const scanLoop = () => {
      if (!scanning) return;
      detector.detect(video).then(barcodes => {
        if (barcodes.length > 0) {
          // VINs are typically 17 chars; pick longest barcode value as likely VIN
          const best = barcodes.sort((a, b) => b.rawValue.length - a.rawValue.length)[0];
          if (best.rawValue.length >= 11) {
            document.getElementById('ingreso-vin').value = best.rawValue;
            closeScanner();
            return;
          }
        }
        requestAnimationFrame(scanLoop);
      }).catch(() => { requestAnimationFrame(scanLoop); });
    };
    scanLoop();
  }).catch(() => {
    // Camera permission denied or unavailable
    scanVinCamera(true);
  });
}

document.addEventListener('submit', async (e) => {
  // ── UI-001c: Nueva Orden submit ──
  const newOrdenForm = e.target.closest('#new-orden-form');
  if (newOrdenForm) {
    e.preventDefault();
    const clienteId = document.querySelector('#no-cliente')?.value;
    const vehiculoId = document.querySelector('#no-vehiculo')?.value;
    const desc = document.querySelector('#no-desc')?.value?.trim();
    const isHv = document.querySelector('#no-hv')?.checked || false;
    if (!clienteId || !vehiculoId || !desc) return;
    // Create via ingresos endpoint which creates an OT
    try {
      await api('/workshop/ingresos', {
        method: 'POST',
        body: { vehicleId: { id: vehiculoId }, clientId: { id: clienteId }, crearOrden: true, descripcionTrabajo: desc, hvAlert: isHv },
      });
      closeModal();
      if (state.activeView === 'ordenes') fetchOrdenes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
    return;
  }

  const userForm = e.target.closest('#user-form');
  if (userForm) handleUserFormSubmit(e);

  // ── UI-002: Ingreso submit ──
  const ingresoForm = e.target.closest('#ingreso-form');
  if (ingresoForm) {
    e.preventDefault();
    const clienteId = document.querySelector('#ingreso-cliente')?.value || null;
    const vehiculoId = document.querySelector('#ingreso-vehiculo')?.value || null;
    const vin = document.querySelector('#ingreso-vin')?.value?.trim() || undefined;
    const km = parseInt(document.querySelector('#ingreso-km')?.value || '0', 10) || undefined;
    const fuel = document.querySelector('#ingreso-fuel')?.value || undefined;
    const exterior = document.querySelector('#ingreso-exterior')?.value?.trim() || undefined;
    const crearOrden = document.querySelector('#ingreso-crear-ot')?.checked || false;
    const desc = document.querySelector('#ingreso-desc')?.value?.trim() || undefined;
    const msgEl = document.querySelector('#ingreso-msg');
    if (!clienteId || !vehiculoId) {
      if (msgEl) { msgEl.textContent = 'Selecciona un cliente y vehículo'; msgEl.className = 'text-sm text-center text-red-400'; msgEl.classList.remove('hidden'); }
      return;
    }
    if (msgEl) { msgEl.textContent = 'Registrando...'; msgEl.className = 'text-sm text-center text-blue-400'; msgEl.classList.remove('hidden'); }
    try {
      await api('/workshop/ingresos', {
        method: 'POST',
        body: {
          vehicleId: vehiculoId ? { id: vehiculoId } : vin ? { vin } : null,
          clientId: { id: clienteId },
          kilometraje: km,
          nivelCombustible: fuel,
          estadoExterior: exterior,
          observaciones: exterior,
          crearOrden,
          descripcionTrabajo: desc,
        },
      });
      if (msgEl) { msgEl.textContent = '✅ Ingreso registrado correctamente'; msgEl.className = 'text-sm text-center text-green-400'; }
      document.querySelector('#ingreso-form')?.reset();
      // Reload dropdowns
      loadIngresoForm();
    } catch (err) {
      if (msgEl) { msgEl.textContent = 'Error: ' + err.message; msgEl.className = 'text-sm text-center text-red-400'; }
    }
    return;
  }

  // ── Quick Client form ──
  const qcForm = e.target.closest('#quick-client-form');
  if (qcForm) {
    e.preventDefault();
    const name = document.querySelector('#qc-name')?.value?.trim();
    if (!name) return;
    try {
      const result = await api('/workshop/clientes', { method: 'POST', body: {
        name,
        ruc: document.querySelector('#qc-ruc')?.value?.trim() || undefined,
        phone: document.querySelector('#qc-phone')?.value?.trim() || undefined,
      }});
      closeModal();
      loadIngresoForm();
    } catch (err) {
      const el = document.querySelector('#quick-client-form p.text-red-400') || document.querySelector('#quick-client-form');
      if (el && !el.matches('p')) {
        const p = document.createElement('p');
        p.className = 'text-red-400 text-sm text-center';
        p.textContent = 'Error: ' + err.message;
        el.appendChild(p);
      }
    }
    return;
  }

  // ── Facturación: Emitir Factura submit ──
  const facturarForm = e.target.closest('#facturar-form');
  if (facturarForm) {
    e.preventDefault();
    const ordenId = document.querySelector('#facturar-orden-id')?.value;
    const tipo = document.querySelector('input[name="facturar-tipo"]:checked')?.value;
    const numManual = document.querySelector('#facturar-num-manual')?.value?.trim();
    if (!ordenId || !tipo) return;
    const msgEl = document.querySelector('#facturar-msg');
    if (msgEl) { msgEl.textContent = 'Procesando...'; msgEl.className = 'text-sm text-center text-blue-400'; msgEl.classList.remove('hidden'); }
    const body = { ordenId, tipoFacturacion: tipo };
    if (tipo === 'MANUAL') {
      if (!numManual) { if (msgEl) { msgEl.textContent = 'Ingrese el número de factura preimpresa'; msgEl.className = 'text-sm text-center text-red-400'; } return; }
      body.numeroFacturaManual = numManual;
    }
    api('/finance/invoices/issue', { method: 'POST', body })
      .then(() => {
        closeModal();
        if (state.activeView === 'facturacion') renderFacturacion(document.querySelector('#view-content'));
      })
      .catch((err) => { if (msgEl) { msgEl.textContent = 'Error: ' + err.message; msgEl.className = 'text-sm text-center text-red-400'; } });
    return;
  }

  // ── Inventario Form Submits ──
  const repForm = e.target.closest('#repuesto-form');
  if (repForm) { e.preventDefault(); handleRepuestoFormSubmit(e); return; }

  const movForm = e.target.closest('#stock-mov-form');
  if (movForm) { e.preventDefault(); handleStockMovFormSubmit(e); return; }

  const configForm = e.target.closest('#config-form');
  if (configForm) {
    e.preventDefault();
    const body = {
      companyName: document.querySelector('#cfg-name')?.value || '',
      rucOrTaxId: document.querySelector('#cfg-ruc')?.value || '',
      address: document.querySelector('#cfg-address')?.value || '',
      phone: document.querySelector('#cfg-phone')?.value || '',
      email: document.querySelector('#cfg-email')?.value || '',
    };
    api('/api/config/settings', { method: 'PUT', body }).then(() => {
      dom.sidebarCompany.textContent = body.companyName || 'AutomotiveOS';
      const el = document.querySelector('#config-msg');
      if (el) { el.textContent = 'Configuración guardada'; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 3000); }
    }).catch((err) => {
      const el = document.querySelector('#config-msg');
      if (el) { el.textContent = 'Error: ' + err.message; el.className = 'text-sm mt-2 text-red-400'; el.classList.remove('hidden'); }
    });
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('.hv-check')) {
    const all = Array.from(document.querySelectorAll('.hv-check')).every(c => c.checked);
    const mech = document.querySelector('#hv-mechanic');
    const btn = document.querySelector('#hv-sign');
    if (btn) btn.disabled = !(all && mech && mech.value.trim());
  }
});

document.addEventListener('input', (e) => {
  if (e.target.matches('#hv-mechanic')) {
    const all = Array.from(document.querySelectorAll('.hv-check')).every(c => c.checked);
    const btn = document.querySelector('#hv-sign');
    if (btn) btn.disabled = !(all && e.target.value.trim());
  }
});

document.addEventListener('click', (e) => {
  const hvSign = e.target.closest('#hv-sign');
  if (!hvSign || hvSign.disabled) return;
  const mechanic = document.querySelector('#hv-mechanic')?.value?.trim();
  if (!mechanic) return;
  hvSign.textContent = 'Firmando...';
  hvSign.disabled = true;
  const otEl = document.querySelector('#bay-tasks [class*="border-red-900"]');
  const otId = otEl ? otEl.dataset.otId : null;
  if (otId) {
    api(`/workshop/ordenes/${otId}/sign-lockout`, { method: 'POST', body: JSON.stringify({ mechanicId: mechanic }) }).catch(() => {});
  }
  const info = document.querySelector('#hv-signed-info');
  if (info) { info.classList.remove('hidden'); info.textContent = `✓ Lockout firmado por ${mechanic} — ${new Date().toLocaleString('es-PY')}`; }
  hvSign.textContent = 'Firmado';
});

// ═════════════════════════════════════════════════
//  RESPONSIVE SIDEBAR
// ═════════════════════════════════════════════════
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}
window.toggleSidebar = toggleSidebar;

// Close sidebar on navigation (mobile)
function closeSidebarMobile() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  }
}

// ═════════════════════════════════════════════════
//  APP BOOTSTRAP
// ═════════════════════════════════════════════════
(async function init() {
  const slug = localStorage.getItem('x-tenant-slug');
  if (slug) dom.loginSlug.value = slug;
  const ok = await checkAuth();
  if (!ok) {
    dom.loginScreen.classList.remove('hidden');
  }

  // Attach login form validation (if ux.js is loaded)
  if (typeof attachValidation === 'function' && dom.loginForm) {
    attachValidation('login-form', {
      'login-slug': Validators.required('El slug del taller es obligatorio'),
      'login-email': Validators.required('El correo electrónico es obligatorio'),
    }, { showToast: false, validateOnInput: false });
  }

  // Form submit handler (HTML5 form, works with Enter in any field)
  if (dom.loginForm) {
    dom.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      login();
    });
  }
})();

// ═════════════════════════════════════════════════
//  GLOBAL ERROR BOUNDARY
// ═════════════════════════════════════════════════
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
  showToast('Error inesperado: ' + (event.reason?.message || 'Operación fallida'), 'error');
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  showToast('Error del sistema: ' + (event.error?.message || 'Error desconocido'), 'error');
});

// ─── WebSocket Cleanup on Navigation (P2 Security) ────────
// Sprint 58+: Gracefully close WebSocket connections before page unload
// to prevent server-side zombie connections and resource leaks.
window.addEventListener('beforeunload', () => {
  if (state.ws) {
    state.ws.onclose = null; // Prevent reconnect attempt
    state.ws.close();
    state.ws = null;
  }
  if (state.wsReconnectTimer) {
    clearTimeout(state.wsReconnectTimer);
    state.wsReconnectTimer = null;
  }
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
});

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' :
                 type === 'success' ? 'bg-green-900/90 border-green-700 text-green-200' :
                 'bg-gray-800/90 border-gray-700 text-gray-200';
  toast.className = `fixed bottom-4 right-4 z-[9999] px-4 py-3 rounded-lg border text-sm max-w-sm shadow-lg ${colors} animate-slide-up`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
