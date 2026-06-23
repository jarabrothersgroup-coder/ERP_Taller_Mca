/* ─── Analytics (Sprint 10) ─────────────── */
function renderAnalytics(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">KPIs, productividad y reportes del taller</p>
      <div class="flex gap-2">
        <button id="ana-tab-prod" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white">Productividad</button>
        <button id="ana-tab-serv" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Top Servicios</button>
        <button id="ana-tab-cli" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Top Clientes</button>
        <button id="ana-tab-bsc" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Scorecard</button>
      </div>
    </div>
    <div id="ana-content" class="space-y-4">
      <div class="text-center py-12 text-gray-600">Cargando Analytics...</div>
    </div>`;
  const content = $('ana-content');
  loadTabProductividad(content);
  // Tab switching
  $('ana-tab-prod').addEventListener('click', () => {
    $$('[id^="ana-tab-"]').forEach(b => { b.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700'; });
    $('ana-tab-prod').className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white';
    loadTabProductividad(content);
  });
  $('ana-tab-serv').addEventListener('click', () => {
    $$('[id^="ana-tab-"]').forEach(b => { b.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700'; });
    $('ana-tab-serv').className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white';
    loadTabTopServicios(content);
  });
  $('ana-tab-cli').addEventListener('click', () => {
    $$('[id^="ana-tab-"]').forEach(b => { b.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700'; });
    $('ana-tab-cli').className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white';
    loadTabTopClientes(content);
  });
  $('ana-tab-bsc').addEventListener('click', () => {
    $$('[id^="ana-tab-"]').forEach(b => { b.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700'; });
    $('ana-tab-bsc').className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white';
    loadTabScorecard(content);
  });
}

async function loadTabProductividad(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando...</div>';
  const data = await api('/workshop/analytics/productividad').catch(() => null);
  if (!data) { container.innerHTML = '<div class="text-center py-8 text-red-400">Error al cargar datos</div>'; return; }
  const r = data.resumen;
  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">OTs Completadas</p>
        <p class="text-3xl font-bold mt-1 text-blue-400">${r.totalOTsCompletadas}</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Duración Promedio</p>
        <p class="text-3xl font-bold mt-1 text-yellow-400">${r.promedioDuracionDias}<span class="text-sm text-gray-500"> días</span></p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Ingresos del Período</p>
        <p class="text-2xl font-bold mt-1 text-green-400">₲ ${fmt(r.ingresosPeriodo)}</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Margen Bruto</p>
        <p class="text-2xl font-bold mt-1 text-cyan-400">₲ ${fmt(r.margenBruto)}</p>
        <p class="text-xs ${r.eficienciaPorcentaje >= 30 ? 'text-green-400' : 'text-yellow-400'}">${r.eficienciaPorcentaje}% eficiencia</p>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Progreso Mensual</h3>
        ${data.detalleMensual && data.detalleMensual.length
          ? `<div class="overflow-x-auto"><table class="w-full text-sm">
              <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <th class="text-left px-3 py-2">Mes</th>
                <th class="text-right px-3 py-2">OTs</th>
                <th class="text-right px-3 py-2">Ingresos</th>
                <th class="text-right px-3 py-2">Costo Rep.</th>
              </tr></thead>
              <tbody>${data.detalleMensual.map(m => `
                <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td class="px-3 py-2 font-medium">${m.mes}</td>
                  <td class="px-3 py-2 text-right">${m.otsCompletadas}</td>
                  <td class="px-3 py-2 text-right text-green-400">₲ ${fmt(m.ingresos)}</td>
                  <td class="px-3 py-2 text-right text-red-400">₲ ${fmt(m.costoRepuestos)}</td>
                </tr>`).join('')}</tbody></table></div>`
          : '<div class="text-center py-6 text-gray-600 text-sm">Sin datos mensuales</div>'}
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Resumen</h3>
        <div class="space-y-3">
          <div><p class="text-gray-500 text-xs">Eficiencia General</p>
            <div class="w-full bg-gray-800 rounded-full h-3 mt-1">
              <div class="bg-gradient-to-r ${r.eficienciaPorcentaje >= 30 ? 'from-green-500 to-green-400' : r.eficienciaPorcentaje >= 15 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400'} rounded-full h-3 progress-bar" style="width:${Math.min(r.eficienciaPorcentaje, 100)}%"></div>
            </div>
            <p class="text-xs text-right text-gray-500 mt-0.5">${r.eficienciaPorcentaje}%</p>
          </div>
          <div class="pt-2 border-t border-gray-800">
            <p class="text-gray-500 text-xs">Costo de Repuestos</p>
            <p class="text-lg font-bold text-red-400">₲ ${fmt(r.costoRepuestos)}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs">Margen Bruto</p>
            <p class="text-lg font-bold text-green-400">₲ ${fmt(r.margenBruto)}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs">Duración Promedio</p>
            <p class="text-lg font-bold text-yellow-400">${r.promedioDuracionDias} días</p>
          </div>
        </div>
      </div>
    </div>`;
}

async function loadTabTopServicios(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando...</div>';
  const servicios = await api('/workshop/analytics/top-servicios?limit=15').catch(() => null);
  if (!servicios || !servicios.length) {
    container.innerHTML = '<div class="text-center py-8 text-gray-600">Sin datos de servicios</div>';
    return;
  }
  const maxUsos = Math.max(...servicios.map(s => s.totalUsos), 1);
  container.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">#</th>
            <th class="text-left px-4 py-3">Servicio</th>
            <th class="text-left px-4 py-3">Categoría</th>
            <th class="text-right px-4 py-3">Usos</th>
            <th class="text-right px-4 py-3">Ingresos</th>
            <th class="text-left px-4 py-3">Popularidad</th>
          </tr></thead>
          <tbody>${servicios.map((s, i) => {
            const pct = (s.totalUsos / maxUsos) * 100;
            return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
              <td class="px-4 py-2.5 text-gray-500">${i + 1}</td>
              <td class="px-4 py-2.5 font-medium">${esc(s.nombre)}</td>
              <td class="px-4 py-2.5 text-gray-400">${esc(s.categoria || '—')}</td>
              <td class="px-4 py-2.5 text-right font-semibold">${s.totalUsos}</td>
              <td class="px-4 py-2.5 text-right text-green-400">₲ ${fmt(s.ingresosGenerados)}</td>
              <td class="px-4 py-2.5"><div class="w-24 bg-gray-800 rounded-full h-2"><div class="bg-blue-500 rounded-full h-2 transition-all" style="width:${pct}%"></div></div></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function loadTabTopClientes(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando...</div>';
  const clientes = await api('/workshop/analytics/top-clientes?limit=15').catch(() => null);
  if (!clientes || !clientes.length) {
    container.innerHTML = '<div class="text-center py-8 text-gray-600">Sin datos de clientes</div>';
    return;
  }
  const maxFact = Math.max(...clientes.map(c => c.totalFacturado), 1);
  container.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">#</th>
            <th class="text-left px-4 py-3">Cliente</th>
            <th class="text-left px-4 py-3">Teléfono</th>
            <th class="text-right px-4 py-3">Total Facturado</th>
            <th class="text-right px-4 py-3">OTs</th>
            <th class="text-right px-4 py-3">Última Visita</th>
            <th class="text-left px-4 py-3">Valor</th>
          </tr></thead>
          <tbody>${clientes.map((c, i) => {
            const pct = (c.totalFacturado / maxFact) * 100;
            return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
              <td class="px-4 py-2.5 text-gray-500">${i + 1}</td>
              <td class="px-4 py-2.5 font-medium">${esc(c.nombre)}</td>
              <td class="px-4 py-2.5 text-gray-400">${esc(c.telefono || '—')}</td>
              <td class="px-4 py-2.5 text-right text-green-400">₲ ${fmt(c.totalFacturado)}</td>
              <td class="px-4 py-2.5 text-right">${c.totalOTs}</td>
              <td class="px-4 py-2.5 text-right text-gray-400 text-xs">${c.ultimaVisita ? new Date(c.ultimaVisita).toLocaleDateString('es-PY') : '—'}</td>
              <td class="px-4 py-2.5"><div class="w-24 bg-gray-800 rounded-full h-2"><div class="bg-emerald-500 rounded-full h-2 transition-all" style="width:${pct}%"></div></div></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

/* ─── Balanced Scorecard (Sprint 11) ──── */
async function loadTabScorecard(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando Scorecard...</div>';
  const data = await api('/workshop/analytics/scorecard').catch(() => null);
  if (!data) { container.innerHTML = '<div class="text-center py-8 text-red-400">Error al cargar scorecard</div>'; return; }

  const scoreCard = (label, value, sub, color) => `
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
      <p class="text-gray-500 text-xs uppercase tracking-wider">${label}</p>
      <p class="text-2xl font-bold mt-1 ${color}">${value}</p>
      ${sub ? `<p class="text-xs text-gray-500 mt-1">${sub}</p>` : ''}
    </div>`;

  const section = (title, iconSvg, cards) => `
    <div class="mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${iconSvg}</svg> ${title}
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${cards}</div>
    </div>`;

  const f = data.financiera;
  const c = data.clientes;
  const p = data.procesosInternos;
  const a = data.aprendizaje;

  container.innerHTML = `
    ${section('Financiera', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>', [
      scoreCard('Ingresos del Mes', `₲ ${fmt(f.ingresosMes)}`, '', 'text-green-400'),
      scoreCard('Costos del Mes', `₲ ${fmt(f.costosMes)}`, '', 'text-red-400'),
      scoreCard('Margen Bruto', `${f.margenBruto}%`, f.margenBruto >= 30 ? 'Objetivo: ≥30%' : 'Por debajo del objetivo', f.margenBruto >= 30 ? 'text-emerald-400' : 'text-yellow-400'),
      scoreCard('Pendiente Cobro', `₲ ${fmt(f.pendienteCobro)}`, '', 'text-orange-400'),
    ])}
    ${section('Clientes', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>', [
      scoreCard('Total Clientes', c.totalClientes, '', 'text-blue-400'),
      scoreCard('Visitas del Mes', c.clientesMes, '', 'text-cyan-400'),
      scoreCard('Retención', `${c.retencionVisita}%`, 'Repiten en 90 días', c.retencionVisita >= 40 ? 'text-emerald-400' : 'text-yellow-400'),
      scoreCard('Ticket Promedio', `₲ ${fmt(c.ticketPromedio)}`, '', 'text-purple-400'),
    ])}
    ${section('Procesos Internos', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/>', [
      scoreCard('OTs Completadas', p.otsCompletadas, 'Este mes', 'text-blue-400'),
      scoreCard('Tasa Finalización', `${p.tasaFinalizacion}%`, 'Completadas / Creadas', p.tasaFinalizacion >= 80 ? 'text-emerald-400' : 'text-yellow-400'),
      scoreCard('Servicios Catálogo', p.serviciosCatalogo, 'Utilizados este mes', 'text-cyan-400'),
      scoreCard('Tiempo Promedio', `${p.tiempoPromedioDias || '—'}`, 'Días', 'text-gray-400'),
    ])}
    ${section('Aprendizaje y Crecimiento', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>', [
      scoreCard('Eficiencia Mecánicos', `${a.eficienciaMecanicos}%`, 'Margen bruto', 'text-emerald-400'),
      scoreCard('Diversidad Servicios', a.diversidadServicios, 'Categorías distintas', 'text-cyan-400'),
      scoreCard('Productividad', `${a.productividadPromedio}`, 'OTs / mecánico', 'text-blue-400'),
    ])}
  `;
}
