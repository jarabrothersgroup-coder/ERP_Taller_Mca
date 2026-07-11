/**
 * CRM Module — Client Relationship Management view.
 *
 * Shows client pipeline, contact list, automotive stats, and quick actions.
 * All-in-one CRM without leaving the ERP dashboard.
 *
 * Enriched with automotive data: vehicle year/engine, mileage, DTC codes,
 * health score, service history, and accumulated visit/spend metrics.
 *
 * @module js/crm
 */

let crmClients = [];
let crmView = 'table'; // 'table' | 'pipeline'
let crmSearch = '';

/* ─── Automotive Helpers ─────────────────────────── */

/** Engine type badge colors */
const ENGINE_BADGES = {
  Nafta:  'bg-gray-700 text-gray-300',
  Diésel: 'bg-amber-900/50 text-amber-400',
  HEV:    'bg-blue-900/50 text-blue-400',
  BEV:    'bg-emerald-900/50 text-emerald-400',
};

/** Engine type icons (emoji fallback for simplicity) */
const ENGINE_ICONS = {
  Nafta:  '⛽',
  Diésel: '🛢️',
  HEV:    '🔌',
  BEV:    '🔋',
};

/** Health score → color class */
function healthColor(score) {
  if (score == null) return 'text-gray-600';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

/** Health score → background color class */
function healthBg(score) {
  if (score == null) return 'bg-gray-800';
  if (score >= 80) return 'bg-emerald-900/40';
  if (score >= 50) return 'bg-yellow-900/40';
  return 'bg-red-900/40';
}

/** Format mileage with "km" suffix */
function fmtKm(km) {
  if (km == null) return '—';
  return Number(km).toLocaleString('es-PY') + ' km';
}

/** Format engine type with icon */
function fmtEngine(type) {
  if (!type) return '—';
  return `${ENGINE_ICONS[type] || ''} ${esc(type)}`;
}

/** DTC badge (shows count + first code) */
function dtcBadge(dtcStr) {
  if (!dtcStr) return '';
  const codes = dtcStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!codes.length) return '';
  const label = codes.length > 1 ? `${codes.length} DTC` : codes[0];
  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/50 text-red-400 border border-red-800/50" title="${esc(dtcStr)}">⚠ ${esc(label)}</span>`;
}

/** Health score badge */
function healthBadge(score) {
  if (score == null) return '<span class="text-gray-600 text-xs">—</span>';
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${healthBg(score)} ${color} border border-gray-700/50">${score}/100</span>`;
}

/* ─── Main Render ────────────────────────────────── */

function renderCRM(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-gray-300">CRM — Clientes Automotriz</h2>
        <p class="text-sm text-gray-500">Gestión de clientes, pipeline y seguimiento comercial</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="crm-view-table" onclick="crmSetView('table')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${crmView === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Tabla</button>
        <button id="crm-view-pipeline" onclick="crmSetView('pipeline')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${crmView === 'pipeline' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg> Pipeline</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" id="crm-stats">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Total Clientes</p>
        <p id="crm-stat-total" class="text-3xl font-bold mt-1 text-blue-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Visitas Prom.</p>
        <p id="crm-stat-avg-visits" class="text-3xl font-bold mt-1 text-cyan-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">EV / HEV</p>
        <p id="crm-stat-ev" class="text-3xl font-bold mt-1 text-emerald-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Órdenes Activas</p>
        <p id="crm-stat-active" class="text-3xl font-bold mt-1 text-yellow-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Ingreso Total</p>
        <p id="crm-stat-revenue" class="text-3xl font-bold mt-1 text-purple-400">₲ 0</p>
      </div>
    </div>

    <!-- Search + Filters -->
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow mb-6">
      <div class="flex flex-col md:flex-row gap-3">
        <div class="flex-1 relative">
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input id="crm-search" type="text" placeholder="Buscar por nombre, teléfono, RUC, email o chapa..."
            class="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            oninput="crmFilterClients(this.value)">
        </div>
        <select id="crm-filter-stage" onchange="crmRenderList()" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          <option value="">Todos los estados</option>
          <option value="lead">Lead</option>
          <option value="prospecto">Prospecto</option>
          <option value="activo">Cliente Activo</option>
          <option value="vip">Cliente VIP</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <select id="crm-filter-engine" onchange="crmRenderList()" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          <option value="">Todos los motores</option>
          <option value="Nafta">⛽ Nafta</option>
          <option value="Diésel">🛢️ Diésel</option>
          <option value="HEV">🔌 Híbrido (HEV)</option>
          <option value="BEV">🔋 Eléctrico (BEV)</option>
        </select>
      </div>
    </div>

    <!-- Content Area -->
    <div id="crm-content">
      <div class="text-center py-12 text-gray-600 text-sm">Cargando clientes...</div>
    </div>

    <!-- Client Detail Modal -->
    <div id="crm-detail-overlay" class="hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)crmCloseDetail()">
      <div class="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto" id="crm-detail-panel"></div>
    </div>`;

  crmLoadData();
}

/* ─── Data Loading ───────────────────────────────── */

async function crmLoadData() {
  try {
    const [clients, topClients, ordenes, vehiculos] = await Promise.all([
      api('/workshop/clientes').catch(() => []),
      api('/workshop/analytics/top-clientes').catch(() => []),
      api('/workshop/ordenes').catch(() => []),
      api('/workshop/vehiculos').catch(() => []),
    ]);

    // Build vehicle lookup by clientId
    const vehiclesByClient = {};
    (vehiculos || []).forEach(v => {
      if (!vehiclesByClient[v.clientId]) vehiclesByClient[v.clientId] = [];
      vehiclesByClient[v.clientId].push(v);
    });

    crmClients = (clients || []).map(c => {
      const top = (topClients || []).find(t => t.clientId === c.id || t.clientName === c.name);
      const clientOrders = (ordenes || []).filter(o => o.clientId === c.id || o.clientName === c.name);
      const activeOrders = clientOrders.filter(o => o.status && !['Listo', 'Cancelado'].includes(o.status));
      const totalSpent = top?.totalRevenue || clientOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
      const lastVisit = clientOrders.length > 0
        ? clientOrders.sort((a, b) => new Date(b.fechaIngreso || b.createdAt) - new Date(a.fechaIngreso || a.createdAt))[0]
        : null;

      // Vehicle data (use first vehicle or most recent)
      const clientVehicles = vehiclesByClient[c.id] || [];
      const primaryVehicle = clientVehicles[0] || null;

      // Assign pipeline stage based on activity
      let stage = 'lead';
      if (clientOrders.length >= 10) stage = 'vip';
      else if (clientOrders.length >= 3) stage = 'activo';
      else if (clientOrders.length >= 1) stage = 'prospecto';

      return {
        ...c,
        totalSpent,
        activeOrders: activeOrders.length,
        totalOrders: clientOrders.length,
        lastVisit: lastVisit?.fechaIngreso || lastVisit?.createdAt || null,
        stage,
        // Automotive fields
        vehicles: clientVehicles,
        vehicleCount: clientVehicles.length,
        vehiclePlate: primaryVehicle?.plate || null,
        vehicleBrand: primaryVehicle?.brand || null,
        vehicleModel: primaryVehicle?.model || null,
        vehicleYear: primaryVehicle?.year || null,
        vehicleEngineType: primaryVehicle?.engineType || null,
        vehicleMileage: primaryVehicle?.kilometraje || null,
        vehicleVin: primaryVehicle?.vin || null,
        vehicleDtcCodes: (primaryVehicle?.dtcCodes || []).join(', ') || null,
      };
    });

    // Stats
    const totalVisits = crmClients.reduce((s, c) => s + c.totalOrders, 0);
    const avgVisits = crmClients.length > 0 ? (totalVisits / crmClients.length).toFixed(1) : '0';
    const evCount = crmClients.filter(c => c.vehicleEngineType === 'HEV' || c.vehicleEngineType === 'BEV').length;
    const activeOTs = crmClients.reduce((s, c) => s + c.activeOrders, 0);
    const totalRev = crmClients.reduce((s, c) => s + (c.totalSpent || 0), 0);

    const el = (id) => document.getElementById(id);
    el('crm-stat-total') && (el('crm-stat-total').textContent = crmClients.length);
    el('crm-stat-avg-visits') && (el('crm-stat-avg-visits').textContent = avgVisits);
    el('crm-stat-ev') && (el('crm-stat-ev').textContent = `${evCount} / ${crmClients.length}`);
    el('crm-stat-active') && (el('crm-stat-active').textContent = activeOTs);
    el('crm-stat-revenue') && (el('crm-stat-revenue').textContent = `₲ ${fmt(totalRev)}`);

    crmRenderList();
  } catch (e) {
    const content = document.getElementById('crm-content');
    if (content) content.innerHTML = `<div class="text-center py-12 text-red-400 text-sm">Error cargando datos: ${esc(e.message)}</div>`;
  }
}

/* ─── View Switching ─────────────────────────────── */

function crmSetView(v) {
  crmView = v;
  document.getElementById('crm-view-table')?.classList.toggle('bg-blue-600', v === 'table');
  document.getElementById('crm-view-table')?.classList.toggle('text-white', v === 'table');
  document.getElementById('crm-view-table')?.classList.toggle('bg-gray-800', v !== 'table');
  document.getElementById('crm-view-pipeline')?.classList.toggle('bg-blue-600', v === 'pipeline');
  document.getElementById('crm-view-pipeline')?.classList.toggle('text-white', v === 'pipeline');
  document.getElementById('crm-view-pipeline')?.classList.toggle('bg-gray-800', v !== 'pipeline');
  crmRenderList();
}

/* ─── Filtering ──────────────────────────────────── */

function crmFilterClients(query) {
  crmSearch = query.toLowerCase();
  crmRenderList();
}

function crmGetFiltered() {
  const stageFilter = document.getElementById('crm-filter-stage')?.value || '';
  const engineFilter = document.getElementById('crm-filter-engine')?.value || '';
  return crmClients.filter(c => {
    const matchSearch = !crmSearch ||
      (c.name || '').toLowerCase().includes(crmSearch) ||
      (c.phone || '').toLowerCase().includes(crmSearch) ||
      (c.ruc || '').toLowerCase().includes(crmSearch) ||
      (c.email || '').toLowerCase().includes(crmSearch) ||
      (c.vehiclePlate || '').toLowerCase().includes(crmSearch);
    const matchStage = !stageFilter || c.stage === stageFilter;
    const matchEngine = !engineFilter || c.vehicleEngineType === engineFilter;
    return matchSearch && matchStage && matchEngine;
  });
}

function crmRenderList() {
  const content = document.getElementById('crm-content');
  if (!content) return;
  const filtered = crmGetFiltered();

  if (crmView === 'pipeline') {
    crmRenderPipeline(content, filtered);
  } else {
    crmRenderTable(content, filtered);
  }
}

/* ─── Table View ─────────────────────────────────── */

function crmRenderTable(content, clients) {
  if (!clients.length) {
    content.innerHTML = `<div class="text-center py-12 text-gray-600 text-sm">No se encontraron clientes</div>`;
    return;
  }

  const stageColors = {
    lead: 'bg-gray-700 text-gray-300',
    prospecto: 'bg-blue-900/50 text-blue-400',
    activo: 'bg-green-900/50 text-green-400',
    vip: 'bg-purple-900/50 text-purple-400',
    inactivo: 'bg-red-900/50 text-red-400',
  };
  const stageLabels = { lead: 'Lead', prospecto: 'Prospecto', activo: 'Activo', vip: 'VIP', inactivo: 'Inactivo' };

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 card-glow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="px-3 py-3 text-left">Cliente</th>
              <th class="px-3 py-3 text-left">Vehículo</th>
              <th class="px-3 py-3 text-center">Año</th>
              <th class="px-3 py-3 text-center">Motor</th>
              <th class="px-3 py-3 text-right">Km</th>
              <th class="px-3 py-3 text-center">Estado</th>
              <th class="px-3 py-3 text-right">Visitas</th>
              <th class="px-3 py-3 text-right">Ingreso Total</th>
              <th class="px-3 py-3 text-center">DTC</th>
              <th class="px-3 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${clients.map(c => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition" onclick="crmShowDetail('${esc(c.id)}')">
                <td class="px-3 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 text-xs font-bold">${esc((c.name || '?')[0].toUpperCase())}</div>
                    <div>
                      <p class="text-white font-medium">${esc(c.name)}</p>
                      <p class="text-gray-500 text-xs">${esc(c.phone || '—')}</p>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3">
                  <div>
                    <p class="text-gray-300 text-xs">${esc(c.vehicleBrand || '')} ${esc(c.vehicleModel || '')}</p>
                    <p class="text-gray-500 text-[10px] font-mono">${esc(c.vehiclePlate || '—')}</p>
                  </div>
                </td>
                <td class="px-3 py-3 text-center text-gray-400 text-xs">${c.vehicleYear || '—'}</td>
                <td class="px-3 py-3 text-center">
                  ${c.vehicleEngineType ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${ENGINE_BADGES[c.vehicleEngineType] || 'bg-gray-700 text-gray-300'}">${fmtEngine(c.vehicleEngineType)}</span>` : '<span class="text-gray-600 text-xs">—</span>'}
                </td>
                <td class="px-3 py-3 text-right text-gray-400 text-xs">${fmtKm(c.vehicleMileage)}</td>
                <td class="px-3 py-3 text-center"><span class="px-2 py-1 rounded text-xs font-medium ${stageColors[c.stage] || ''}">${stageLabels[c.stage] || c.stage}</span></td>
                <td class="px-3 py-3 text-right text-gray-300">${c.totalOrders}</td>
                <td class="px-3 py-3 text-right text-green-400 font-medium">₲ ${fmt(c.totalSpent)}</td>
                <td class="px-3 py-3 text-center">${dtcBadge(c.vehicleDtcCodes)}</td>
                <td class="px-3 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    ${c.phone ? `<a href="https://wa.me/${esc(c.phone.replace(/[^0-9]/g, ''))}" target="_blank" onclick="event.stopPropagation()" class="p-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 transition text-xs" title="WhatsApp"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg></a>` : ''}
                    <button onclick="event.stopPropagation();crmShowDetail('${esc(c.id)}')" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition text-xs" title="Ver detalle"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-gray-600 mt-3 text-right">${clients.length} cliente(s)</p>`;
}

/* ─── Pipeline View ──────────────────────────────── */

function crmRenderPipeline(content, clients) {
  const stages = [
    { key: 'lead', label: 'Lead', color: 'border-gray-600' },
    { key: 'prospecto', label: 'Prospecto', color: 'border-blue-600' },
    { key: 'activo', label: 'Activo', color: 'border-green-600' },
    { key: 'vip', label: 'VIP', color: 'border-purple-600' },
    { key: 'inactivo', label: 'Inactivo', color: 'border-red-600' },
  ];

  content.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      ${stages.map(s => {
        const stageClients = clients.filter(c => c.stage === s.key);
        return `
          <div class="bg-gray-900/60 rounded-xl border border-gray-800 card-glow">
            <div class="px-4 py-3 border-b border-gray-800 ${s.color} border-t-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-300">${s.label}</span>
                <span class="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">${stageClients.length}</span>
              </div>
            </div>
            <div class="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
              ${stageClients.length ? stageClients.map(c => `
                <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 hover:border-blue-500/30 cursor-pointer transition" onclick="crmShowDetail('${esc(c.id)}')">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 text-[10px] font-bold">${esc((c.name || '?')[0].toUpperCase())}</div>
                    <span class="text-white text-xs font-medium truncate">${esc(c.name)}</span>
                    ${c.vehicleEngineType ? `<span class="text-[10px]">${ENGINE_ICONS[c.vehicleEngineType] || ''}</span>` : ''}
                  </div>
                  <p class="text-gray-500 text-[10px]">${esc(c.vehicleBrand || '')} ${esc(c.vehicleModel || '')} ${c.vehicleYear || ''}</p>
                  <p class="text-gray-500 text-[10px] font-mono">${esc(c.vehiclePlate || '—')}</p>
                  <div class="flex items-center justify-between mt-2 gap-1">
                    <span class="text-green-400 text-[10px] font-medium">₲ ${fmt(c.totalSpent)}</span>
                    <span class="text-gray-600 text-[10px]">${c.totalOrders} OTs</span>
                    ${c.vehicleMileage ? `<span class="text-gray-600 text-[10px]">${fmtKm(c.vehicleMileage)}</span>` : ''}
                  </div>
                  <div class="flex items-center gap-1 mt-1 flex-wrap">
                    ${dtcBadge(c.vehicleDtcCodes)}
                    ${c.vehicleEngineType && (c.vehicleEngineType === 'HEV' || c.vehicleEngineType === 'BEV') ? `<span class="px-1 py-0.5 rounded text-[9px] font-medium bg-emerald-900/50 text-emerald-400">EV</span>` : ''}
                  </div>
                  ${c.phone ? `<a href="https://wa.me/${esc(c.phone.replace(/[^0-9]/g, ''))}" target="_blank" onclick="event.stopPropagation()" class="mt-2 block text-center text-[10px] py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/50 transition flex items-center justify-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg> WhatsApp</a>` : ''}
                </div>
              `).join('') : '<p class="text-gray-600 text-xs text-center py-4">Sin clientes</p>'}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ─── Detail View ────────────────────────────────── */

async function crmShowDetail(clientId) {
  const overlay = document.getElementById('crm-detail-overlay');
  const panel = document.getElementById('crm-detail-panel');
  if (!overlay || !panel) return;

  overlay.classList.remove('hidden');
  panel.innerHTML = `<div class="p-6 text-center text-gray-500">Cargando detalle...</div>`;

  const client = crmClients.find(c => c.id === clientId);
  if (!client) {
    panel.innerHTML = `<div class="p-6 text-center text-red-400">Cliente no encontrado</div>`;
    return;
  }

  let history = [];
  try {
    history = await api(`/workshop/clientes/${clientId}/history`).catch(() => []);
  } catch {}

  const stageColors = {
    lead: 'bg-gray-700 text-gray-300',
    prospecto: 'bg-blue-900/50 text-blue-400',
    activo: 'bg-green-900/50 text-green-400',
    vip: 'bg-purple-900/50 text-purple-400',
    inactivo: 'bg-red-900/50 text-red-400',
  };
  const stageLabels = { lead: 'Lead', prospecto: 'Prospecto', activo: 'Activo', vip: 'VIP', inactivo: 'Inactivo' };

  const orders = Array.isArray(history) ? history : (history?.ordenes || []);

  panel.innerHTML = `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 text-xl font-bold">${esc((client.name || '?')[0].toUpperCase())}</div>
          <div>
            <h3 class="text-xl font-bold text-white">${esc(client.name)}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="px-2 py-0.5 rounded text-xs font-medium ${stageColors[client.stage] || ''}">${stageLabels[client.stage] || client.stage}</span>
              <span class="text-gray-500 text-xs">Cliente desde ${new Date(client.createdAt).toLocaleDateString('es-PY')}</span>
            </div>
          </div>
        </div>
        <button onclick="crmCloseDetail()" class="text-gray-500 hover:text-white transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>

      <!-- Quick Actions -->
      <div class="flex gap-2 mb-6">
        ${client.phone ? `<a href="https://wa.me/${esc(client.phone.replace(/[^0-9]/g, ''))}" target="_blank" class="flex items-center gap-2 px-4 py-2 bg-green-900/30 hover:bg-green-900/50 border border-green-800/30 rounded-lg text-sm text-green-400 font-medium transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg> WhatsApp</a>` : ''}
        <button onclick="crmCloseDetail()" class="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 font-medium transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Copiar datos</button>
      </div>

      <!-- Contact Info Grid -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Teléfono</p>
          <p class="text-white text-sm mt-1">${esc(client.phone || '—')}</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Email</p>
          <p class="text-white text-sm mt-1">${esc(client.email || '—')}</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">RUC / C.I.</p>
          <p class="text-white text-sm mt-1 font-mono">${esc(client.ruc || '—')}</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Dirección</p>
          <p class="text-white text-sm mt-1">${esc(client.address || '—')}</p>
        </div>
      </div>

      <!-- Vehicle Section -->
      ${client.vehicleBrand ? `
        <div class="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700/50">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Vehículo Principal</h4>
            ${client.vehicleEngineType ? `<span class="px-2 py-0.5 rounded text-xs font-medium ${ENGINE_BADGES[client.vehicleEngineType] || ''}">${fmtEngine(client.vehicleEngineType)}</span>` : ''}
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p class="text-gray-500 text-[10px] uppercase">Marca / Modelo</p>
              <p class="text-white text-sm font-medium">${esc(client.vehicleBrand)} ${esc(client.vehicleModel || '')}</p>
            </div>
            <div>
              <p class="text-gray-500 text-[10px] uppercase">Año</p>
              <p class="text-white text-sm">${client.vehicleYear || '—'}</p>
            </div>
            <div>
              <p class="text-gray-500 text-[10px] uppercase">Chapa</p>
              <p class="text-white text-sm font-mono">${esc(client.vehiclePlate || '—')}</p>
            </div>
            <div>
              <p class="text-gray-500 text-[10px] uppercase">Kilometraje</p>
              <p class="text-white text-sm">${fmtKm(client.vehicleMileage)}</p>
            </div>
            ${client.vehicleVin ? `
              <div class="col-span-2">
                <p class="text-gray-500 text-[10px] uppercase">VIN</p>
                <p class="text-gray-400 text-xs font-mono">${esc(client.vehicleVin)}</p>
              </div>
            ` : ''}
          </div>
          ${client.vehicleDtcCodes ? `
            <div class="mt-3 pt-3 border-t border-gray-700/50">
              <p class="text-gray-500 text-[10px] uppercase mb-1">Códigos DTC</p>
              <div class="flex flex-wrap gap-1">
                ${client.vehicleDtcCodes.split(',').map(code => `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-900/50 text-red-400 border border-red-800/50">${esc(code.trim())}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- All Vehicles -->
      ${(client.vehicles && client.vehicles.length > 1) ? `
        <div class="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700/50">
          <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Todos los Vehículos (${client.vehicles.length})</h4>
          <div class="space-y-2">
            ${client.vehicles.map(v => `
              <div class="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                <div>
                  <span class="text-white text-xs">${esc(v.brand)} ${esc(v.model || '')}</span>
                  <span class="text-gray-500 text-xs ml-2">${v.year || ''}</span>
                  <span class="text-gray-500 text-xs font-mono ml-2">${esc(v.plate || '—')}</span>
                </div>
                <div class="flex items-center gap-2">
                  ${v.engineType ? `<span class="text-[10px]">${ENGINE_ICONS[v.engineType] || ''} ${esc(v.engineType)}</span>` : ''}
                  ${v.kilometraje ? `<span class="text-gray-500 text-[10px]">${fmtKm(v.kilometraje)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-blue-400">${client.totalOrders}</p>
          <p class="text-gray-500 text-xs">Órdenes Totales</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-yellow-400">${client.activeOrders}</p>
          <p class="text-gray-500 text-xs">Activas</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-green-400">₲ ${fmt(client.totalSpent)}</p>
          <p class="text-gray-500 text-xs">Ingreso Total</p>
        </div>
      </div>

      <!-- Notes -->
      ${client.notes ? `
        <div class="bg-gray-800/50 rounded-lg p-4 mb-6">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">Notas</p>
          <p class="text-gray-300 text-sm">${esc(client.notes)}</p>
        </div>
      ` : ''}

      <!-- Recent Orders -->
      <div>
        <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Órdenes Recientes</h4>
        ${orders.length ? `
          <div class="space-y-2">
            ${orders.slice(0, 10).map(o => `
              <div class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between border border-gray-700/50">
                <div>
                  <p class="text-white text-sm font-medium">${esc(o.vehiculo || o.vehiclePlate || 'Vehículo')}</p>
                  <p class="text-gray-500 text-xs">${new Date(o.fechaIngreso || o.createdAt).toLocaleDateString('es-PY')}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-medium ${statusBadge(o.status)}">${esc(o.status || '')}</span>
                  <span class="text-green-400 text-xs font-medium">₲ ${fmt(o.totalCost || 0)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-gray-600 text-sm text-center py-4">Sin órdenes registradas</p>'}
      </div>
    </div>`;
}

function crmCloseDetail() {
  const overlay = document.getElementById('crm-detail-overlay');
  if (overlay) overlay.classList.add('hidden');
}
