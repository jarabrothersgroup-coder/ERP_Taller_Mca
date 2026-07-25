/* ═══════════════════════════════════════════════════════════════════
   Executive Dashboard — P2.9 — Unified KPIs for Business Owner
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderExecutiveDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Dashboard Ejecutivo</h2>
      <p class="text-sm text-gray-500">KPIs consolidados del taller</p>
    </div>
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" id="exec-kpis">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-3 bg-gray-800 rounded w-16 mb-2"></div><div class="h-7 bg-gray-800 rounded w-12"></div></div>
    </div>
    <!-- Pipeline -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6" id="exec-pipeline">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline de OTs por Estado</h3>
      <div class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
    </div>
    <!-- Two columns: Revenue + Top Services -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow" id="exec-revenue">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Ingresos Mensuales (6 meses)</h3>
        <div class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow" id="exec-top-services">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top 5 Servicios</h3>
        <div class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>
    <!-- Two columns: Low Stock + Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow" id="exec-low-stock">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Alertas de Stock Bajo</h3>
        <div class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow" id="exec-activity">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3>
        <div class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>`;

  loadExecutiveData();
}

async function loadExecutiveData() {
  // Fetch all data in parallel
  const [analytics, ordenes, inventario] = await Promise.all([
    api('/workshop/analytics/productividad').catch(() => null),
    api('/workshop/ordenes').catch(() => null),
    api('/inventory/repuestos').catch(() => null)
  ]);

  renderKPICards(analytics, ordenes, inventario);
  renderPipeline(ordenes);
  renderRevenueChart(analytics);
  renderTopServices();
  renderLowStock(inventario);
  renderActivity(ordenes);
}

// ─── KPI Cards ──────────────────────────────────────
function renderKPICards(analytics, ordenes, inventario) {
  const el = $('exec-kpis');
  if (!el) return;

  const r = analytics?.resumen || {};
  const otList = ordenes?.data || ordenes || [];
  const items = inventario?.data || inventario || [];

  // OTs abiertas: all except Finalizado_Retirado
  const otsAbiertas = Array.isArray(otList) ? otList.filter(o => o.status !== 'Finalizado_Retirado').length : 0;
  const otsCompletadas = r.totalOTsCompletadas || 0;
  const ingresosMes = r.ingresosPeriodo || 0;
  const margenBruto = r.eficienciaPorcentaje || 0;
  const ticketPromedio = otsCompletadas > 0 ? Math.round(ingresosMes / otsCompletadas) : 0;

  // Unique clients
  const uniqueClients = new Set();
  if (Array.isArray(otList)) {
    otList.forEach(o => { if (o.clienteId || o.cliente) uniqueClients.add(o.clienteId || o.cliente); });
  }

  // Stock bajo
  const stockBajo = Array.isArray(items) ? items.filter(i => (i.stockActual || 0) <= (i.stockMinimo || 0)).length : 0;

  const kpis = [
    { label: 'OTs Abiertas', value: otsAbiertas, icon: '📋', color: 'text-blue-400' },
    { label: 'Ingresos Mes', value: `₲ ${fmt(ingresosMes)}`, icon: '💰', color: 'text-green-400' },
    { label: 'Margen Bruto', value: `${margenBruto}%`, icon: '📊', color: margenBruto >= 30 ? 'text-emerald-400' : 'text-yellow-400' },
    { label: 'Clientes', value: uniqueClients.size || '—', icon: '👥', color: 'text-cyan-400' },
    { label: 'Ticket Prom.', value: `₲ ${fmt(ticketPromedio)}`, icon: '🎫', color: 'text-purple-400' },
    { label: 'Stock Bajo', value: stockBajo, icon: '⚠️', color: stockBajo > 0 ? 'text-red-400' : 'text-green-400' }
  ];

  el.innerHTML = kpis.map(k => `
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-lg">${k.icon}</span>
        <p class="text-gray-500 text-xs uppercase tracking-wider">${k.label}</p>
      </div>
      <p class="text-2xl font-bold ${k.color}">${k.value}</p>
    </div>`).join('');
}

// ─── OT Status Pipeline ─────────────────────────────
function renderPipeline(ordenes) {
  const el = $('exec-pipeline');
  if (!el) return;

  const otList = ordenes?.data || ordenes || [];
  if (!Array.isArray(otList) || otList.length === 0) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline de OTs por Estado</h3><div class="text-center py-6 text-gray-600 text-sm">Sin datos disponibles</div>';
    return;
  }

  const statuses = ['Presupuestado', 'Aprobado', 'En_Proceso', 'Control_Calidad', 'Listo', 'Finalizado_Retirado'];
  const colors = { Presupuestado: 'bg-yellow-500', Aprobado: 'bg-blue-500', En_Proceso: 'bg-orange-500', Control_Calidad: 'bg-purple-500', Listo: 'bg-cyan-500', Finalizado_Retirado: 'bg-green-500' };
  const counts = {};
  statuses.forEach(s => counts[s] = 0);
  otList.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  const maxCount = Math.max(...Object.values(counts), 1);

  el.innerHTML = `
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline de OTs por Estado</h3>
    <div class="space-y-3">
      ${statuses.map(s => {
        const pct = (counts[s] / maxCount) * 100;
        return `<div class="flex items-center gap-3">
          <span class="text-xs text-gray-500 w-28 text-right truncate" title="${s.replace(/_/g, ' ')}">${s.replace(/_/g, ' ')}</span>
          <div class="flex-1 bg-gray-800 rounded-full h-5 relative overflow-hidden">
            <div class="${colors[s]} rounded-full h-5 transition-all duration-500" style="width:${pct}%"></div>
          </div>
          <span class="text-sm font-semibold text-white w-8 text-right">${counts[s]}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Revenue by Month (6 months) ────────────────────
function renderRevenueChart(analytics) {
  const el = $('exec-revenue');
  if (!el) return;

  const months = analytics?.detalleMensual || [];
  if (!months.length) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Ingresos Mensuales</h3><div class="text-center py-6 text-gray-600 text-sm">Sin datos mensuales</div>';
    return;
  }

  // Take last 6 months
  const data = months.slice(-6);
  const maxIngresos = Math.max(...data.map(m => m.ingresos || 0), 1);

  el.innerHTML = `
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Ingresos Mensuales (6 meses)</h3>
    <div class="space-y-2">
      ${data.map(m => {
        const pct = ((m.ingresos || 0) / maxIngresos) * 100;
        return `<div class="flex items-center gap-3">
          <span class="text-xs text-gray-500 w-20 text-right">${m.mes}</span>
          <div class="flex-1 bg-gray-800 rounded-full h-4 relative overflow-hidden">
            <div class="bg-gradient-to-r from-green-600 to-green-400 rounded-full h-4 transition-all duration-500" style="width:${pct}%"></div>
          </div>
          <span class="text-xs font-medium text-green-400 w-24 text-right">₲ ${fmt(m.ingresos || 0)}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Top 5 Services ─────────────────────────────────
async function renderTopServices() {
  const el = $('exec-top-services');
  if (!el) return;

  const servicios = await api('/workshop/analytics/top-servicios?limit=5').catch(() => null);
  if (!servicios || !servicios.length) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top 5 Servicios</h3><div class="text-center py-6 text-gray-600 text-sm">Sin datos de servicios</div>';
    return;
  }

  const maxUsos = Math.max(...servicios.map(s => s.totalUsos), 1);

  el.innerHTML = `
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top 5 Servicios</h3>
    <div class="space-y-3">
      ${servicios.map((s, i) => {
        const pct = (s.totalUsos / maxUsos) * 100;
        return `<div class="flex items-center gap-3">
          <span class="text-sm font-bold text-gray-600 w-5">${i + 1}</span>
          <div class="flex-1">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">${esc(s.nombre)}</span>
              <span class="text-xs text-gray-500">${s.totalUsos} usos</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2">
              <div class="bg-blue-500 rounded-full h-2 transition-all" style="width:${pct}%"></div>
            </div>
          </div>
          <span class="text-xs text-green-400 w-20 text-right">₲ ${fmt(s.ingresosGenerados)}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Low Stock Alerts ───────────────────────────────
function renderLowStock(inventario) {
  const el = $('exec-low-stock');
  if (!el) return;

  const items = inventario?.data || inventario || [];
  const lowItems = Array.isArray(items) ? items.filter(i => (i.stockActual || 0) <= (i.stockMinimo || 0)).slice(0, 8) : [];

  if (!lowItems.length) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Alertas de Stock Bajo</h3><div class="text-center py-6 text-gray-600 text-sm">✅ Todo el stock está por encima del mínimo</div>';
    return;
  }

  el.innerHTML = `
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Alertas de Stock Bajo <span class="text-red-400">(${lowItems.length})</span></h3>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th class="text-left px-2 py-2">Repuesto</th>
          <th class="text-right px-2 py-2">Actual</th>
          <th class="text-right px-2 py-2">Mínimo</th>
          <th class="text-left px-2 py-2 w-20">Estado</th>
        </tr></thead>
        <tbody>${lowItems.map(item => {
          const actual = item.stockActual || 0;
          const minimo = item.stockMinimo || 1;
          const ratio = Math.min(actual / minimo, 1);
          return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
            <td class="px-2 py-2 font-medium">${esc(item.nombre || item.descripcion || '—')}</td>
            <td class="px-2 py-2 text-right text-red-400 font-semibold">${actual}</td>
            <td class="px-2 py-2 text-right text-gray-500">${minimo}</td>
            <td class="px-2 py-2"><div class="w-full bg-gray-800 rounded-full h-2"><div class="bg-red-500 rounded-full h-2" style="width:${ratio * 100}%"></div></div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}

// ─── Recent Activity Timeline ───────────────────────
function renderActivity(ordenes) {
  const el = $('exec-activity');
  if (!el) return;

  const otList = ordenes?.data || ordenes || [];
  if (!Array.isArray(otList)) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3><div class="text-center py-6 text-gray-600 text-sm">Sin actividad reciente</div>';
    return;
  }

  // Sort by updatedAt or createdAt descending, take top 10
  const recent = [...otList]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, 10);

  if (!recent.length) {
    el.innerHTML = '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3><div class="text-center py-6 text-gray-600 text-sm">Sin actividad reciente</div>';
    return;
  }

  const statusColors = {
    Presupuestado: 'bg-yellow-500', Aprobado: 'bg-blue-500', En_Proceso: 'bg-orange-500',
    Control_Calidad: 'bg-purple-500', Listo: 'bg-cyan-500', Finalizado_Retirado: 'bg-green-500'
  };

  el.innerHTML = `
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3>
    <div class="space-y-3">
      ${recent.map(o => {
        const date = o.updatedAt || o.createdAt;
        const dateFmt = date ? new Date(date).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
        const color = statusColors[o.status] || 'bg-gray-500';
        return `<div class="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
          <div class="w-2 h-2 rounded-full ${color} flex-shrink-0"></div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">OT #${esc(o.numero || o.id?.slice(0, 8) || '—')}</p>
            <p class="text-xs text-gray-500">${esc(o.cliente?.nombre || o.clienteNombre || 'Cliente')} — ${(o.status || '').replace(/_/g, ' ')}</p>
          </div>
          <span class="text-xs text-gray-600 flex-shrink-0">${dateFmt}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Helper ─────────────────────────────────────────
function $(id) { return document.getElementById(id); }
