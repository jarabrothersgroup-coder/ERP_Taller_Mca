/**
 * Client Portal — Frontend Module (Self-service).
 *
 * Features:
 *   - Magic link login
 *   - PIN quick login
 *   - Client dashboard (vehicles, orders, invoices)
 *   - Appointment booking
 *   - Feedback/rating submission
 *
 * @module js/client-portal
 */

/* global api, esc */

let _portalState = {
  session: null,
  client: null,
  view: 'login',
};

// ─── Login View ─────────────────────────────

function renderPortalLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950">
      <div class="w-full max-w-sm p-6">
        <div class="text-center mb-6">
          <div class="text-5xl mb-2">🔧</div>
          <h1 class="text-3xl font-extrabold tracking-tight">Portal del Cliente</h1>
          <p class="text-gray-500 text-sm mt-1">Consultá tus vehículos, facturas y turnos</p>
        </div>
        <div class="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 class="text-base font-semibold text-gray-200">Ingresar</h2>

          <!-- Magic Link -->
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
            <div class="flex gap-2">
              <input id="portal-email" type="email" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="tu@email.com">
              <button onclick="portalRequestMagicLink()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">📧 Enviar</button>
            </div>
            <p id="portal-magic-status" class="text-xs text-gray-500 mt-1 hidden"></p>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-gray-800"></div>
            <span class="text-xs text-gray-600">o</span>
            <div class="flex-1 h-px bg-gray-800"></div>
          </div>

          <!-- PIN Login -->
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Acceso rápido con PIN</label>
            <p class="text-xs text-gray-600 mb-2">Pedí tu PIN al taller</p>
            <div class="flex gap-2">
              <input id="portal-pin" type="text" maxlength="6" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono text-center tracking-widest" placeholder="••••••">
              <button onclick="portalLoginWithPIN()" class="px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition">🔑 Ingresar</button>
            </div>
            <p id="portal-pin-status" class="text-xs text-gray-500 mt-1 hidden"></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Magic Link ─────────────────────────────

async function portalRequestMagicLink() {
  const email = document.getElementById('portal-email')?.value?.trim();
  const status = document.getElementById('portal-magic-status');
  if (!email || !status) return;

  status.classList.remove('hidden', 'text-red-400');
  status.classList.add('text-gray-400');
  status.textContent = '⏳ Enviando enlace...';

  try {
    // Get tenant from URL or state
    const tenant = new URLSearchParams(window.location.search).get('tenant') || window._state?.tenantSlug || '';
    const result = await fetch('/portal/auth/magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenant },
      body: JSON.stringify({ email }),
    }).then(r => r.json());

    if (result.success) {
      status.classList.remove('text-gray-400');
      status.classList.add('text-green-400');
      status.textContent = '✅ Enlace enviado. Revisá tu correo.';

      // If link returned (dev mode), auto-login
      if (result.link) {
        setTimeout(async () => {
          const authResult = await fetch(`/portal/auth/magic/${result.link.split('/magic/')[1]}`, {
            headers: { 'X-Tenant-Slug': tenant },
          }).then(r => r.json());

          if (authResult.session) {
            _portalState.session = authResult.session;
            _portalState.client = authResult.client;
            portalShowDashboard();
          }
        }, 1000);
      }
    } else {
      status.classList.remove('text-gray-400');
      status.classList.add('text-red-400');
      status.textContent = `❌ ${result.message}`;
    }
  } catch (err) {
    status.classList.remove('text-gray-400');
    status.classList.add('text-red-400');
    status.textContent = `❌ Error de red`;
  }
}

// ─── PIN Login ──────────────────────────────

async function portalLoginWithPIN() {
  const pin = document.getElementById('portal-pin')?.value?.trim();
  const status = document.getElementById('portal-pin-status');
  if (!pin || !status) return;

  status.classList.remove('hidden', 'text-red-400');
  status.classList.add('text-gray-400');
  status.textContent = '⏳ Verificando PIN...';

  try {
    const tenant = new URLSearchParams(window.location.search).get('tenant') || window._state?.tenantSlug || '';
    const clientId = new URLSearchParams(window.location.search).get('client') || '';

    if (!clientId) {
      status.classList.remove('text-gray-400');
      status.classList.add('text-red-400');
      status.textContent = '❌ Falta clientId en la URL';
      return;
    }

    const result = await fetch('/portal/auth/pin/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenant },
      body: JSON.stringify({ clientId, pin }),
    }).then(r => r.json());

    if (result.session) {
      _portalState.session = result.session;
      _portalState.client = result.client;
      portalShowDashboard();
    } else {
      status.classList.remove('text-gray-400');
      status.classList.add('text-red-400');
      status.textContent = `❌ ${result.error}`;
    }
  } catch (err) {
    status.classList.remove('text-gray-400');
    status.classList.add('text-red-400');
    status.textContent = '❌ Error de red';
  }
}

// ─── Dashboard ──────────────────────────────

function portalShowDashboard() {
  const container = document.getElementById('view-content');
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">👋 Hola, ${esc(_portalState.client?.name || 'Cliente')}</h3>
          <p class="text-xs text-gray-500">Tu portal personal</p>
        </div>
        <button onclick="portalLogout()" class="px-3 py-1.5 text-gray-500 hover:text-red-400 text-sm transition">🚪 Salir</button>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onclick="portalShowSection('vehicles')" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center hover:border-blue-500 transition">
          <span class="text-2xl">🚗</span>
          <p class="text-sm text-white mt-2">Mis Vehículos</p>
        </button>
        <button onclick="portalShowSection('orders')" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center hover:border-blue-500 transition">
          <span class="text-2xl">📋</span>
          <p class="text-sm text-white mt-2">Órdenes</p>
        </button>
        <button onclick="portalShowSection('invoices')" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center hover:border-blue-500 transition">
          <span class="text-2xl">💰</span>
          <p class="text-sm text-white mt-2">Facturas</p>
        </button>
        <button onclick="portalShowSection('appointment')" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center hover:border-blue-500 transition">
          <span class="text-2xl">📅</span>
          <p class="text-sm text-white mt-2">Agendar Turno</p>
        </button>
      </div>

      <div id="portal-section-content"></div>
    </div>
  `;

  portalShowSection('vehicles');
}

async function portalShowSection(section) {
  const content = document.getElementById('portal-section-content');
  if (!content) return;

  content.innerHTML = '<p class="text-gray-500 text-sm text-center py-6">⏳ Cargando...</p>';

  try {
    const tenant = new URLSearchParams(window.location.search).get('tenant') || window._state?.tenantSlug || '';
    const headers = { 'X-Tenant-Slug': tenant, 'X-Portal-Session': _portalState.session };

    switch (section) {
      case 'vehicles': {
        const vehicles = await fetch('/portal/vehicles', { headers }).then(r => r.json());
        content.innerHTML = `
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-sm font-semibold text-gray-300 mb-3">🚗 Mis Vehículos</h4>
            ${!vehicles.length ? '<p class="text-gray-500 text-sm">No tenés vehículos registrados.</p>' : ''}
            <div class="space-y-2">
              ${(vehicles || []).map(v => `
                <div class="flex items-center justify-between py-2 border-b border-gray-800">
                  <div>
                    <p class="text-sm text-white">${esc(v.marca || '')} ${esc(v.modelo || '')}</p>
                    <p class="text-xs text-gray-500">Chapa: ${esc(v.chapa || 'S/N')} · VIN: ${esc(v.vin || 'N/A')}</p>
                  </div>
                  <span class="text-xs text-gray-500">${esc(v.anio || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        break;
      }
      case 'orders': {
        const orders = await fetch('/portal/orders', { headers }).then(r => r.json());
        const estadoColors = { RECEPCIONADO: 'text-blue-400', PRESUPUESTADO: 'text-yellow-400', EN_REPARACION: 'text-orange-400', LISTO_ENTREGA: 'text-purple-400', FINALIZADO_RETIRADO: 'text-green-400' };
        content.innerHTML = `
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-sm font-semibold text-gray-300 mb-3">📋 Mis Órdenes</h4>
            ${!orders.length ? '<p class="text-gray-500 text-sm">No tenés órdenes.</p>' : ''}
            <div class="space-y-2">
              ${(orders || []).map(o => `
                <div class="flex items-center justify-between py-2 border-b border-gray-800">
                  <div>
                    <p class="text-sm text-white">OT #${esc(o.numero || o.id?.substring(0, 8) || '')}</p>
                    <p class="text-xs text-gray-500">${esc(o.descripcion || o.motivoIngreso || '')}</p>
                  </div>
                  <span class="text-xs ${estadoColors[o.estado] || 'text-gray-500'}">${esc(o.estado || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        break;
      }
      case 'invoices': {
        const invoices = await fetch('/portal/invoices', { headers }).then(r => r.json());
        content.innerHTML = `
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-sm font-semibold text-gray-300 mb-3">💰 Mis Facturas</h4>
            ${!invoices.length ? '<p class="text-gray-500 text-sm">No tenés facturas.</p>' : ''}
            <div class="space-y-2">
              ${(invoices || []).map(f => `
                <div class="flex items-center justify-between py-2 border-b border-gray-800">
                  <div>
                    <p class="text-sm text-white">Factura Nº ${esc(f.numero || '')}</p>
                    <p class="text-xs text-gray-500">${esc(f.fechaEmision || '')}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-white">Gs. ${(f.total || 0).toLocaleString('es-PY')}</p>
                    <p class="text-xs ${f.estadoPago === 'PAGADO' ? 'text-green-400' : 'text-yellow-400'}">${esc(f.estadoPago || '')}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        break;
      }
      case 'appointment': {
        content.innerHTML = `
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-sm font-semibold text-gray-300 mb-3">📅 Agendar Turno</h4>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="text-xs text-gray-500 block mb-1">Fecha</label>
                <input id="portal-appt-date" type="date" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              </div>
              <div>
                <label class="text-xs text-gray-500 block mb-1">Hora</label>
                <select id="portal-appt-time" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
                  <option value="">Seleccionar...</option>
                  <option value="08:00">08:00</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="text-xs text-gray-500 block mb-1">Motivo</label>
              <textarea id="portal-appt-motivo" rows="2" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" placeholder="Service, cambio de aceite, revisión..."></textarea>
            </div>
            <button onclick="portalBookAppointment()" class="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition">📅 Agendar</button>
            <p id="portal-appt-status" class="text-xs text-center mt-2 hidden"></p>
          </div>
        `;
        break;
      }
    }
  } catch (err) {
    content.innerHTML = `<p class="text-red-400 text-sm text-center py-6">Error: ${err.message}</p>`;
  }
}

async function portalBookAppointment() {
  const date = document.getElementById('portal-appt-date')?.value;
  const time = document.getElementById('portal-appt-time')?.value;
  const motivo = document.getElementById('portal-appt-motivo')?.value;
  const status = document.getElementById('portal-appt-status');

  if (!date || !time || !motivo) {
    if (status) { status.classList.remove('hidden'); status.textContent = '❌ Completá todos los campos'; }
    return;
  }

  try {
    const tenant = new URLSearchParams(window.location.search).get('tenant') || window._state?.tenantSlug || '';
    const headers = { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenant, 'X-Portal-Session': _portalState.session };

    // Get first vehicle
    const vehicles = await fetch('/portal/vehicles', { headers: { 'X-Tenant-Slug': tenant, 'X-Portal-Session': _portalState.session } }).then(r => r.json());
    if (!vehicles?.length) {
      if (status) { status.classList.remove('hidden'); status.textContent = '❌ No tenés vehículos registrados'; }
      return;
    }

    await fetch('/portal/appointments', {
      method: 'POST',
      headers,
      body: JSON.stringify({ vehicleId: vehicles[0].id, date, time, motivo }),
    }).then(r => r.json());

    if (status) {
      status.classList.remove('hidden', 'text-red-400');
      status.classList.add('text-green-400');
      status.textContent = '✅ Turno agendado correctamente';
    }
  } catch (err) {
    if (status) { status.classList.remove('hidden'); status.textContent = `❌ ${err.message}`; }
  }
}

function portalLogout() {
  _portalState.session = null;
  _portalState.client = null;
  const container = document.getElementById('view-content');
  if (container) renderPortalLogin(container);
}

// ─── Exports ────────────────────────────────

window.renderPortalLogin = renderPortalLogin;
window.portalRequestMagicLink = portalRequestMagicLink;
window.portalLoginWithPIN = portalLoginWithPIN;
window.portalShowSection = portalShowSection;
window.portalBookAppointment = portalBookAppointment;
window.portalLogout = portalLogout;
