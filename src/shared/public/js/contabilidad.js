function renderContabilidad(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Módulo de contabilidad automática</p>
    </div>
    <div class="flex flex-wrap gap-1 mb-6 border-b border-gray-800">
      ${Object.entries(CONTABILIDAD_TABS).map(([key, label]) => `
        <button class="contab-tab px-4 py-2.5 text-sm font-medium rounded-t-lg transition
          ${key === 'cuentas' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}"
          data-contab-tab="${key}">${label}</button>
      `).join('')}
    </div>
    <div id="contab-content" class="space-y-4"></div>`;
  showContabTab('cuentas');
}

function showContabTab(tab) {
  document.querySelectorAll('.contab-tab').forEach(btn => {
    const isActive = btn.dataset.contabTab === tab;
    btn.className = `contab-tab px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
      isActive
        ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
    }`;
  });
  const content = document.querySelector('#contab-content');
  if (!content) return;
  content.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  if (tab === 'cuentas') renderContabCuentas(content);
  else if (tab === 'asientos') renderContabAsientos(content);
  else if (tab === 'balance') renderContabBalance(content);
  else if (tab === 'resultados') renderContabResultados(content);
  else if (tab === 'libros') renderContabLibros(content);
  else if (tab === 'impuestos') renderContabImpuestos(content);
}

// ─── Plan de Cuentas ──────────────────────

async function renderContabCuentas(container) {
  try {
    const arbol = await api('/finance/contabilidad/cuentas/arbol');
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">Plan de Cuentas — Árbol Jerárquico</p>
        <button id="btn-nueva-cuenta" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Cuenta</button>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Código</th>
              <th class="text-left px-4 py-3">Nombre</th>
              <th class="text-left px-4 py-3">Tipo</th>
              <th class="text-right px-4 py-3">Saldo Inicial</th>
              <th class="text-right px-4 py-3">Acción</th>
            </tr></thead>
            <tbody>${renderArbolRows(arbol)}</tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderArbolRows(cuentas, depth = 0) {
  if (!cuentas || !cuentas.length) return '';
  return cuentas.map(c => {
    const indent = depth * 20;
    const tipoColors = {
      ACTIVO: 'bg-blue-900/50 text-blue-300',
      PASIVO: 'bg-yellow-900/50 text-yellow-300',
      PATRIMONIO: 'bg-purple-900/50 text-purple-300',
      INGRESO: 'bg-green-900/50 text-green-300',
      COSTO: 'bg-red-900/50 text-red-300',
      GASTO: 'bg-orange-900/50 text-orange-300',
      ORDEN: 'bg-gray-700 text-gray-300',
    };
    const badgeClass = tipoColors[c.tipo] || 'bg-gray-700 text-gray-300';
    const movIndicator = c.aceptaMovimientos ? '<span class="text-green-500 text-xs ml-1" title="Acepta movimientos">✓</span>' : '';
    const childrenHtml = c.children ? renderArbolRows(c.children, depth + 1) : '';
    const accionBtn = c.activo !== false && c.aceptaMovimientos
      ? `<button class="btn-desactivar-cuenta text-red-500 hover:text-red-400 text-xs" data-cuenta-id="${c.id}" title="Desactivar cuenta">✕</button>`
      : c.activo === false ? '<span class="text-gray-600 text-xs">Inactiva</span>' : '';
    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-2.5 font-mono text-xs text-gray-400" style="padding-left: ${16 + indent}px">${esc(c.codigo)}</td>
        <td class="px-4 py-2.5 font-medium">${esc(c.nombre)}${movIndicator}</td>
        <td class="px-4 py-2.5"><span class="status-badge ${badgeClass}">${c.tipo}</span></td>
        <td class="px-4 py-2.5 text-right text-gray-400">${c.saldoInicial && Number(c.saldoInicial) !== 0 ? '₲ ' + Number(c.saldoInicial).toLocaleString('es-PY') : '—'}</td>
        <td class="px-4 py-2.5 text-right">${accionBtn}</td>
      </tr>${childrenHtml}`;
  }).join('');
}

// ─── Asientos ──────────────────────────────

let asientosPage = 1;
let asientosFilter = {};

async function renderContabAsientos(container) {
  try {
    const params = new URLSearchParams({ page: String(asientosPage), limit: '20', ...Object.fromEntries(Object.entries(asientosFilter).filter(([_, v]) => v)) });
    const result = await api(`/finance/contabilidad/asientos?${params}`);
    const { data, total, totalPages } = result;
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">${total || 0} asiento(s) encontrado(s)</p>
        <button id="btn-nuevo-asiento" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Asiento</button>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <input id="filtro-asientos-desde" type="date" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <input id="filtro-asientos-hasta" type="date" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <select id="filtro-asientos-modulo" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">Todos los módulos</option>
            <option value="SIFEN">SIFEN</option>
            <option value="INVENTARIO">Inventario</option>
            <option value="NOMINA">Nómina</option>
            <option value="CONTABILIDAD">Contabilidad</option>
            <option value="SISTEMA">Sistema</option>
          </select>
          <button id="btn-filtrar-asientos" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Filtrar</button>
          <button id="btn-limpiar-filtros" class="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition">Limpiar</button>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">#</th>
              <th class="text-left px-4 py-3">Fecha</th>
              <th class="text-left px-4 py-3">Concepto</th>
              <th class="text-right px-4 py-3">Debe</th>
              <th class="text-right px-4 py-3">Haber</th>
              <th class="text-left px-4 py-3">Estado</th>
              <th class="text-left px-4 py-3">Módulo</th>
              <th class="text-right px-4 py-3">Acción</th>
            </tr></thead>
            <tbody>${renderAsientosRows(data)}</tbody>
          </table>
        </div>
      </div>
      ${renderPagination(totalPages, asientosPage, 'asientos')}`;
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderAsientosRows(data) {
  if (!data || !data.length) {
    return '<tr><td colspan="8" class="text-center py-8 text-gray-600">Sin asientos registrados</td></tr>';
  }
  return data.map(a => {
    const estadoColor = a.estado === 'CONTABILIZADO' ? 'text-green-400' : a.estado === 'ANULADO' ? 'text-red-400' : 'text-yellow-400';
    return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
      <td class="px-4 py-3 font-mono text-xs text-gray-400">${a.numero}</td>
      <td class="px-4 py-3 text-xs">${new Date(a.fecha).toLocaleDateString('es-PY')}</td>
      <td class="px-4 py-3 font-medium max-w-[200px] truncate" title="${esc(a.concepto)}">${esc(a.concepto)}</td>
      <td class="px-4 py-3 text-right font-mono text-xs">₲ ${Number(a.totalDebe).toLocaleString('es-PY')}</td>
      <td class="px-4 py-3 text-right font-mono text-xs">₲ ${Number(a.totalHaber).toLocaleString('es-PY')}</td>
      <td class="px-4 py-3"><span class="text-xs font-medium ${estadoColor}">${a.estado}</span></td>
      <td class="px-4 py-3 text-xs text-gray-400">${a.moduloOrigen || '—'}</td>
      <td class="px-4 py-3 text-right">
        <button class="view-asiento-btn text-blue-400 hover:text-blue-300 text-xs" data-id="${a.id}">Ver</button>
        ${a.estado !== 'ANULADO' ? `<button class="anular-asiento-btn text-red-400 hover:text-red-300 text-xs ml-2" data-id="${a.id}">Anular</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderPagination(totalPages, currentPage, prefix) {
  if (!totalPages || totalPages <= 1) return '';
  let pages = '';
  for (let i = 1; i <= totalPages; i++) {
    pages += `<button class="page-btn px-3 py-1 rounded text-xs font-medium transition ${
      i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }" data-page="${i}" data-prefix="${prefix}">${i}</button>`;
  }
  return `<div class="flex items-center justify-center gap-2 mt-4">${pages}</div>`;
}

async function showAsientoModal(asientoId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando detalle...</div>';
  dom.modalOverlay.classList.remove('hidden');
  try {
    const asiento = await api(`/finance/contabilidad/asientos/${asientoId}`);
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Asiento #${asiento.numero}</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <div class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Fecha</p>
            <p class="font-medium mt-1">${new Date(asiento.fecha).toLocaleDateString('es-PY')}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Estado</p>
            <p class="font-medium mt-1">${asiento.estado}</p>
          </div>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Concepto</p>
          <p class="mt-1">${esc(asiento.concepto)}</p>
        </div>
        ${asiento.moduloOrigen ? `<div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Módulo Origen</p>
          <p class="mt-1">${esc(asiento.moduloOrigen)}</p>
        </div>` : ''}
        ${asiento.documentoRef ? `<div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Documento Ref.</p>
          <p class="mt-1 font-mono text-xs">${esc(asiento.documentoRef)}</p>
        </div>` : ''}
        <div class="bg-gray-800/50 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-700 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-3 py-2">Cuenta</th>
              <th class="text-right px-3 py-2">Debe</th>
              <th class="text-right px-3 py-2">Haber</th>
            </tr></thead>
            <tbody>${(asiento.lineas || []).map(l => `
              <tr class="border-b border-gray-800/50">
                <td class="px-3 py-2">
                  <span class="font-mono text-xs text-gray-400">${esc(l.cuentaCodigo)}</span>
                  <span class="ml-1">${esc(l.cuentaNombre)}</span>
                  ${l.descripcion ? `<p class="text-xs text-gray-500">${esc(l.descripcion)}</p>` : ''}
                </td>
                <td class="px-3 py-2 text-right font-mono text-xs ${l.debe ? 'text-green-400' : ''}">${l.debe ? '₲ ' + Number(l.debe).toLocaleString('es-PY') : ''}</td>
                <td class="px-3 py-2 text-right font-mono text-xs ${l.haber ? 'text-red-400' : ''}">${l.haber ? '₲ ' + Number(l.haber).toLocaleString('es-PY') : ''}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr class="border-t border-gray-700 font-semibold">
              <td class="px-3 py-2 text-gray-400">Totales</td>
              <td class="px-3 py-2 text-right text-green-400">₲ ${Number(asiento.totalDebe).toLocaleString('es-PY')}</td>
              <td class="px-3 py-2 text-right text-red-400">₲ ${Number(asiento.totalHaber).toLocaleString('es-PY')}</td>
            </tr></tfoot>
          </table>
        </div>
        <button id="modal-close-bottom" class="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm mt-2 transition">Cerrar</button>
      </div>`;
  } catch (e) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

// ─── Balance General ──────────────────────

async function renderContabBalance(container) {
  const today = new Date().toISOString().slice(0, 10);
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <p class="text-sm text-gray-400">Balance General al:</p>
      <input id="balance-fecha" type="date" value="${today}" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <button id="btn-cargar-balance" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Cargar</button>
    </div>
    <div id="balance-result" class="text-center py-8 text-gray-500">Selecciona una fecha y haz clic en "Cargar"</div>`;
}

async function cargarBalance(fecha) {
  const resultDiv = document.querySelector('#balance-result');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  try {
    const b = await api(`/finance/contabilidad/balance-general/${fecha}`);
    const fmt = (n) => '₲ ' + (n || 0).toLocaleString('es-PY', { minimumFractionDigits: 0 });
    const sectionHtml = (seccion, title, color) => {
      const grupos = (seccion.grupos || []).map(g => `
        <div class="ml-4">
          <p class="text-xs text-gray-500 font-medium uppercase tracking-wider mt-2">${esc(g.nombre)}</p>
          ${(g.subcuentas || []).map(sc => `
            <div class="flex justify-between items-center py-1 text-sm hover:bg-gray-800/30 px-2 rounded">
              <span><span class="font-mono text-xs text-gray-500">${esc(sc.codigo)}</span> ${esc(sc.nombre)}</span>
              <span class="font-mono text-xs ${sc.saldoActual > 0 ? 'text-green-400' : 'text-gray-400'}">${fmt(sc.saldoActual)}</span>
            </div>`).join('')}
        </div>`).join('');
      const directas = (seccion.cuentasDirectas || []).map(c => `
        <div class="flex justify-between items-center py-1 text-sm hover:bg-gray-800/30 px-2 rounded">
          <span><span class="font-mono text-xs text-gray-500">${esc(c.codigo)}</span> ${esc(c.nombre)}</span>
          <span class="font-mono text-xs ${c.saldoActual > 0 ? 'text-green-400' : 'text-gray-400'}">${fmt(c.saldoActual)}</span>
        </div>`).join('');
      return `<div class="bg-gray-800/40 rounded-lg p-4">
        <div class="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
          <h4 class="text-sm font-bold ${color}">${title}</h4>
          <span class="text-sm font-bold ${color}">${fmt(seccion.total)}</span>
        </div>
        ${grupos}
        ${directas}
      </div>`;
    };
    resultDiv.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Fecha: ${new Date(b.fecha).toLocaleDateString('es-PY')}</span>
          <span class="${b.balanceado ? 'text-green-400' : 'text-red-400'} font-medium">
            ${b.balanceado ? '✓ Balanceado' : '✗ Desbalanceado (dif: ' + fmt(b.diferencia) + ')'}
          </span>
        </div>
        ${sectionHtml(b.activo, 'ACTIVO', 'text-blue-400')}
        ${sectionHtml(b.pasivo, 'PASIVO', 'text-yellow-400')}
        ${sectionHtml(b.patrimonio, 'PATRIMONIO', 'text-purple-400')}
        <div class="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
          <div class="bg-blue-900/20 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">Total Activo</p>
            <p class="text-lg font-bold text-blue-400">${fmt(b.totalActivo)}</p>
          </div>
          <div class="bg-yellow-900/20 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">Total Pasivo + Patrimonio</p>
            <p class="text-lg font-bold text-yellow-400">${fmt(b.totalPasivoPatrimonio)}</p>
          </div>
          <div class="bg-purple-900/20 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">Diferencia</p>
            <p class="text-lg font-bold ${b.balanceado ? 'text-green-400' : 'text-red-400'}">${fmt(b.diferencia)}</p>
          </div>
        </div>
      </div>`;
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

// ─── Estado de Resultados ─────────────────

async function renderContabResultados(container) {
  const now = new Date();
  const anho = now.getFullYear();
  const mes = now.getMonth() + 1;
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <p class="text-sm text-gray-400">Período:</p>
      <select id="pnl-mes" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) =>
          `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${m}</option>`
        ).join('')}
      </select>
      <select id="pnl-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024, 2025, 2026, 2027].map(a => `<option value="${a}" ${a === anho ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <label class="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" id="pnl-acumulado" class="accent-blue-500"> Acumulado anual
      </label>
      <button id="btn-cargar-pnl" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Cargar</button>
    </div>
    <div id="pnl-result" class="text-center py-8 text-gray-500">Selecciona un período y haz clic en "Cargar"</div>`;
}

async function cargarPnL(anho, mes, acumulado) {
  const resultDiv = document.querySelector('#pnl-result');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  try {
    const p = await api(`/finance/contabilidad/estado-resultados/${anho}/${mes}${acumulado ? '?acumulado=true' : ''}`);
    const fmt = (n) => '₲ ' + (n || 0).toLocaleString('es-PY', { minimumFractionDigits: 0 });
    const sectionHtml = (seccion, title) => `
      <div class="bg-gray-800/40 rounded-lg p-4">
        <div class="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
          <h4 class="text-sm font-bold">${title}</h4>
          <span class="text-sm font-bold">${fmt(seccion.total)}</span>
        </div>
        ${(seccion.cuentas || []).filter(c => c.saldo !== 0).map(c => `
          <div class="flex justify-between items-center py-1 text-sm hover:bg-gray-800/30 px-2 rounded">
            <span><span class="font-mono text-xs text-gray-500">${esc(c.codigo)}</span> ${esc(c.nombre)}</span>
            <span class="font-mono text-xs ${c.saldo > 0 ? 'text-green-400' : 'text-red-400'}">${fmt(c.saldo)}</span>
          </div>`).join('')}
      </div>`;
    resultDiv.innerHTML = `
      <div class="space-y-4">
        <p class="text-xs text-gray-500">${p.tipo} — ${mes}/${anho}</p>
        ${sectionHtml(p.ingresos, 'INGRESOS')}
        ${sectionHtml(p.costos, 'COSTOS')}
        <div class="bg-gray-800/60 rounded-lg p-4 border border-blue-900/50">
          <div class="flex justify-between items-center">
            <h4 class="text-sm font-bold text-blue-400">UTILIDAD BRUTA</h4>
            <span class="text-lg font-bold text-blue-400">${fmt(p.utilidadBruta)}</span>
          </div>
        </div>
        ${sectionHtml(p.gastos, 'GASTOS')}
        <div class="bg-gray-800/60 rounded-lg p-4 border border-green-900/50">
          <div class="flex justify-between items-center">
            <h4 class="text-sm font-bold ${p.utilidadNeta >= 0 ? 'text-green-400' : 'text-red-400'}">UTILIDAD NETA</h4>
            <span class="text-lg font-bold ${p.utilidadNeta >= 0 ? 'text-green-400' : 'text-red-400'}">${fmt(p.utilidadNeta)}</span>
          </div>
        </div>
      </div>`;
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

// ─── Libros Contables ─────────────────────

const LIBROS_TABS = { diario: 'Libro Diario', mayor: 'Libro Mayor', inventario: 'Libro Inventario' };
let librosTabActivo = 'diario';
let librosAnho = new Date().getFullYear();
let librosMes = new Date().getMonth() + 1;

async function renderContabLibros(container) {
  container.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-4">
      ${Object.entries(LIBROS_TABS).map(([k, v]) => `
        <button class="libros-tab px-4 py-2 text-sm font-medium rounded-lg transition
          ${k === librosTabActivo ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
          data-libros-tab="${k}">${v}</button>
      `).join('')}
    </div>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="libros-mes" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) =>
          `<option value="${i + 1}" ${i + 1 === librosMes ? 'selected' : ''}>${m}</option>`
        ).join('')}
      </select>
      <select id="libros-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024, 2025, 2026, 2027].map(a => `<option value="${a}" ${a === librosAnho ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <select id="libros-cuenta" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white hidden" aria-label="Filtrar por cuenta">
        <option value="">Todas las cuentas</option>
      </select>
      <button id="btn-cargar-libro" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Cargar</button>
    </div>
    <div id="libros-result" class="text-center py-8 text-gray-500">Selecciona período y haz clic en "Cargar"</div>`;
}

async function cargarLibro(anho, mes, cuentaCodigo) {
  const resultDiv = document.querySelector('#libros-result');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  try {
    if (librosTabActivo === 'diario') {
      const data = await api(`/finance/contabilidad/libro-diario/${anho}/${mes}?formato=JSON`);
      resultDiv.innerHTML = renderLibroDiario(data);
    } else if (librosTabActivo === 'mayor') {
      const params = cuentaCodigo ? `?codigoDesde=${cuentaCodigo}&codigoHasta=${cuentaCodigo}` : '';
      const data = await api(`/finance/contabilidad/libro-mayor/${anho}/${mes}${params}`);
      resultDiv.innerHTML = renderLibroMayor(data);
    } else if (librosTabActivo === 'inventario') {
      const data = await api(`/finance/contabilidad/libro-inventario/${anho}/${mes}`);
      resultDiv.innerHTML = renderLibroInventario(data);
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderLibroDiario(data) {
  const asientos = data?.data || data?.asientos || data || [];
  if (!Array.isArray(asientos) || !asientos.length) return '<div class="text-center py-8 text-gray-500">No hay asientos en este período</div>';
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th class="text-left px-3 py-2">Fecha</th>
          <th class="text-left px-3 py-2">#</th>
          <th class="text-left px-3 py-2">Concepto</th>
          <th class="text-left px-3 py-2">Cuenta</th>
          <th class="text-right px-3 py-2">Debe</th>
          <th class="text-right px-3 py-2">Haber</th>
        </tr></thead>
        <tbody>${asientos.flatMap(a => {
          const lineas = a.lineas || a.detalles || [];
          if (!lineas.length) return `<tr class="border-b border-gray-800/50">
            <td class="px-3 py-2 text-xs">${new Date(a.fecha).toLocaleDateString('es-PY')}</td>
            <td class="px-3 py-2 font-mono text-xs text-gray-400">${a.numero}</td>
            <td class="px-3 py-2 text-xs" colspan="4">${esc(a.concepto)}</td>
          </tr>`;
          return lineas.map((l, i) => `<tr class="border-b border-gray-800/50">
            ${i === 0 ? `<td class="px-3 py-2 text-xs" rowspan="${lineas.length}">${new Date(a.fecha).toLocaleDateString('es-PY')}</td>
            <td class="px-3 py-2 font-mono text-xs text-gray-400" rowspan="${lineas.length}">${a.numero}</td>
            <td class="px-3 py-2 text-xs" rowspan="${lineas.length}">${esc(a.concepto)}</td>` : ''}
            <td class="px-3 py-2 text-xs"><span class="font-mono text-gray-500">${esc(l.cuentaCodigo || '')}</span> ${esc(l.cuentaNombre || '')}</td>
            <td class="px-3 py-2 text-right font-mono text-xs text-green-400">${l.debe ? '₲ ' + Number(l.debe).toLocaleString('es-PY') : ''}</td>
            <td class="px-3 py-2 text-right font-mono text-xs text-red-400">${l.haber ? '₲ ' + Number(l.haber).toLocaleString('es-PY') : ''}</td>
          </tr>`);
        }).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function renderLibroMayor(data) {
  const cuentas = data?.data || data?.cuentas || data || [];
  if (!Array.isArray(cuentas) || !cuentas.length) return '<div class="text-center py-8 text-gray-500">No hay movimientos en este período</div>';
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th class="text-left px-3 py-2">Cuenta</th>
          <th class="text-right px-3 py-2">Saldo Inicial</th>
          <th class="text-right px-3 py-2">Debe</th>
          <th class="text-right px-3 py-2">Haber</th>
          <th class="text-right px-3 py-2">Saldo Final</th>
        </tr></thead>
        <tbody>${cuentas.map(c => `
          <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
            <td class="px-3 py-2"><span class="font-mono text-xs text-gray-500">${esc(c.codigo || c.cuentaCodigo || '')}</span> ${esc(c.nombre || c.cuentaNombre || '')}</td>
            <td class="px-3 py-2 text-right font-mono text-xs">${c.saldoInicial ? '₲ ' + Number(c.saldoInicial).toLocaleString('es-PY') : '—'}</td>
            <td class="px-3 py-2 text-right font-mono text-xs text-green-400">${c.totalDebe || c.debe ? '₲ ' + Number(c.totalDebe || c.debe || 0).toLocaleString('es-PY') : '—'}</td>
            <td class="px-3 py-2 text-right font-mono text-xs text-red-400">${c.totalHaber || c.haber ? '₲ ' + Number(c.totalHaber || c.haber || 0).toLocaleString('es-PY') : '—'}</td>
            <td class="px-3 py-2 text-right font-mono text-xs font-bold">₲ ${Number(c.saldoFinal || c.saldo || 0).toLocaleString('es-PY')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderLibroInventario(data) {
  const items = data?.data || data?.items || data || [];
  if (!Array.isArray(items) || !items.length) return '<div class="text-center py-8 text-gray-500">No hay datos en este período</div>';
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th class="text-left px-3 py-2">Código</th>
          <th class="text-left px-3 py-2">Producto</th>
          <th class="text-right px-3 py-2">Stock</th>
          <th class="text-right px-3 py-2">Costo Unit.</th>
          <th class="text-right px-3 py-2">Valor Total</th>
        </tr></thead>
        <tbody>${items.map(i => `
          <tr class="border-b border-gray-800/50">
            <td class="px-3 py-2 font-mono text-xs text-gray-400">${esc(i.codigo || i.sku || '')}</td>
            <td class="px-3 py-2">${esc(i.nombre || i.producto || i.name || '')}</td>
            <td class="px-3 py-2 text-right">${i.stockActual || i.stock || i.cantidad || 0}</td>
            <td class="px-3 py-2 text-right font-mono text-xs">${i.costoUnitario || i.costo || i.unitPrice ? '₲ ' + Number(i.costoUnitario || i.costo || i.unitPrice || 0).toLocaleString('es-PY') : '—'}</td>
            <td class="px-3 py-2 text-right font-mono text-xs font-bold">${i.valorTotal || i.total ? '₲ ' + Number(i.valorTotal || i.total || 0).toLocaleString('es-PY') : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ─── Impuestos (5.7) ─────────────────────── */

const IMPUESTOS_TABS = { form120: 'IVA (Form 120)', ire: 'IRE', idu: 'IDU', isc: 'ISC', inr: 'INR' };
let impTabActivo = 'form120';

async function renderContabImpuestos(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Liquidación de Impuestos — DNIT</p>
    </div>
    <div class="flex flex-wrap gap-1 mb-4 border-b border-gray-800">
      ${Object.entries(IMPUESTOS_TABS).map(([k, v]) => `
        <button class="impuesto-tab px-4 py-2 text-sm font-medium rounded-t-lg transition
          ${k === impTabActivo ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}"
          data-imp-tab="${k}">${v}</button>
      `).join('')}
    </div>
    <div id="impuestos-content" class="space-y-4">
      ${impTabActivo === 'form120' ? renderImpForm120() : ''}
    </div>`;
  loadImpTab(impTabActivo);
}

function loadImpTab(tab) {
  if (tab === 'form120') cargarForm120();
  else if (tab === 'ire') cargarIre();
  else if (tab === 'idu') cargarIdu();
  else if (tab === 'isc') cargarIsc();
  else if (tab === 'inr') cargarInr();
}

function renderImpFormResult(result, title, fields) {
  if (!result) return '<div class="text-center py-8 text-gray-500">Haz clic en "Calcular"</div>';
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <h4 class="font-bold text-sm mb-3">${esc(title)}</h4>
    <div class="grid grid-cols-2 gap-2 text-sm">${fields.map(f => `
      <div class="bg-gray-800/50 rounded-lg p-2">
        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(f.label)}</p>
        <p class="font-bold text-${f.color || 'white'}-400 mt-1">${f.prefix || '₲ '}${f.value.toLocaleString?.('es-PY') ?? f.value}</p>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderHistorial(items, columns) {
  if (!items || !items.length) return '<div class="text-center py-6 text-gray-500 text-sm">Sin liquidaciones previas</div>';
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden mt-3">
    <p class="text-xs text-gray-500 uppercase tracking-wider px-3 pt-3 pb-1">Historial</p>
    <div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
        ${columns.map(c => `<th class="text-${c.align || 'left'} px-3 py-2">${c.label}</th>`).join('')}
      </tr></thead>
      <tbody>${items.map(r => `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
        ${columns.map(c => `<td class="px-3 py-2 text-${c.align || 'left'} font-${c.font || 'normal'} text-xs">${c.render ? c.render(r) : r[c.field]}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderImpForm120() {
  const now = new Date();
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="imp-iva-mes" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) =>
          `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="imp-iva-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024,2025,2026,2027].map(a => `<option value="${a}" ${a === now.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <button id="btn-calcular-form120" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular IVA</button>
    </div>
    <div id="imp-iva-result"></div>
    <div id="imp-iva-historial"></div>
  </div>`;
}

async function cargarForm120() {
  const resultDiv = document.querySelector('#imp-iva-result');
  const histDiv = document.querySelector('#imp-iva-historial');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<div class="text-center py-8 text-gray-500">Selecciona período y haz clic en "Calcular IVA"</div>';
  try {
    const historial = await api('/finance/fiscal/form120');
    if (histDiv) histDiv.innerHTML = renderHistorial(
      Array.isArray(historial) ? historial : historial?.data || [],
      [
        { label: 'Período', field: 'periodo', render: r => `${r.mes || ''}/${r.anho || ''}` },
        { label: 'Débito', align: 'right', render: r => `₲ ${Number(r.debitoFiscal || r.ivaDebito || 0).toLocaleString('es-PY')}` },
        { label: 'Crédito', align: 'right', render: r => `₲ ${Number(r.creditoFiscal || r.ivaCredito || 0).toLocaleString('es-PY')}` },
        { label: 'Resultado', align: 'right', render: r => `₲ ${Number(r.saldoPagar || r.resultado || 0).toLocaleString('es-PY')}` },
        { label: 'Estado', field: 'estado' },
      ]
    );
  } catch { /* historial puede fallar si no hay datos */ }
}

async function calcularForm120() {
  const mes = parseInt(document.querySelector('#imp-iva-mes')?.value, 10);
  const anho = parseInt(document.querySelector('#imp-iva-anho')?.value, 10);
  const resultDiv = document.querySelector('#imp-iva-result');
  if (!resultDiv || !mes || !anho) return;
  resultDiv.innerHTML = '<div class="text-center py-6 text-gray-500">Calculando...</div>';
  try {
    const data = await api('/finance/fiscal/form120/calcular', { method: 'POST', body: { mes, anho } });
    const ivaDebito = Number(data?.ivaDebito || data?.debitoFiscal || 0);
    const ivaCredito = Number(data?.ivaCredito || data?.creditoFiscal || 0);
    const saldo = Number(data?.saldoPagar || data?.resultado || 0);
    resultDiv.innerHTML = renderImpFormResult(data, `IVA Form 120 — ${mes}/${anho}`, [
      { label: 'IVA Débito Fiscal', value: ivaDebito, color: 'red' },
      { label: 'IVA Crédito Fiscal', value: ivaCredito, color: 'green' },
      { label: 'Saldo a Pagar', value: saldo, color: saldo > 0 ? 'red' : 'green' },
    ]) + (data?.asientoId ? `<p class="text-xs text-green-400 mt-2">Asiento #${data.asientoNumero || ''} generado automáticamente</p>` : '');
    // Refresh historial
    cargarForm120();
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderIreForm() {
  const now = new Date();
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="imp-ire-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024,2025,2026,2027].map(a => `<option value="${a}" ${a === now.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <select id="imp-ire-formulario" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        <option value="FORM_500_IRE">IRE General (Form 500)</option>
        <option value="FORM_501_IRE_SIMPLE">IRE Simple (Form 501)</option>
        <option value="FORM_502_IRE_RESIMPLE">IRE Resimple (Form 502)</option>
      </select>
      <button id="btn-calcular-ire" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular IRE</button>
    </div>
    <div id="imp-ire-result"></div>
    <div id="imp-ire-historial"></div>
  </div>`;
}

async function cargarIre() {
  const container = document.querySelector('#impuestos-content');
  if (!container) return;
  container.innerHTML = renderIreForm();
  try {
    const historial = await api('/finance/fiscal/ire');
    const histDiv = document.querySelector('#imp-ire-historial');
    if (histDiv) histDiv.innerHTML = renderHistorial(
      Array.isArray(historial) ? historial : historial?.data || [],
      [
        { label: 'Ejercicio', field: 'anho', render: r => r.periodoFiscalId?.slice(0, 4) || r.anho || '' },
        { label: 'Ingresos Brutos', align: 'right', render: r => `₲ ${Number(r.ingresosBrutos || 0).toLocaleString('es-PY')}` },
        { label: 'Impuesto IRE', align: 'right', render: r => `₲ ${Number(r.impuestoIre || 0).toLocaleString('es-PY')}` },
        { label: 'Saldo a Pagar', align: 'right', font: 'bold', render: r => `₲ ${Number(r.saldoPagar || r.impuestoIre || 0).toLocaleString('es-PY')}` },
      ]
    );
  } catch { /* empty */ }
}

async function calcularIre() {
  const anho = parseInt(document.querySelector('#imp-ire-anho')?.value, 10);
  const formulario = document.querySelector('#imp-ire-formulario')?.value;
  const resultDiv = document.querySelector('#imp-ire-result');
  if (!resultDiv || !anho || !formulario) return;
  resultDiv.innerHTML = '<div class="text-center py-6 text-gray-500">Calculando...</div>';
  try {
    const data = await api('/finance/fiscal/ire/calcular', { method: 'POST', body: { anho, formulario } });
    resultDiv.innerHTML = renderImpFormResult(data, `IRE ${formulario.replace(/_/g, ' ')} — ${anho}`, [
      { label: 'Ingresos Brutos', value: Number(data?.ingresosBrutos || 0), color: 'green' },
      { label: 'Renta Neta', value: Number(data?.rentaNeta || 0) },
      { label: 'Impuesto IRE', value: Number(data?.impuestoIre || 0), color: 'red' },
      { label: 'Saldo a Pagar', value: Number(data?.saldoPagar || 0), color: data?.saldoPagar > 0 ? 'red' : 'green' },
    ]) + (data?.asientoId ? `<p class="text-xs text-green-400 mt-2">Asiento contable generado</p>` : '');
    cargarIre(); // refresh historial
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderIduForm() {
  const now = new Date();
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="imp-idu-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024,2025,2026,2027].map(a => `<option value="${a}" ${a === now.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <select id="imp-idu-beneficiario" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        <option value="RESIDENTE">Residente (8%)</option>
        <option value="NO_RESIDENTE">No Residente (15%)</option>
      </select>
      <input id="imp-idu-porcentaje" type="number" min="0.01" max="1" step="0.01" value="1"
        class="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" title="% Utilidades distribuidas">
      <button id="btn-calcular-idu" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular IDU</button>
    </div>
    <div id="imp-idu-result"></div>
    <div id="imp-idu-historial"></div>
  </div>`;
}

async function cargarIdu() {
  const container = document.querySelector('#impuestos-content');
  if (!container) return;
  container.innerHTML = renderIduForm();
  try {
    const historial = await api('/finance/fiscal/idu');
    const histDiv = document.querySelector('#imp-idu-historial');
    if (histDiv) histDiv.innerHTML = renderHistorial(
      Array.isArray(historial) ? historial : historial?.data || [],
      [
        { label: 'Ejercicio', render: r => r.anho || r.createdAt?.slice(0, 4) || '' },
        { label: 'Impuesto IDU', align: 'right', render: r => `₲ ${Number(r.impuestoIdu || 0).toLocaleString('es-PY')}` },
        { label: 'Estado', field: 'estado' },
      ]
    );
  } catch { /* empty */ }
}

async function calcularIdu() {
  const anho = parseInt(document.querySelector('#imp-idu-anho')?.value, 10);
  const tipoBeneficiario = document.querySelector('#imp-idu-beneficiario')?.value;
  const porcentajeDistribuido = parseFloat(document.querySelector('#imp-idu-porcentaje')?.value) || 1;
  const resultDiv = document.querySelector('#imp-idu-result');
  if (!resultDiv || !anho) return;
  resultDiv.innerHTML = '<div class="text-center py-6 text-gray-500">Calculando...</div>';
  try {
    const data = await api('/finance/fiscal/idu/calcular', { method: 'POST', body: { anho, tipoBeneficiario, porcentajeDistribuido } });
    resultDiv.innerHTML = renderImpFormResult(data, `IDU — ${anho}`, [
      { label: 'Utilidad Distribuible', value: Number(data?.utilidadDistribuible || data?.rentaNeta || 0) },
      { label: 'Tasa', value: (tipoBeneficiario === 'NO_RESIDENTE' ? '15%' : '8%'), color: 'blue', prefix: '' },
      { label: 'Impuesto IDU', value: Number(data?.impuestoIdu || 0), color: 'red' },
      { label: 'Saldo a Pagar', value: Number(data?.saldoPagar || 0), color: data?.saldoPagar > 0 ? 'red' : 'green' },
    ]);
    cargarIdu();
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderIscForm() {
  const now = new Date();
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="imp-isc-mes" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) =>
          `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="imp-isc-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024,2025,2026,2027].map(a => `<option value="${a}" ${a === now.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <select id="imp-isc-rubro" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        <option value="COMBUSTIBLE">Combustible</option>
        <option value="TABACO">Tabaco</option>
        <option value="BEBIDAS_ALCOHOLICAS">Bebidas Alcohólicas</option>
        <option value="BIENES_SUNTUARIOS">Bienes Suntuarios</option>
        <option value="OTROS">Otros</option>
      </select>
      <input id="imp-isc-base" type="number" min="0" step="1000" placeholder="Base Imponible"
        class="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <input id="imp-isc-tasa" type="number" min="0" max="1" step="0.01" placeholder="Tasa (ej: 0.10)"
        class="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <button id="btn-calcular-isc" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular ISC</button>
    </div>
    <div id="imp-isc-result"></div>
    <div id="imp-isc-historial"></div>
  </div>`;
}

async function cargarIsc() {
  const container = document.querySelector('#impuestos-content');
  if (!container) return;
  container.innerHTML = renderIscForm();
  try {
    const historial = await api('/finance/fiscal/isc');
    const histDiv = document.querySelector('#imp-isc-historial');
    if (histDiv) histDiv.innerHTML = renderHistorial(
      Array.isArray(historial) ? historial : historial?.data || [],
      [
        { label: 'Período', render: r => `${r.mes || ''}/${r.anho || ''}` },
        { label: 'Rubro', render: r => r.rubro || '' },
        { label: 'Base Imponible', align: 'right', render: r => `₲ ${Number(r.baseImponible || 0).toLocaleString('es-PY')}` },
        { label: 'Impuesto', align: 'right', font: 'bold', render: r => `₲ ${Number(r.impuestoIsc || 0).toLocaleString('es-PY')}` },
      ]
    );
  } catch { /* empty */ }
}

async function calcularIsc() {
  const anho = parseInt(document.querySelector('#imp-isc-anho')?.value, 10);
  const mes = parseInt(document.querySelector('#imp-isc-mes')?.value, 10);
  const rubro = document.querySelector('#imp-isc-rubro')?.value;
  const baseImponible = parseFloat(document.querySelector('#imp-isc-base')?.value) || 0;
  const tasa = parseFloat(document.querySelector('#imp-isc-tasa')?.value) || 0;
  const resultDiv = document.querySelector('#imp-isc-result');
  if (!resultDiv || !anho || !mes || !rubro || !baseImponible || !tasa) {
    if (resultDiv) resultDiv.innerHTML = '<div class="text-center py-6 text-yellow-400 text-sm">Completa todos los campos</div>';
    return;
  }
  resultDiv.innerHTML = '<div class="text-center py-6 text-gray-500">Calculando...</div>';
  try {
    const data = await api('/finance/fiscal/isc/calcular', { method: 'POST', body: { anho, mes, rubro, baseImponible, tasa } });
    resultDiv.innerHTML = renderImpFormResult(data, `ISC ${rubro.replace(/_/g, ' ')} — ${mes}/${anho}`, [
      { label: 'Base Imponible', value: baseImponible },
      { label: 'Tasa', value: `${(tasa * 100).toFixed(0)}%`, prefix: '', color: 'blue' },
      { label: 'Impuesto ISC', value: Number(data?.impuestoIsc || 0), color: 'red' },
    ]);
    cargarIsc();
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderInrForm() {
  const now = new Date();
  return `<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="imp-inr-mes" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) =>
          `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="imp-inr-anho" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        ${[2024,2025,2026,2027].map(a => `<option value="${a}" ${a === now.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
      <select id="imp-inr-tipo" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        <option value="SERVICIOS_TECNICOS">Servicios Técnicos</option>
        <option value="REGALIAS">Regalías</option>
        <option value="INTERESES">Intereses</option>
        <option value="DIVIDENDOS">Dividendos</option>
        <option value="OTROS">Otros</option>
      </select>
      <input id="imp-inr-monto" type="number" min="0" step="100000" placeholder="Monto Bruto"
        class="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <input id="imp-inr-tasa" type="number" min="0" max="1" step="0.01" placeholder="Tasa (ej: 0.15)"
        class="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <button id="btn-calcular-inr" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular INR</button>
    </div>
    <div id="imp-inr-result"></div>
    <div id="imp-inr-historial"></div>
  </div>`;
}

async function cargarInr() {
  const container = document.querySelector('#impuestos-content');
  if (!container) return;
  container.innerHTML = renderInrForm();
  try {
    const historial = await api('/finance/fiscal/inr');
    const histDiv = document.querySelector('#imp-inr-historial');
    if (histDiv) histDiv.innerHTML = renderHistorial(
      Array.isArray(historial) ? historial : historial?.data || [],
      [
        { label: 'Período', render: r => `${r.mes || ''}/${r.anho || ''}` },
        { label: 'Tipo Renta', render: r => r.tipoRenta?.replace(/_/g, ' ') || '' },
        { label: 'Monto Bruto', align: 'right', render: r => `₲ ${Number(r.montoBruto || 0).toLocaleString('es-PY')}` },
        { label: 'Retención', align: 'right', font: 'bold', render: r => `₲ ${Number(r.impuestoInr || r.retencion || 0).toLocaleString('es-PY')}` },
      ]
    );
  } catch { /* empty */ }
}

async function calcularInr() {
  const anho = parseInt(document.querySelector('#imp-inr-anho')?.value, 10);
  const mes = parseInt(document.querySelector('#imp-inr-mes')?.value, 10);
  const tipoRenta = document.querySelector('#imp-inr-tipo')?.value;
  const montoBruto = parseFloat(document.querySelector('#imp-inr-monto')?.value) || 0;
  const tasaRetencion = parseFloat(document.querySelector('#imp-inr-tasa')?.value) || 0;
  const resultDiv = document.querySelector('#imp-inr-result');
  if (!resultDiv || !anho || !mes || !tipoRenta || !montoBruto || !tasaRetencion) {
    if (resultDiv) resultDiv.innerHTML = '<div class="text-center py-6 text-yellow-400 text-sm">Completa todos los campos</div>';
    return;
  }
  resultDiv.innerHTML = '<div class="text-center py-6 text-gray-500">Calculando...</div>';
  try {
    const data = await api('/finance/fiscal/inr/calcular', { method: 'POST', body: { anho, mes, tipoRenta, montoBruto, tasaRetencion, beneficiarioNombre: 'No especificado', beneficiarioPais: 'PY' } });
    resultDiv.innerHTML = renderImpFormResult(data, `INR ${tipoRenta.replace(/_/g, ' ')} — ${mes}/${anho}`, [
      { label: 'Monto Bruto', value: montoBruto, color: 'green' },
      { label: 'Tasa Retención', value: `${(tasaRetencion * 100).toFixed(0)}%`, prefix: '', color: 'blue' },
      { label: 'Retención INR', value: Number(data?.impuestoInr || data?.retencion || 0), color: 'red' },
    ]);
    cargarInr();
  } catch (e) {
    resultDiv.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}
/* ─── CRUD Cuentas Contables ────────────── */

let cuentaParentOptions = [];

async function mostrarModalNuevaCuenta() {
  try {
    const cuentas = await api('/finance/contabilidad/cuentas/arbol');
    // Build flat options for parent select
    function flatten(rows, depth = 0) {
      let opts = [];
      for (const r of rows) {
        opts.push({ id: r.id, codigo: r.codigo, nombre: r.nombre, depth });
        if (r.children) opts = opts.concat(flatten(r.children, depth + 1));
      }
      return opts;
    }
    cuentaParentOptions = flatten(Array.isArray(cuentas) ? cuentas : []);
    const parentOpts = cuentaParentOptions.map(p =>
      `<option value="${p.id}">${'·'.repeat(p.depth)} ${p.codigo} — ${esc(p.nombre)}</option>`
    ).join('');
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Nueva Cuenta Contable</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Código</label>
          <input id="cuenta-codigo" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono" placeholder="Ej: 1.1.4.01" required>
        </div>
        <div>
          <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
          <input id="cuenta-nombre" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" placeholder="Nombre de la cuenta" required>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
            <select id="cuenta-tipo" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="ACTIVO">Activo</option>
              <option value="PASIVO">Pasivo</option>
              <option value="PATRIMONIO">Patrimonio</option>
              <option value="INGRESO">Ingreso</option>
              <option value="COSTO">Costo</option>
              <option value="GASTO">Gasto</option>
              <option value="ORDEN">Orden</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Cuenta Padre</label>
            <select id="cuenta-padre" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="">— Sin padre (raíz) —</option>
              ${parentOpts}
            </select>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input id="cuenta-acepta-mov" type="checkbox" checked class="rounded bg-gray-800 border-gray-700">
          <span class="text-gray-400">Acepta movimientos contables</span>
        </label>
        <p id="cuenta-error" class="text-red-400 text-sm hidden"></p>
        <div class="flex gap-3">
          <button id="btn-guardar-cuenta" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Cuenta</button>
          <button id="modal-close-bottom" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
        </div>
      </div>`;
    dom.modalOverlay.classList.remove('hidden');
  } catch (e) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error al cargar cuentas: ${esc(e.message)}</div>`;
    dom.modalOverlay.classList.remove('hidden');
  }
}

async function guardarNuevaCuenta() {
  const codigo = document.querySelector('#cuenta-codigo')?.value?.trim();
  const nombre = document.querySelector('#cuenta-nombre')?.value?.trim();
  const tipo = document.querySelector('#cuenta-tipo')?.value;
  const cuentaPadreId = document.querySelector('#cuenta-padre')?.value || null;
  const aceptaMovimientos = document.querySelector('#cuenta-acepta-mov')?.checked || false;
  const errEl = document.querySelector('#cuenta-error');

  if (!codigo || !nombre) {
    if (errEl) { errEl.textContent = 'Código y nombre son obligatorios'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    await api('/finance/contabilidad/cuentas', {
      method: 'POST',
      body: { codigo, nombre, tipo, cuentaPadreId, aceptaMovimientos },
    });
    dom.modalOverlay.classList.add('hidden');
    showContabTab('cuentas');
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}

async function desactivarCuenta(cuentaId) {
  if (!confirm('¿Desactivar esta cuenta? Las cuentas inactivas no pueden usarse en nuevos asientos.')) return;
  try {
    await api(`/finance/contabilidad/cuentas/${cuentaId}`, {
      method: 'PATCH',
      body: { activo: false },
    });
    showContabTab('cuentas');
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

/* ─── Asiento Manual ────────────────────── */

let asientoLineasCount = 0;

async function mostrarModalNuevoAsiento() {
  asientoLineasCount = 0;
  try {
    // Fetch cuentas for the line selector
    const cuentasList = await api('/finance/contabilidad/cuentas?activo=true');
    const cuentasOpts = Array.isArray(cuentasList)
      ? cuentasList.filter(c => c.aceptaMovimientos !== false).map(c =>
          `<option value="${c.id}">${c.codigo} — ${esc(c.nombre)}</option>`
        ).join('')
      : '<option value="">Sin cuentas disponibles</option>';

    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold">Nuevo Asiento Manual</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <p class="text-xs text-yellow-400 mb-4 bg-yellow-900/20 p-2 rounded-lg">
        ⚠️ Solo para casos excepcionales. Los asientos se generan automáticamente al facturar, comprar, calcular nómina, etc.
      </p>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Fecha</label>
            <input id="asiento-fecha" type="date" value="${new Date().toISOString().slice(0, 10)}" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          </div>
          <div>
            <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Documento Ref.</label>
            <input id="asiento-docref" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono" placeholder="Opcional">
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 uppercase tracking-wider mb-1">Concepto</label>
          <input id="asiento-concepto" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" placeholder="Describa el motivo del asiento" required>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500 uppercase tracking-wider">Líneas del Asiento</label>
            <button id="btn-agregar-linea-asiento" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium transition">+ Agregar Línea</button>
          </div>
          <div id="lineas-asiento-container" class="space-y-2">
            <p class="text-xs text-gray-500 text-center py-4">Haz clic en "Agregar Línea" para añadir cuentas</p>
          </div>
        </div>
        <div id="asiento-totales" class="hidden grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Total Debe</p>
            <p id="asiento-total-debe" class="text-green-400 font-bold text-lg mt-1">₲ 0</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Total Haber</p>
            <p id="asiento-total-haber" class="text-red-400 font-bold text-lg mt-1">₲ 0</p>
          </div>
        </div>
        <p id="asiento-error" class="text-red-400 text-sm hidden"></p>
        <div class="flex gap-3">
          <button id="btn-guardar-asiento" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition ${cuentasOpts ? '' : 'opacity-50 cursor-not-allowed'}" ${cuentasOpts ? '' : 'disabled'}>Guardar Asiento</button>
          <button id="modal-close-bottom" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
        </div>
      </div>`;
    dom.modalOverlay.classList.remove('hidden');
  } catch (e) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
    dom.modalOverlay.classList.remove('hidden');
  }
}

function agregarLineaAsiento() {
  asientoLineasCount++;
  const idx = asientoLineasCount;
  const container = document.querySelector('#lineas-asiento-container');
  if (!container) return;
  // Remove the empty placeholder if it exists
  const placeholder = container.querySelector('p');
  if (placeholder && container.children.length === 1) container.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';
  row.id = `asiento-linea-${idx}`;
  row.innerHTML = `
    <select class="linea-cuenta flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white" data-idx="${idx}">
      <option value="">Seleccionar cuenta</option>
    </select>
    <input class="linea-debe w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-right font-mono text-green-400" placeholder="Debe" data-idx="${idx}">
    <input class="linea-haber w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-right font-mono text-red-400" placeholder="Haber" data-idx="${idx}">
    <button class="linea-remove text-red-500 hover:text-red-400 text-xs px-1" data-idx="${idx}" title="Eliminar línea">&times;</button>
  `;
  container.appendChild(row);

  // Populate the select from the API
  api('/finance/contabilidad/cuentas?activo=true').then(cuentas => {
    const select = row.querySelector('.linea-cuenta');
    if (Array.isArray(cuentas)) {
      cuentas.filter(c => c.aceptaMovimientos !== false).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.codigo} — ${c.nombre}`;
        select.appendChild(opt);
      });
    }
  }).catch(() => {});

  // Add live balance recalculation
  const debeInput = row.querySelector('.linea-debe');
  const haberInput = row.querySelector('.linea-haber');
  [debeInput, haberInput].forEach(inp => {
    inp.addEventListener('input', recalcularTotalesAsiento);
    inp.addEventListener('blur', () => {
      const v = parseFloat(inp.value) || 0;
      if (v > 0) inp.value = v.toFixed(0);
    });
  });

  // Remove button handler
  row.querySelector('.linea-remove').addEventListener('click', () => {
    row.remove();
    recalcularTotalesAsiento();
  });

  // Focus the select
  row.querySelector('.linea-cuenta')?.focus();
  recalcularTotalesAsiento();
}

function recalcularTotalesAsiento() {
  const totalDebeEl = document.querySelector('#asiento-total-debe');
  const totalHaberEl = document.querySelector('#asiento-total-haber');
  const totalesDiv = document.querySelector('#asiento-totales');
  if (!totalDebeEl || !totalHaberEl) return;

  let debe = 0, haber = 0;
  document.querySelectorAll('.linea-debe').forEach(inp => {
    debe += parseFloat(inp.value) || 0;
  });
  document.querySelectorAll('.linea-haber').forEach(inp => {
    haber += parseFloat(inp.value) || 0;
  });

  totalesDiv.classList.remove('hidden');
  totalDebeEl.textContent = '₲ ' + debe.toLocaleString('es-PY');
  totalHaberEl.textContent = '₲ ' + haber.toLocaleString('es-PY');
  totalDebeEl.className = `font-bold text-lg mt-1 ${Math.abs(debe - haber) < 0.01 ? 'text-green-400' : 'text-red-400'}`;
  totalHaberEl.className = `font-bold text-lg mt-1 ${Math.abs(debe - haber) < 0.01 ? 'text-green-400' : 'text-red-400'}`;
}

async function guardarNuevoAsiento() {
  const fecha = document.querySelector('#asiento-fecha')?.value;
  const concepto = document.querySelector('#asiento-concepto')?.value?.trim();
  const documentoRef = document.querySelector('#asiento-docref')?.value?.trim() || null;
  const errEl = document.querySelector('#asiento-error');

  if (!fecha || !concepto) {
    if (errEl) { errEl.textContent = 'Fecha y concepto son obligatorios'; errEl.classList.remove('hidden'); }
    return;
  }

  const lineas = [];
  document.querySelectorAll('#lineas-asiento-container > div').forEach(row => {
    const cuentaId = row.querySelector('.linea-cuenta')?.value;
    const debe = parseFloat(row.querySelector('.linea-debe')?.value) || 0;
    const haber = parseFloat(row.querySelector('.linea-haber')?.value) || 0;
    if (cuentaId && (debe > 0 || haber > 0)) {
      lineas.push({ cuentaId, debe: debe > 0 ? debe.toFixed(2) : undefined, haber: haber > 0 ? haber.toFixed(2) : undefined });
    }
  });

  if (lineas.length < 2) {
    if (errEl) { errEl.textContent = 'Se necesitan al menos 2 líneas (Débito y Crédito)'; errEl.classList.remove('hidden'); }
    return;
  }

  const debeTotal = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
  const haberTotal = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  if (Math.abs(debeTotal - haberTotal) > 0.01) {
    if (errEl) { errEl.textContent = `Total Debe (${debeTotal}) ≠ Total Haber (${haberTotal}). El asiento no cuadra.`; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    await api('/finance/contabilidad/asientos', {
      method: 'POST',
      body: { fecha: new Date(fecha).toISOString(), concepto, documentoRef, moduloOrigen: 'CONTABILIDAD', lineas },
    });
    dom.modalOverlay.classList.add('hidden');
    showContabTab('asientos');
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}
