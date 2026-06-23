function renderDashboard(container) {
  const userRole = window.state?.auth?.profile?.role || 'user';

  // ── Role-based dashboard rendering ──
  if (userRole === 'mechanic') {
    renderMechanicDashboard(container);
  } else if (userRole === 'manager') {
    renderManagerDashboard(container);
  } else if (userRole === 'admin') {
    renderAdminDashboard(container);
  } else {
    renderUserDashboard(container);
  }
}

// ═══════════════════════════════════════════════════
//  MECHANIC DASHBOARD — My assigned OTs + tasks
// ═══════════════════════════════════════════════════

function renderMechanicDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Mi Taller</h2>
      <p class="text-sm text-gray-500">Órdenes asignadas y tareas pendientes</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Mis OTs Activas</p>
        <p id="d-my-active" class="text-3xl font-bold mt-1 text-blue-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Completadas Hoy</p>
        <p id="d-my-completed-today" class="text-3xl font-bold mt-1 text-green-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Pendientes de Aprobación</p>
        <p id="d-my-pending" class="text-3xl font-bold mt-1 text-yellow-400">—</p>
      </div>
    </div>

    <!-- My Active OTs -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Mis Órdenes Asignadas</h3>
      <div id="d-my-ot-list" class="space-y-2">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-2 gap-4">
      <button onclick="navigate('workshop')" class="group bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow hover:border-blue-500/50 hover:bg-gray-800/50 transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30" aria-label="Ir al Taller">
        <svg class="w-7 h-7 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <p class="text-sm font-medium text-white mt-2">Ir al Taller</p>
        <p class="text-xs text-gray-500">Vista de bahía</p>
      </button>
      <button onclick="navigate('thinkcar')" class="group bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow hover:border-blue-500/50 hover:bg-gray-800/50 transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30" aria-label="Diagnóstico Thinkcar">
        <svg class="w-7 h-7 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>
        <p class="text-sm font-medium text-white mt-2">Diagnóstico</p>
        <p class="text-xs text-gray-500">Thinkcar OBD2</p>
      </button>
    </div>`;

  fetchMechanicDashboardData();
}

async function fetchMechanicDashboardData() {
  try {
    const data = await api('/config/dashboard/role');
    const el = (id) => document.getElementById(id);

    if (data.view === 'mechanic') {
      el('d-my-active') && (el('d-my-active').textContent = data.myActiveOTs ?? '0');
    }
  } catch {}

  // Fetch active OTs list
  try {
    const ingresos = await api('/workshop/ingresos');
    const listEl = document.getElementById('d-my-ot-list');
    if (!listEl) return;

    const activeOTs = (ingresos || []).filter(i => i.ordenTrabajo && i.ordenTrabajo.status !== 'Listo');
    if (!activeOTs.length) {
      listEl.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay órdenes activas</div>';
      return;
    }

    listEl.innerHTML = activeOTs.slice(0, 10).map(ing => {
      const ot = ing.ordenTrabajo;
      return `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition">
        <div>
          <p class="text-sm font-medium">${ing.vehiculo || 'Vehículo'}</p>
          <p class="text-xs text-gray-500">${ot.diagnosis ? ot.diagnosis.slice(0, 50) : 'Sin diagnóstico'}</p>
        </div>
        <span class="status-badge ${statusBadge(ot.status)}">${ot.status}</span>
      </div>`;
    }).join('');
  } catch {}
}

// ═══════════════════════════════════════════════════
//  MANAGER DASHBOARD — Branch KPIs + team
// ═══════════════════════════════════════════════════

function renderManagerDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Dashboard del Taller</h2>
      <p class="text-sm text-gray-500">KPIs, productividad del equipo y resumen</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">OTs Activas</p>
        <p id="d-activas" class="text-3xl font-bold mt-1 text-blue-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Ingresos del Mes</p>
        <p id="d-ingresos-mes" class="text-2xl font-bold mt-1 text-green-400">₲ —</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Completadas Mes</p>
        <p id="d-completed-month" class="text-3xl font-bold mt-1 text-purple-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Pendiente Cobro</p>
        <p id="d-pendiente" class="text-2xl font-bold mt-1 text-yellow-400">₲ —</p>
      </div>
    </div>

    <!-- Branch comparison (if multiple branches) -->
    <div id="d-branch-comparison" class="mb-6 hidden">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Comparación por Sucursal</h3>
      <div id="d-branch-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>

    <!-- OT status breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Órdenes del Mes</h3>
        <div class="text-center mb-4">
          <span id="d-ots-mes" class="text-4xl font-bold text-white">—</span>
          <p class="text-xs text-gray-500">creadas este mes</p>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-xs"><span class="text-gray-400">Completadas hoy</span><span id="d-hoy" class="text-green-400 font-semibold">0</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Facturación promedio</span><span id="d-promedio" class="text-blue-400 font-semibold">₲ 0</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Cobros del mes</span><span id="d-cobros" class="text-green-400 font-semibold">₲ 0</span></div>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3>
        <div id="d-activity-feed" class="space-y-2">
          <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
        </div>
      </div>
    </div>

    <!-- Active OTs -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Órdenes Activas</h3>
      <div id="d-ot-list" class="space-y-2">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>`;

  fetchManagerDashboardData();
}

async function fetchManagerDashboardData() {
  const [kpis, roleData] = await Promise.all([
    api('/workshop/analytics/dashboard').catch(() => null),
    api('/config/dashboard/role').catch(() => null),
  ]);

  const el = (id) => document.getElementById(id);

  if (kpis) {
    const o = kpis.ordenes;
    const f = kpis.finanzas;
    el('d-activas') && (el('d-activas').textContent = o.activas);
    el('d-ingresos-mes') && (el('d-ingresos-mes').textContent = '₲ ' + fmt(f.ingresosMes));
    el('d-pendiente') && (el('d-pendiente').textContent = '₲ ' + fmt(f.pendienteCobro));
    el('d-ots-mes') && (el('d-ots-mes').textContent = o.totalMes);
    el('d-hoy') && (el('d-hoy').textContent = o.completadasHoy);
    el('d-promedio') && (el('d-promedio').textContent = '₲ ' + fmt(kpis.taller?.facturacionPromedioOT || 0));
    el('d-cobros') && (el('d-cobros').textContent = '₲ ' + fmt(f.cobrosMes));
  }

  // Show branch comparison if admin/manager with multiple branches
  if (roleData && roleData.branches && roleData.branches.length > 1) {
    const branchDiv = el('d-branch-comparison');
    const cardsDiv = el('d-branch-cards');
    if (branchDiv && cardsDiv) {
      branchDiv.classList.remove('hidden');
      el('d-completed-month') && (el('d-completed-month').textContent = roleData.totalOTCompletadasMes || '0');
      cardsDiv.innerHTML = roleData.branches.map(b => `
        <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h4 class="font-medium text-white mb-2">${b.sucursalNombre}</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="text-gray-500">OTs Activas:</span> <span class="text-blue-400 font-semibold">${b.otActivas}</span></div>
            <div><span class="text-gray-500">Completadas:</span> <span class="text-green-400 font-semibold">${b.otCompletadasMes}</span></div>
            <div class="col-span-2"><span class="text-gray-500">Ingresos:</span> <span class="text-green-400 font-semibold">₲ ${fmt(b.ingresoMes)}</span></div>
          </div>
        </div>
      `).join('');
    }
  }

  // Activity feed
  fetchActivityFeed();
}

// ═══════════════════════════════════════════════════
//  ADMIN DASHBOARD — Full financial + cross-branch
// ═══════════════════════════════════════════════════

function renderAdminDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Panel Administrativo</h2>
      <p class="text-sm text-gray-500">Vista financiera completa y comparación multi-sucursal</p>
    </div>

    <!-- Primary KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">OTs Activas</p>
        <p id="d-activas" class="text-3xl font-bold mt-1 text-blue-400">—</p>
        <div class="flex gap-3 mt-2 text-[10px] text-gray-500">
          <span><span class="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"></span><span id="d-presup">0</span></span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"></span><span id="d-aprob">0</span></span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span><span id="d-proceso">0</span></span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-purple-400 mr-1"></span><span id="d-qc">0</span></span>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Ingresos del Mes</p>
        <p id="d-ingresos-mes" class="text-2xl font-bold mt-1 text-green-400">₲ —</p>
        <p class="text-[10px] text-gray-600 mt-1">Semana: <span id="d-ingresos-semana" class="text-green-400/70">₲ —</span></p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Pendiente de Cobro</p>
        <p id="d-pendiente" class="text-2xl font-bold mt-1 text-yellow-400">₲ —</p>
        <p class="text-[10px] text-gray-600 mt-1">Facturas emitidas: <span id="d-facturas-mes">0</span></p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Sucursales</p>
        <p id="d-total-branches" class="text-3xl font-bold mt-1 text-cyan-400">—</p>
        <p class="text-[10px] text-gray-600 mt-1">activas</p>
      </div>
    </div>

    <!-- Secondary KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Tiempo Promedio Reparación</p>
        <p id="d-avg-repair" class="text-2xl font-bold mt-1 text-purple-400">—</p>
        <p class="text-[10px] text-gray-600 mt-1">días por OT completada</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Tasa de Cobro</p>
        <p id="d-collection-rate" class="text-2xl font-bold mt-1 text-emerald-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Clientes Activos</p>
        <p id="d-active-clients" class="text-2xl font-bold mt-1 text-blue-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Margen Bruto</p>
        <p id="d-gross-margin" class="text-2xl font-bold mt-1 text-pink-400">—</p>
      </div>
    </div>

    <!-- Branch comparison -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Comparación Multi-Sucursal</h3>
      <div id="d-admin-branches" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>

    <!-- Charts + Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow lg:col-span-2">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tendencia Semanal</h3>
        <div id="d-weekly-chart" class="flex items-end gap-2 h-32">
          <div class="text-center py-8 text-gray-600 text-sm w-full">Cargando...</div>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actividad Reciente</h3>
        <div id="d-activity-feed" class="space-y-2">
          <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
        </div>
      </div>
    </div>

    <!-- Active OTs -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Órdenes Activas</h3>
      <div id="d-ot-list" class="space-y-2">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>`;

  fetchAdminDashboardData();
}

async function fetchAdminDashboardData() {
  const [kpis, consolidated] = await Promise.all([
    api('/workshop/analytics/dashboard').catch(() => null),
    api('/config/dashboard/consolidated').catch(() => null),
  ]);

  const el = (id) => document.getElementById(id);

  if (kpis) {
    const o = kpis.ordenes;
    const f = kpis.finanzas;
    const t = kpis.taller;
    el('d-activas') && (el('d-activas').textContent = o.activas);
    el('d-presup') && (el('d-presup').textContent = o.presupuestado);
    el('d-aprob') && (el('d-aprob').textContent = o.aprobado);
    el('d-proceso') && (el('d-proceso').textContent = o.enProceso);
    el('d-qc') && (el('d-qc').textContent = o.controlCalidad);
    el('d-ingresos-mes') && (el('d-ingresos-mes').textContent = '₲ ' + fmt(f.ingresosMes));
    el('d-ingresos-semana') && (el('d-ingresos-semana').textContent = '₲ ' + fmt(f.ingresosSemana));
    el('d-pendiente') && (el('d-pendiente').textContent = '₲ ' + fmt(f.pendienteCobro));
    el('d-facturas-mes') && (el('d-facturas-mes').textContent = f.facturasEmitidasMes);
    el('d-avg-repair') && (el('d-avg-repair').textContent = t.promedioDuracionDias ? t.promedioDuracionDias.toFixed(1) + ' días' : '—');
    el('d-gross-margin') && (el('d-gross-margin').textContent = t.margenBruto ? '₲ ' + fmt(t.margenBruto) : '—');

    if (f.facturasEmitidasMes > 0 && f.cobrosMes > 0) {
      const rate = Math.min(100, Math.round((f.cobrosMes / (f.ingresosMes || 1)) * 100));
      el('d-collection-rate') && (el('d-collection-rate').textContent = rate + '%');
    }

    // Weekly chart
    renderWeeklyChart(kpis.tendenciaSemanal);
  }

  // Branch comparison
  if (consolidated && consolidated.sucursales) {
    el('d-total-branches') && (el('d-total-branches').textContent = consolidated.totalSucursales);
    const branchDiv = el('d-admin-branches');
    if (branchDiv) {
      if (consolidated.sucursales.length === 0) {
        branchDiv.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm col-span-3">No hay sucursales configuradas</div>';
      } else {
        branchDiv.innerHTML = consolidated.sucursales.map(b => `
          <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-blue-500/50 transition">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-medium text-white">${b.sucursalNombre}</h4>
              <span class="text-xs text-gray-500">${b.otActivas} activas</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="bg-gray-900/50 rounded-lg p-2">
                <span class="text-gray-500 block">OTs Activas</span>
                <span class="text-blue-400 font-bold text-lg">${b.otActivas}</span>
              </div>
              <div class="bg-gray-900/50 rounded-lg p-2">
                <span class="text-gray-500 block">Completadas</span>
                <span class="text-green-400 font-bold text-lg">${b.otCompletadasMes}</span>
              </div>
              <div class="col-span-2 bg-gray-900/50 rounded-lg p-2">
                <span class="text-gray-500 block">Ingresos del Mes</span>
                <span class="text-green-400 font-bold">₲ ${fmt(b.ingresoMes)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // Active OTs list + Activity feed
  fetchActiveOTsList();
  fetchActivityFeed();
}

// ═══════════════════════════════════════════════════
//  USER DASHBOARD — Basic overview
// ═══════════════════════════════════════════════════

function renderUserDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Dashboard</h2>
      <p class="text-sm text-gray-500">Resumen del taller</p>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">OTs Activas</p>
        <p id="d-activas" class="text-3xl font-bold mt-1 text-blue-400">—</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Total OTs</p>
        <p id="d-total-ots" class="text-3xl font-bold mt-1 text-green-400">—</p>
      </div>
    </div>

    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Órdenes Recientes</h3>
      <div id="d-ot-list" class="space-y-2">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>`;

  fetchUserDashboardData();
}

async function fetchUserDashboardData() {
  try {
    const data = await api('/config/dashboard/role');
    const el = (id) => document.getElementById(id);
    el('d-activas') && (el('d-activas').textContent = data.otActivas ?? '—');
    el('d-total-ots') && (el('d-total-ots').textContent = data.totalOTs ?? '—');
  } catch {}

  fetchActiveOTsList();
}

// ═══════════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════════

function renderWeeklyChart(tendenciaSemanal) {
  const chart = document.getElementById('d-weekly-chart');
  if (!chart) return;
  if (tendenciaSemanal && tendenciaSemanal.length) {
    const maxIncome = Math.max(...tendenciaSemanal.map(d => d.ingresos), 1);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    chart.innerHTML = tendenciaSemanal.map(d => {
      const pct = (d.ingresos / maxIncome) * 100;
      const dayName = days[new Date(d.fecha + 'T12:00:00').getDay()];
      return `<div class="flex-1 flex flex-col items-center gap-1">
        <span class="text-[9px] text-gray-500">${fmt(d.ingresos)}</span>
        <div class="w-full bg-gray-800 rounded-full h-16 relative flex items-end justify-center">
          <div class="w-3/4 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm transition-all duration-500" style="height:${Math.max(pct, 5)}%"></div>
        </div>
        <span class="text-[10px] text-gray-500">${dayName}</span>
        <span class="text-[9px] text-gray-600">${d.ordenesCompletadas} OT</span>
      </div>`;
    }).join('');
  } else {
    chart.innerHTML = '<div class="text-center py-4 text-gray-600 text-sm w-full">Sin datos semanales</div>';
  }
}

async function fetchActiveOTsList() {
  try {
    const ingresos = await api('/workshop/ingresos');
    const listEl = document.getElementById('d-ot-list');
    if (!listEl) return;

    const activeOTs = (ingresos || []).filter(i => i.ordenTrabajo && i.ordenTrabajo.status !== 'Listo');
    if (!activeOTs.length) {
      listEl.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay órdenes activas</div>';
      return;
    }

    listEl.innerHTML = activeOTs.slice(0, 8).map(ing => {
      const ot = ing.ordenTrabajo;
      return `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition">
        <div>
          <p class="text-sm font-medium">${ing.vehiculo || 'Vehículo'}</p>
          <p class="text-xs text-gray-500">${new Date(ing.fechaIngreso).toLocaleDateString('es-PY')}</p>
        </div>
        <span class="status-badge ${statusBadge(ot.status)}">${ot.status}</span>
      </div>`;
    }).join('');
  } catch {}
}

async function fetchActivityFeed() {
  try {
    const auditLog = await api('/finance/contabilidad/audit-log?limit=8');
    const feedDiv = document.getElementById('d-activity-feed');
    if (!feedDiv) return;

    const entries = auditLog?.entries || [];
    if (!entries.length) {
      feedDiv.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">Sin actividad reciente</div>';
      return;
    }

    const actionIcons = {
      CREAR: '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
      MODIFICAR: '<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
      ANULAR: '<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      PAGAR: '<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      EMITIR: '<svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
    };
    feedDiv.innerHTML = entries.map(e => `
      <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition">
        <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center">${actionIcons[e.accion] || '<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>'}</span>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-white truncate">${e.accion} — ${e.entidad}</p>
          <p class="text-[10px] text-gray-500">${e.detalle ? e.detalle.slice(0, 60) : '—'}</p>
        </div>
        <span class="text-[10px] text-gray-600 flex-shrink-0">${e.createdAt ? timeAgo(new Date(e.createdAt)) : ''}</span>
      </div>
    `).join('');
  } catch {}
}

function statusBadge(s) {
  const m = { Presupuestado: 'bg-gray-700 text-gray-300', Aprobado: 'bg-blue-900/50 text-blue-300', En_Proceso: 'bg-yellow-900/50 text-yellow-300', Control_Calidad: 'bg-purple-900/50 text-purple-300', Listo: 'bg-green-900/50 text-green-300' };
  return m[s] || 'bg-gray-700 text-gray-300';
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'min';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
}
