/**
 * WhatsApp Template Builder — Frontend Module.
 *
 * Features:
 *   - Template list with categories and status
 *   - Template editor with live preview
 *   - Variable insertion helper
 *   - Follow-up scheduling UI
 *   - Follow-up stats dashboard
 *
 * @module js/wa-templates
 */

/* global api, esc */

// ─── State ──────────────────────────────────
let _waTmplState = {
  templates: [],
  editingKey: null,
  followups: [],
  stats: null,
};

// ─── Template Builder View ──────────────────

function renderWhatsAppTemplates(container) {
  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 class="text-lg font-bold text-white flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg> Plantillas WhatsApp</h3>
          <p class="text-xs text-gray-500">Crea y administra plantillas con variables dinámicas</p>
        </div>
        <div class="flex gap-2">
          <button onclick="waTmplSeedDefaults()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Cargar Defaults</button>
          <button onclick="waTmplOpenEditor()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Nueva Plantilla</button>
        </div>
      </div>

      <!-- Variable Reference -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Variables Disponibles</h4>
        <div id="wa-tmpl-vars" class="flex flex-wrap gap-2 text-xs"></div>
      </div>

      <!-- Template List -->
      <div id="wa-tmpl-list" class="space-y-3"></div>

      <!-- Follow-up Stats -->
      <div id="wa-followup-stats" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 hidden">
        <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> Estad&iacute;sticas de Seguimientos</h4>
        <div id="wa-followup-stats-grid" class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>
      </div>

      <!-- Follow-up List -->
      <div id="wa-followup-list" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 hidden">
        <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Seguimientos Programados</h4>
        <div id="wa-followup-items" class="space-y-2"></div>
      </div>
    </div>
  `;

  waTmplLoadAll();
}

// ─── Data Loading ───────────────────────────

async function waTmplLoadAll() {
  await Promise.all([
    waTmplLoadList(),
    waTmplLoadVariables(),
    waTmplLoadFollowups(),
  ]);
}

async function waTmplLoadList() {
  try {
    const templates = await api('/whatsapp/templates');
    _waTmplState.templates = templates || [];
    waTmplRenderList();
  } catch (err) {
    console.error('[WA-Templates] Error loading:', err);
  }
}

async function waTmplLoadVariables() {
  try {
    const vars = await api('/whatsapp/templates/variables');
    const container = document.getElementById('wa-tmpl-vars');
    if (!container || !vars) return;

    container.innerHTML = Object.entries(vars).map(([key, desc]) => `
      <button onclick="waTmplInsertVar('${key}')" class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition" title="${esc(desc)}">
        <span class="text-blue-400">{{${key}}}</span>
      </button>
    `).join('');
  } catch (err) {
    console.error('[WA-Templates] Error loading variables:', err);
  }
}

async function waTmplLoadFollowups() {
  try {
    const [followups, stats] = await Promise.all([
      api('/whatsapp/followups?limit=20'),
      api('/whatsapp/followups/stats'),
    ]);

    _waTmplState.followups = followups || [];
    _waTmplState.stats = stats;

    waTmplRenderFollowupStats();
    waTmplRenderFollowupList();
  } catch (err) {
    console.error('[WA-Templates] Error loading followups:', err);
  }
}

// ─── Template List Rendering ────────────────

function waTmplRenderList() {
  const container = document.getElementById('wa-tmpl-list');
  if (!container) return;

  const templates = _waTmplState.templates;
  if (!templates.length) {
    container.innerHTML = '<p class="text-gray-500 text-sm text-center py-6">No hay plantillas. Crea una o carga las defaults.</p>';
    return;
  }

  // Group by category
  const categories = {};
  templates.forEach(t => {
    const cat = t.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(t);
  });

  const catLabels = {
    ordenes: '<svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg> &Oacute;rdenes',
    seguimiento: '<svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Seguimiento',
    marketing: '<svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg> Marketing',
    general: '<svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> General',
  };

  let html = '';
  for (const [cat, tmpls] of Object.entries(categories)) {
    html += `
      <div class="bg-gray-900/60 rounded-xl border border-gray-800">
        <div class="px-4 py-3 border-b border-gray-800">
          <h4 class="text-sm font-semibold text-gray-300">${catLabels[cat] || cat}</h4>
        </div>
        <div class="divide-y divide-gray-800">
          ${tmpls.map(t => `
            <div class="px-4 py-3 flex items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-white">${esc(t.name)}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full ${t.active ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}">${t.active ? 'Activa' : 'Inactiva'}</span>
                  ${t.triggerEvent ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400 flex items-center gap-0.5"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Auto</span>` : ''}
                </div>
                <p class="text-xs text-gray-500 truncate mt-0.5">${esc(t.body?.substring(0, 100))}...</p>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <button onclick="waTmplPreview('${esc(t.key)}')" class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition" title="Vista previa"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                <button onclick="waTmplOpenEditor('${esc(t.key)}')" class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition" title="Editar"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button onclick="waTmplDelete('${esc(t.key)}')" class="px-2 py-1 bg-gray-800 hover:bg-red-900/40 rounded text-xs transition" title="Eliminar"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ─── Template Editor ────────────────────────

function waTmplOpenEditor(key = null) {
  const existing = key ? _waTmplState.templates.find(t => t.key === key) : null;
  _waTmplState.editingKey = key;

  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">${existing ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Editar Plantilla' : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Nueva Plantilla'}</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Clave</label>
          <input id="wa-tmpl-key" type="text" value="${esc(existing?.key || '')}" ${existing ? 'disabled' : ''} class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="ej: recepcion">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre</label>
          <input id="wa-tmpl-name" type="text" value="${esc(existing?.name || '')}" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Nombre descriptivo">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Categoría</label>
          <select id="wa-tmpl-category" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="ordenes" ${existing?.category === 'ordenes' ? 'selected' : ''}>&Oacute;rdenes</option>
            <option value="seguimiento" ${existing?.category === 'seguimiento' ? 'selected' : ''}>Seguimiento</option>
            <option value="marketing" ${existing?.category === 'marketing' ? 'selected' : ''}>Marketing</option>
            <option value="general" ${existing?.category === 'general' ? 'selected' : ''}>General</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Trigger Auto</label>
          <select id="wa-tmpl-trigger" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="" ${!existing?.triggerEvent ? 'selected' : ''}>Solo manual</option>
            <option value="ot_created" ${existing?.triggerEvent === 'ot_created' ? 'selected' : ''}>Al crear OT</option>
            <option value="ot_completed" ${existing?.triggerEvent === 'ot_completed' ? 'selected' : ''}>Al completar OT</option>
            <option value="warranty_expiring" ${existing?.triggerEvent === 'warranty_expiring' ? 'selected' : ''}>Garantía por vencer</option>
            <option value="service_reminder" ${existing?.triggerEvent === 'service_reminder' ? 'selected' : ''}>Recordatorio service</option>
            <option value="survey" ${existing?.triggerEvent === 'survey' ? 'selected' : ''}>Encuesta satisfacción</option>
          </select>
        </div>
      </div>

      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Mensaje (usa {{variable}} para insertar)</label>
        <textarea id="wa-tmpl-body" rows="6" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono" placeholder="¡Hola {{nombre_cliente}}!...">${esc(existing?.body || '')}</textarea>
        <div id="wa-tmpl-var-count" class="text-xs text-gray-600 mt-1"></div>
      </div>

      <!-- Live Preview -->
      <div class="bg-gray-800/50 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-500 uppercase tracking-wider">Vista Previa</span>
          <button onclick="waTmplRefreshPreview()" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Actualizar</button>
        </div>
        <div id="wa-tmpl-preview" class="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-3 rounded border border-gray-700 max-h-32 overflow-y-auto"></div>
      </div>

      <div class="flex gap-3">
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition">Cancelar</button>
        <button onclick="waTmplSave()" class="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
          <span id="wa-tmpl-save-text">Guardar</span>
          <svg id="wa-tmpl-save-spinner" class="hidden animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        </button>
      </div>
    </div>
  `;

  overlay.classList.remove('hidden');

  // Live update preview on body change
  const bodyField = document.getElementById('wa-tmpl-body');
  if (bodyField) {
    bodyField.addEventListener('input', waTmplRefreshPreview);
    waTmplRefreshPreview();
    waTmplUpdateVarCount();
  }
}

function waTmplRefreshPreview() {
  const body = document.getElementById('wa-tmpl-body')?.value || '';
  const previewEl = document.getElementById('wa-tmpl-preview');
  if (!previewEl) return;

  if (!body.trim()) {
    previewEl.textContent = 'Escribe un mensaje para ver la vista previa...';
    return;
  }

  // Use sample data
  const sample = {
    nombre_cliente: 'Juan Pérez',
    vehiculo: 'Toyota Hilux 2022',
    chapa: 'ABC-1234',
    orden_id: 'OT-0001',
    monto_total: '3.500.000',
    fecha_estimada: '20/06/2026',
    tecnico: 'Carlos Méndez',
    taller: 'El Chero',
    numero_factura: '001-001-0001234',
    url_encuesta: 'https://encuesta.taller.com.py/abc123',
    kilometraje: '45.000',
    garantia_hasta: '15/12/2026',
  };

  let preview = body;
  for (const [key, value] of Object.entries(sample)) {
    preview = preview.replaceAll(`{{${key}}}`, value);
  }
  // Highlight remaining unfilled variables
  preview = preview.replace(/\{\{(\w+)\}\}/g, '<span class="text-yellow-400">{{$1}}</span>');
  previewEl.innerHTML = preview;
}

function waTmplUpdateVarCount() {
  const body = document.getElementById('wa-tmpl-body')?.value || '';
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  const unique = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  const countEl = document.getElementById('wa-tmpl-var-count');
  if (countEl) {
    countEl.textContent = unique.length ? `${unique.length} variable(s): ${unique.join(', ')}` : 'Sin variables';
  }
}

function waTmplInsertVar(varName) {
  const textarea = document.getElementById('wa-tmpl-body');
  if (!textarea) return;

  const pos = textarea.selectionStart;
  const text = textarea.value;
  const insert = `{{${varName}}}`;
  textarea.value = text.substring(0, pos) + insert + text.substring(pos);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
  waTmplRefreshPreview();
  waTmplUpdateVarCount();
}

async function waTmplSave() {
  const key = document.getElementById('wa-tmpl-key')?.value?.trim();
  const name = document.getElementById('wa-tmpl-name')?.value?.trim();
  const body = document.getElementById('wa-tmpl-body')?.value?.trim();
  const category = document.getElementById('wa-tmpl-category')?.value;
  const triggerEvent = document.getElementById('wa-tmpl-trigger')?.value || null;

  if (!key || !name || !body) {
    if (typeof showToast === 'function') showToast('Clave, nombre y mensaje son obligatorios', 'warning');
    return;
  }

  const spinner = document.getElementById('wa-tmpl-save-spinner');
  const text = document.getElementById('wa-tmpl-save-text');
  if (spinner) spinner.classList.remove('hidden');
  if (text) text.textContent = 'Guardando...';

  try {
    await api('/whatsapp/templates', {
      method: 'POST',
      body: { key, name, body, category, triggerEvent },
    });

    document.getElementById('modal-overlay')?.classList.add('hidden');
    await waTmplLoadList();
    if (typeof showToast === 'function') showToast('Plantilla guardada correctamente', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (spinner) spinner.classList.add('hidden');
    if (text) text.textContent = 'Guardar';
  }
}

// ─── Preview / Delete ───────────────────────

async function waTmplPreview(key) {
  const tmpl = _waTmplState.templates.find(t => t.key === key);
  if (!tmpl) return;

  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  // Build preview with sample data
  const sample = {
    nombre_cliente: 'Juan Pérez', vehiculo: 'Toyota Hilux 2022', chapa: 'ABC-1234',
    orden_id: 'OT-0001', monto_total: '3.500.000', fecha_estimada: '20/06/2026',
    tecnico: 'Carlos Méndez', numero_factura: '001-001-0001234',
    url_encuesta: 'https://encuesta.taller.com.py/abc123', garantia_hasta: '15/12/2026',
    kilometraje: '45.000', fecha_servicio: '15/03/2026',
  };
  let preview = tmpl.body;
  for (const [k, v] of Object.entries(sample)) {
    preview = preview.replaceAll(`{{${k}}}`, v);
  }

  content.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Vista Previa</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-xs text-gray-500 mb-1">Plantilla: <span class="text-gray-300">${esc(tmpl.name)}</span></p>
        <p class="text-xs text-gray-500 mb-2">Clave: <code class="text-blue-400">${esc(tmpl.key)}</code> · Categoría: ${esc(tmpl.category)}</p>
      </div>
      <div class="bg-gray-900/80 rounded-lg p-4 border border-gray-700">
        <p class="text-sm text-gray-300 whitespace-pre-wrap">${esc(preview)}</p>
      </div>
      <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition">Cerrar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
}

async function waTmplDelete(key) {
  if (!confirm(`¿Eliminar plantilla "${key}"?`)) return;
  try {
    await api(`/whatsapp/templates/${key}`, { method: 'DELETE' });
    await waTmplLoadList();
    if (typeof showToast === 'function') showToast('Plantilla eliminada correctamente', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
  }
}

async function waTmplSeedDefaults() {
  try {
    const result = await api('/whatsapp/templates/seed', { method: 'POST' });
    if (typeof showToast === 'function') showToast(result.message || 'Plantillas creadas', 'success');
    await waTmplLoadList();
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
  }
}

// ─── Follow-up Stats ───────────────────────

function waTmplRenderFollowupStats() {
  const stats = _waTmplState.stats;
  const container = document.getElementById('wa-followup-stats');
  const grid = document.getElementById('wa-followup-stats-grid');
  if (!stats || !container || !grid) return;

  container.classList.remove('hidden');
  grid.innerHTML = `
    <div class="bg-gray-800/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-white">${stats.total}</div>
      <div class="text-xs text-gray-500">Total</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-yellow-400">${stats.scheduled}</div>
      <div class="text-xs text-gray-500">Pendientes</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-green-400">${stats.sent}</div>
      <div class="text-xs text-gray-500">Enviados</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-red-400">${stats.failed}</div>
      <div class="text-xs text-gray-500">Fallidos</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-gray-400">${stats.cancelled}</div>
      <div class="text-xs text-gray-500">Cancelados</div>
    </div>
  `;
}

function waTmplRenderFollowupList() {
  const container = document.getElementById('wa-followup-list');
  const items = document.getElementById('wa-followup-items');
  if (!container || !items) return;

  const followups = _waTmplState.followups;
  if (!followups.length) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const statusColors = {
    SCHEDULED: 'text-yellow-400',
    SENT: 'text-green-400',
    FAILED: 'text-red-400',
    CANCELLED: 'text-gray-500',
  };

  items.innerHTML = followups.map(f => `
    <div class="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-white">${esc(f.templateKey)}</span>
          <span class="text-[10px] ${statusColors[f.status] || 'text-gray-500'}">${f.status}</span>
          ${f.ordenId ? `<span class="text-[10px] text-gray-600">OT: ${esc(f.ordenId.substring(0, 8))}</span>` : ''}
        </div>
        <p class="text-xs text-gray-500 truncate">${esc(f.phone)} · ${esc(f.filledBody?.substring(0, 60))}...</p>
      </div>
      <div class="text-xs text-gray-600 flex-shrink-0">
        ${f.scheduledAt ? new Date(f.scheduledAt).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
      </div>
      ${f.status === 'SCHEDULED' ? `
        <button onclick="waTmplCancelFollowup('${f.id}')" class="px-2 py-1 bg-gray-800 hover:bg-red-900/40 rounded text-xs transition">✕</button>
      ` : ''}
    </div>
  `).join('');
}

async function waTmplCancelFollowup(id) {
  try {
    await api(`/whatsapp/followups/${id}/cancel`, { method: 'POST' });
    await waTmplLoadFollowups();
    if (typeof showToast === 'function') showToast('Seguimiento cancelado', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
  }
}

// ─── Exports ────────────────────────────────

window.renderWhatsAppTemplates = renderWhatsAppTemplates;
window.waTmplOpenEditor = waTmplOpenEditor;
window.waTmplPreview = waTmplPreview;
window.waTmplDelete = waTmplDelete;
window.waTmplSave = waTmplSave;
window.waTmplSeedDefaults = waTmplSeedDefaults;
window.waTmplInsertVar = waTmplInsertVar;
window.waTmplRefreshPreview = waTmplRefreshPreview;
window.waTmplCancelFollowup = waTmplCancelFollowup;
