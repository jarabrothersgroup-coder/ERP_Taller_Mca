/**
 * Recepción Checklist — Structured vehicle check-in UI.
 *
 * Visual car body diagram with clickable panels, tire condition,
 * fuel level, accessories, and digital signature capture.
 *
 * @module js/recepcion-checklist
 */

/* global api, esc, showToast, dom */

// ─── State ──────────────────────────────────────

let _checklistState = {
  panels: {
    capot:          { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    paragolpesDel:  { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    paragolpesTras: { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    puertaDelIzq:   { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    puertaDelDer:   { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    puertaTrasIzq:  { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    puertaTrasDer:  { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    maletero:       { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    techo:          { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    espejoIzq:      { estado: 'BUENO', fotoUrl: null, observaciones: '' },
    espejoDer:      { estado: 'BUENO', fotoUrl: null, observaciones: '' },
  },
  neumaticos: {
    delIzq:   { psi: '', condition: '' },
    delDer:   { psi: '', condition: '' },
    trasIzq:  { psi: '', condition: '' },
    trasDer:  { psi: '', condition: '' },
    repuesto: { psi: '', condition: '' },
  },
  nivelCombustibleExacto: 0.5,
  kilometrajeFoto: false,
  accesorios: {
    gato: false,
    triangulos: false,
    extintor: false,
    ruedaRepuesto: false,
    herramientas: false,
    manual: false,
    radioCodigo: '',
    otros: [],
  },
  observacionesCliente: '',
  firmaCliente: null,
  firmaClienteNombre: '',
};

// ─── Panel labels ───────────────────────────────

const PANEL_LABELS = {
  capot:          'Capó',
  paragolpesDel:  'Paragolpes Delantero',
  paragolpesTras: 'Paragolpes Trasero',
  puertaDelIzq:   'Puerta Del. Izq.',
  puertaDelDer:   'Puerta Del. Der.',
  puertaTrasIzq:  'Puerta Tras. Izq.',
  puertaTrasDer:  'Puerta Tras. Der.',
  maletero:       'Maletero',
  techo:          'Techo',
  espejoIzq:      'Espejo Izq.',
  espejoDer:      'Espejo Der.',
};

const ESTADO_COLORS = {
  BUENO:            { bg: 'bg-green-900/50', text: 'text-green-400', border: 'border-green-700', dot: 'bg-green-500' },
  RAYADO:           { bg: 'bg-yellow-900/50', text: 'text-yellow-400', border: 'border-yellow-700', dot: 'bg-yellow-500' },
  ABOLLADO:         { bg: 'bg-orange-900/50', text: 'text-orange-400', border: 'border-orange-700', dot: 'bg-orange-500' },
  ROTO:             { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700', dot: 'bg-red-500' },
  ABOLLADO_RAYADO:  { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700', dot: 'bg-red-500' },
};

const ESTADOS = ['BUENO', 'RAYADO', 'ABOLLADO', 'ROTO', 'ABOLLADO_RAYADO'];

// ─── Main Render ────────────────────────────────

/**
 * Renders the reception checklist form inside the given container.
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {string} ingresoId - The ingreso UUID to associate the checklist with
 */
async function renderRecepcionChecklist(container, ingresoId) {
  // Try loading existing checklist
  try {
    const existing = await api(`/workshop/ingresos/${ingresoId}/checklist`);
    if (existing) {
      _checklistState = {
        panels: existing.panels || _checklistState.panels,
        neumaticos: existing.neumaticos || _checklistState.neumaticos,
        nivelCombustibleExacto: existing.nivelCombustibleExacto ?? 0.5,
        kilometrajeFoto: existing.kilometrajeFoto ?? false,
        accesorios: existing.accesorios || _checklistState.accesorios,
        observacionesCliente: existing.observacionesCliente || '',
        firmaCliente: existing.firmaCliente || null,
        firmaClienteNombre: existing.firmaClienteNombre || '',
      };
    }
  } catch {
    // No existing checklist — use defaults
  }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Checklist de Recepción</h2>
        <p class="text-sm text-gray-400">Ingreso #${esc(ingresoId.slice(0, 8))}</p>
      </div>
      <div class="flex gap-2">
        <button onclick="resetChecklistState()" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition">
          Restablecer
        </button>
        <button onclick="saveChecklist('${esc(ingresoId)}')" id="checklist-save-btn"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition shadow-lg">
          Guardar Checklist
        </button>
      </div>
    </div>

    <!-- Panel Diagram -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Estado Exterior por Panel</h3>
      <div id="panel-diagram" class="relative"></div>
      <div id="panel-legend" class="flex flex-wrap gap-3 mt-3 text-xs">
        ${ESTADOS.map(e => {
          const c = ESTADO_COLORS[e];
          return `<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full ${c.dot}"></span><span class="${c.text}">${e.replace(/_/g, ' ')}</span></span>`;
        }).join('')}
      </div>
    </div>

    <!-- Active Panel Detail (hidden by default) -->
    <div id="panel-detail" class="hidden bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 id="panel-detail-title" class="text-sm font-medium text-white"></h3>
        <button onclick="hidePanelDetail()" class="text-gray-500 hover:text-white text-sm">&times;</button>
      </div>
      <div id="panel-detail-body"></div>
    </div>

    <!-- Tires -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Estado de Neumáticos</h3>
      <div id="tire-section" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"></div>
    </div>

    <!-- Fuel + Kilometraje -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Combustible y Kilometraje</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-2">Nivel de Combustible</label>
          <div class="flex items-center gap-3">
            <input type="range" id="fuel-slider" min="0" max="100" value="${Math.round(_checklistState.nivelCombustibleExacto * 100)}"
              class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              oninput="updateFuelDisplay(this.value)">
            <span id="fuel-display" class="text-sm font-mono text-white w-12 text-right">${Math.round(_checklistState.nivelCombustibleExacto * 100)}%</span>
          </div>
          <div id="fuel-gauge" class="mt-2 h-3 bg-gray-800 rounded-full overflow-hidden">
            <div id="fuel-bar" class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width: ${Math.round(_checklistState.nivelCombustibleExacto * 100)}%"></div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <input type="checkbox" id="km-foto" ${_checklistState.kilometrajeFoto ? 'checked' : ''}
            class="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 accent-blue-500 focus:ring-2 focus:ring-blue-500/30">
          <label for="km-foto" class="text-sm text-gray-300 cursor-pointer">Foto del kilometraje tomada</label>
        </div>
      </div>
    </div>

    <!-- Accessories -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Accesorios</h3>
      <div id="accessories-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>
      <div class="mt-3">
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Código de Radio</label>
        <input type="text" id="radio-codigo" value="${esc(_checklistState.accesorios.radioCodigo || '')}"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          placeholder="Código del radio (si aplica)">
      </div>
      <div class="mt-3">
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Otros accesorios</label>
        <input type="text" id="otros-accesorios" value="${esc((_checklistState.accesorios.otros || []).join(', '))}"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          placeholder="Separar con coma: estéreo, kit herramientas...">
      </div>
    </div>

    <!-- Observations -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Observaciones del Cliente</h3>
      <textarea id="obs-cliente" rows="3"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        placeholder="Notas del cliente sobre el estado del vehículo...">${esc(_checklistState.observacionesCliente)}</textarea>
    </div>

    <!-- Digital Signature -->
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-300 mb-3">Firma del Cliente</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div id="signature-pad-container" class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"></div>
          <div class="flex gap-2 mt-2">
            <button onclick="clearSignaturePad()" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition">Limpiar</button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre del firmante</label>
          <input type="text" id="firma-nombre" value="${esc(_checklistState.firmaClienteNombre)}"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Nombre completo">
          ${_checklistState.firmaCliente ? '<p class="text-xs text-green-400 mt-2">✓ Firma capturada</p>' : '<p class="text-xs text-gray-500 mt-2">Firme en el recuadro</p>'}
        </div>
      </div>
    </div>

    <!-- Save Button (bottom) -->
    <div class="flex justify-end">
      <button onclick="saveChecklist('${esc(ingresoId)}')" id="checklist-save-btn-bottom"
        class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition shadow-lg hover:shadow-blue-500/20">
        Guardar Checklist
      </button>
    </div>
  `;

  renderPanelDiagram();
  renderTireSection();
  renderAccessoriesGrid();
  initSignaturePad();
}

// ─── Panel Diagram ──────────────────────────────

function renderPanelDiagram() {
  const el = document.getElementById('panel-diagram');
  if (!el) return;

  // CSS grid-based car top-view layout
  el.innerHTML = `
    <div class="grid grid-cols-5 gap-2 max-w-lg mx-auto" style="grid-template-rows: auto auto auto auto auto;">
      <!-- Row 1: Techo -->
      <div class="col-start-2 col-span-3">
        ${renderPanelButton('techo')}
      </div>
      <!-- Row 2: Capó + Maletero -->
      <div>
        ${renderPanelButton('capot')}
      </div>
      <div class="col-start-5">
        ${renderPanelButton('maletero')}
      </div>
      <!-- Row 3: Paragolpes + Espejos -->
      <div>
        ${renderPanelButton('paragolpesDel')}
      </div>
      <div class="col-start-2">
        ${renderPanelButton('espejoIzq')}
      </div>
      <div class="col-start-4">
        ${renderPanelButton('espejoDer')}
      </div>
      <div class="col-start-5">
        ${renderPanelButton('paragolpesTras')}
      </div>
      <!-- Row 4: Puertas Delanteras -->
      <div class="col-start-2">
        ${renderPanelButton('puertaDelIzq')}
      </div>
      <div class="col-start-4">
        ${renderPanelButton('puertaDelDer')}
      </div>
      <!-- Row 5: Puertas Traseras -->
      <div class="col-start-2">
        ${renderPanelButton('puertaTrasIzq')}
      </div>
      <div class="col-start-4">
        ${renderPanelButton('puertaTrasDer')}
      </div>
    </div>
  `;
}

function renderPanelButton(panelKey) {
  const panel = _checklistState.panels[panelKey];
  const estado = panel?.estado || 'BUENO';
  const c = ESTADO_COLORS[estado];
  const label = PANEL_LABELS[panelKey];

  return `
    <button onclick="showPanelDetail('${panelKey}')"
      class="w-full py-2 px-1 rounded-lg border ${c.border} ${c.bg} text-xs font-medium ${c.text} transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-center"
      title="${label}: ${estado.replace(/_/g, ' ')}">
      <span class="block text-[10px] opacity-70">${label}</span>
      <span class="block text-[10px] mt-0.5">${estado.replace(/_/g, ' ')}</span>
    </button>
  `;
}

// ─── Panel Detail ───────────────────────────────

let _activePanel = null;

function showPanelDetail(panelKey) {
  _activePanel = panelKey;
  const detail = document.getElementById('panel-detail');
  const title = document.getElementById('panel-detail-title');
  const body = document.getElementById('panel-detail-body');
  if (!detail || !title || !body) return;

  const panel = _checklistState.panels[panelKey];
  title.textContent = PANEL_LABELS[panelKey];

  body.innerHTML = `
    <div class="space-y-3">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-2">Estado</label>
        <div class="flex flex-wrap gap-2">
          ${ESTADOS.map(e => {
            const c = ESTADO_COLORS[e];
            const selected = panel.estado === e;
            return `<button onclick="setPanelEstado('${panelKey}', '${e}')"
              class="px-3 py-1.5 rounded-lg border text-xs font-medium transition ${selected ? c.bg + ' ' + c.text + ' ' + c.border + ' ring-2 ring-blue-500/30' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}">
              ${e.replace(/_/g, ' ')}
            </button>`;
          }).join('')}
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Observaciones</label>
        <input type="text" id="panel-obs" value="${esc(panel.observaciones || '')}"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          placeholder="Ej: abolladura pequeña en la esquina..."
          onchange="updatePanelObs('${panelKey}', this.value)">
      </div>
    </div>
  `;

  detail.classList.remove('hidden');
}

function hidePanelDetail() {
  const detail = document.getElementById('panel-detail');
  if (detail) detail.classList.add('hidden');
  _activePanel = null;
}

function setPanelEstado(panelKey, estado) {
  _checklistState.panels[panelKey].estado = estado;
  renderPanelDiagram();
  showPanelDetail(panelKey); // refresh detail view
}

function updatePanelObs(panelKey, value) {
  _checklistState.panels[panelKey].observaciones = value;
}

// ─── Tire Section ───────────────────────────────

const TIRE_LABELS = {
  delIzq:   'Del. Izquierdo',
  delDer:   'Del. Derecho',
  trasIzq:  'Tras. Izquierdo',
  trasDer:  'Tras. Derecho',
  repuesto: 'Repuesto',
};

function renderTireSection() {
  const el = document.getElementById('tire-section');
  if (!el) return;

  el.innerHTML = Object.entries(TIRE_LABELS).map(([key, label]) => {
    const tire = _checklistState.neumaticos[key] || { psi: '', condition: '' };
    return `
      <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <label class="text-xs text-gray-400 block mb-2 font-medium">${label}</label>
        <input type="text" value="${esc(tire.psi)}"
          class="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-1.5"
          placeholder="PSI"
          onchange="updateTire('${key}', 'psi', this.value)">
        <select onchange="updateTire('${key}', 'condition', this.value)"
          class="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="" ${!tire.condition ? 'selected' : ''}>Seleccionar...</option>
          <option value="BUENO" ${tire.condition === 'BUENO' ? 'selected' : ''}>Bueno</option>
          <option value="REGULAR" ${tire.condition === 'REGULAR' ? 'selected' : ''}>Regular</option>
          <option value="MALO" ${tire.condition === 'MALO' ? 'selected' : ''}>Malo</option>
          <option value="ROTO" ${tire.condition === 'ROTO' ? 'selected' : ''}>Roto</option>
        </select>
      </div>
    `;
  }).join('');
}

function updateTire(key, field, value) {
  if (!_checklistState.neumaticos[key]) {
    _checklistState.neumaticos[key] = { psi: '', condition: '' };
  }
  _checklistState.neumaticos[key][field] = value;
}

// ─── Fuel Gauge ─────────────────────────────────

function updateFuelDisplay(value) {
  _checklistState.nivelCombustibleExacto = value / 100;
  const display = document.getElementById('fuel-display');
  const bar = document.getElementById('fuel-bar');
  if (display) display.textContent = value + '%';
  if (bar) {
    bar.style.width = value + '%';
    if (value <= 15) bar.className = 'h-full bg-red-500 rounded-full transition-all duration-300';
    else if (value <= 30) bar.className = 'h-full bg-yellow-500 rounded-full transition-all duration-300';
    else bar.className = 'h-full bg-blue-500 rounded-full transition-all duration-300';
  }
}

// ─── Accessories Grid ───────────────────────────

const ACCESSORY_ITEMS = [
  { key: 'gato',            label: 'Gato' },
  { key: 'triangulos',      label: 'Triángulos' },
  { key: 'extintor',        label: 'Extintor' },
  { key: 'ruedaRepuesto',   label: 'Rueda Repuesto' },
  { key: 'herramientas',    label: 'Herramientas' },
  { key: 'manual',          label: 'Manual' },
];

function renderAccessoriesGrid() {
  const el = document.getElementById('accessories-grid');
  if (!el) return;

  el.innerHTML = ACCESSORY_ITEMS.map(item => {
    const checked = _checklistState.accesorios[item.key];
    return `
      <label class="flex items-center gap-2 bg-gray-800/50 rounded-lg p-3 border border-gray-700 cursor-pointer hover:bg-gray-800 transition">
        <input type="checkbox" ${checked ? 'checked' : ''}
          onchange="updateAccessory('${item.key}', this.checked)"
          class="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 accent-blue-500 focus:ring-2 focus:ring-blue-500/30">
        <span class="text-sm text-gray-300">${item.label}</span>
      </label>
    `;
  }).join('');
}

function updateAccessory(key, value) {
  _checklistState.accesorios[key] = value;
}

// ─── Signature Pad ──────────────────────────────

let _sigCanvas = null;
let _sigCtx = null;
let _sigDrawing = false;

function initSignaturePad() {
  const container = document.getElementById('signature-pad-container');
  if (!container) return;

  container.innerHTML = `
    <canvas id="signature-canvas" width="400" height="150"
      class="w-full cursor-crosshair bg-gray-900"
      style="touch-action: none;"></canvas>
  `;

  _sigCanvas = document.getElementById('signature-canvas');
  if (!_sigCanvas) return;
  _sigCtx = _sigCanvas.getContext('2d');

  // Restore existing signature
  if (_checklistState.firmaCliente) {
    const img = new Image();
    img.onload = () => {
      _sigCtx.drawImage(img, 0, 0, _sigCanvas.width, _sigCanvas.height);
    };
    img.src = _checklistState.firmaCliente;
  }

  // Drawing events
  _sigCanvas.addEventListener('pointerdown', sigStart);
  _sigCanvas.addEventListener('pointermove', sigMove);
  _sigCanvas.addEventListener('pointerup', sigEnd);
  _sigCanvas.addEventListener('pointerleave', sigEnd);

  // Style
  _sigCtx.strokeStyle = '#e5e7eb';
  _sigCtx.lineWidth = 2;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';
}

function sigStart(e) {
  _sigDrawing = true;
  _sigCtx.beginPath();
  _sigCtx.moveTo(e.offsetX, e.offsetY);
}

function sigMove(e) {
  if (!_sigDrawing) return;
  _sigCtx.lineTo(e.offsetX, e.offsetY);
  _sigCtx.stroke();
}

function sigEnd() {
  _sigDrawing = false;
  if (_sigCanvas) {
    _checklistState.firmaCliente = _sigCanvas.toDataURL('image/png');
  }
}

function clearSignaturePad() {
  if (_sigCtx && _sigCanvas) {
    _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height);
    _checklistState.firmaCliente = null;
  }
}

// ─── Save ───────────────────────────────────────

async function saveChecklist(ingresoId) {
  const btn = document.getElementById('checklist-save-btn');
  const btnBottom = document.getElementById('checklist-save-btn-bottom');

  // Collect data from DOM
  _checklistState.observacionesCliente = document.getElementById('obs-cliente')?.value || '';
  _checklistState.firmaClienteNombre = document.getElementById('firma-nombre')?.value || '';
  _checklistState.kilometrajeFoto = document.getElementById('km-foto')?.checked || false;
  _checklistState.accesorios.radioCodigo = document.getElementById('radio-codigo')?.value || '';

  const otrosRaw = document.getElementById('otros-accesorios')?.value || '';
  _checklistState.accesorios.otros = otrosRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Validate minimum
  const hasAnyDamage = Object.values(_checklistState.panels).some(p => p.estado !== 'BUENO');
  if (hasAnyDamage && !_checklistState.firmaCliente) {
    if (typeof showToast === 'function') {
      showToast('Si hay daños, se recomienda firma del cliente', 'warning');
    }
  }

  // Disable buttons
  if (btn) btn.disabled = true;
  if (btnBottom) btnBottom.disabled = true;

  try {
    await api(`/workshop/ingresos/${ingresoId}/checklist`, {
      method: 'POST',
      body: _checklistState,
    });
    if (typeof showToast === 'function') {
      showToast('Checklist guardado correctamente', 'success');
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('Error al guardar: ' + (err.message || 'Error desconocido'), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnBottom) btnBottom.disabled = false;
  }
}

function resetChecklistState() {
  _checklistState = {
    panels: Object.fromEntries(
      Object.keys(PANEL_LABELS).map(k => [k, { estado: 'BUENO', fotoUrl: null, observaciones: '' }])
    ),
    neumaticos: {
      delIzq: { psi: '', condition: '' },
      delDer: { psi: '', condition: '' },
      trasIzq: { psi: '', condition: '' },
      trasDer: { psi: '', condition: '' },
      repuesto: { psi: '', condition: '' },
    },
    nivelCombustibleExacto: 0.5,
    kilometrajeFoto: false,
    accesorios: {
      gato: false, triangulos: false, extintor: false,
      ruedaRepuesto: false, herramientas: false, manual: false,
      radioCodigo: '', otros: [],
    },
    observacionesCliente: '',
    firmaCliente: null,
    firmaClienteNombre: '',
  };
  renderPanelDiagram();
  renderTireSection();
  renderAccessoriesGrid();
  clearSignaturePad();
  const fuelSlider = document.getElementById('fuel-slider');
  if (fuelSlider) { fuelSlider.value = 50; updateFuelDisplay(50); }
  if (typeof showToast === 'function') showToast('Checklist restablecido', 'info');
}

// ─── Global exports ─────────────────────────────

window.renderRecepcionChecklist = renderRecepcionChecklist;
window.showPanelDetail = showPanelDetail;
window.hidePanelDetail = hidePanelDetail;
window.setPanelEstado = setPanelEstado;
window.updatePanelObs = updatePanelObs;
window.updateTire = updateTire;
window.updateFuelDisplay = updateFuelDisplay;
window.updateAccessory = updateAccessory;
window.clearSignaturePad = clearSignaturePad;
window.saveChecklist = saveChecklist;
window.resetChecklistState = resetChecklistState;
