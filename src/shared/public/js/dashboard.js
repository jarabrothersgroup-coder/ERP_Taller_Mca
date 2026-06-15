function renderDashboard(container) {
  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Activas</p>
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
        <p class="text-gray-500 text-xs uppercase tracking-wider">Taller del Mes</p>
        <p class="mt-1"><span id="d-servicios" class="text-lg font-bold text-cyan-400">—</span> <span class="text-xs text-gray-500">servicios</span></p>
        <p class="text-[10px] text-gray-600"><span id="d-repuestos">0</span> repuestos, <span id="d-bajo-stock" class="text-orange-400">0</span> bajo stock</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <!-- Weekly bar chart -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow lg:col-span-2">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tendencia Semanal</h3>
        <div id="d-weekly-chart" class="flex items-end gap-2 h-32">
          <div class="text-center py-8 text-gray-600 text-sm w-full">Cargando...</div>
        </div>
      </div>
      <!-- OT status breakdown -->
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
          <div class="flex justify-between text-xs pt-2 border-t border-gray-800"><span class="text-gray-400">Pantallas</span><span id="d-pantallas" class="text-cyan-400 font-semibold">0</span></div>
        </div>
      </div>
    </div>

    <!-- Active OTs mini list -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Órdenes Activas</h3>
      <div id="d-ot-list" class="space-y-2">
        <div class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>`;
  fetchDashboardData();
}

async function fetchDashboardData() {
  // Parallel: analytics + websocket status
  const [kpis, wsStatus] = await Promise.all([
    api('/workshop/analytics/dashboard').catch(() => null),
    api('/api/v1/visual/status').catch(() => null),
  ]);
  if (!kpis) {
    document.querySelectorAll('[id^="d-"]').forEach(el => el && (el.textContent = '—'));
    return;
  }
  const o = kpis.ordenes;
  const f = kpis.finanzas;
  const t = kpis.taller;
  const i = kpis.inventario;

  // ── KPI cards ──
  $('d-activas').textContent = o.activas;
  $('d-presup').textContent = o.presupuestado;
  $('d-aprob').textContent = o.aprobado;
  $('d-proceso').textContent = o.enProceso;
  $('d-qc').textContent = o.controlCalidad;
  $('d-ingresos-mes').textContent = '₲ ' + fmt(f.ingresosMes);
  $('d-ingresos-semana').textContent = '₲ ' + fmt(f.ingresosSemana);
  $('d-pendiente').textContent = '₲ ' + fmt(f.pendienteCobro);
  $('d-facturas-mes').textContent = f.facturasEmitidasMes;
  $('d-servicios').textContent = t.serviciosRealizadosMes;
  $('d-repuestos').textContent = t.repuestosUsadosMes;
  $('d-bajo-stock').textContent = i.productosBajoStock;
  $('d-ots-mes').textContent = o.totalMes;
  $('d-hoy').textContent = o.completadasHoy;
  $('d-promedio').textContent = '₲ ' + fmt(t.facturacionPromedioOT);
  $('d-cobros').textContent = '₲ ' + fmt(f.cobrosMes);
  if (wsStatus && wsStatus.connectedScreens !== undefined) {
    $('d-pantallas').textContent = wsStatus.connectedScreens;
  }

  // ── Weekly bar chart (CSS bars) ──
  const chart = $('d-weekly-chart');
  if (kpis.tendenciaSemanal && kpis.tendenciaSemanal.length) {
    const maxIncome = Math.max(...kpis.tendenciaSemanal.map(d => d.ingresos), 1);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    chart.innerHTML = kpis.tendenciaSemanal.map((d, idx) => {
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

  // ── Active OTs list ──
  // Fetch active ingresos for OT list
  const ingresos = await api('/workshop/ingresos').catch(() => null);
  if (!ingresos || !ingresos.length) {
    $('d-ot-list').innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay órdenes activas</div>';
    return;
  }
  let rows = '';
  ingresos.forEach(ing => {
    const ot = ing.ordenTrabajo;
    if (ot) {
      rows += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition">
        <div><p class="text-sm font-medium">${ing.vehiculo || 'Vehículo'}</p>
        <p class="text-xs text-gray-500">${new Date(ing.fechaIngreso).toLocaleDateString('es-PY')}</p></div>
        <span class="status-badge ${statusBadge(ot.status)}">${ot.status}</span></div>`;
    }
  });
  if (!rows) rows = '<div class="text-center py-6 text-gray-600 text-sm">No hay órdenes activas</div>';
  $('d-ot-list').innerHTML = rows;
}

