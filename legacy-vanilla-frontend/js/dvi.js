/**
 * DVI — Digital Vehicle Inspection Module (Enhanced).
 *
 * Frontend module for:
 *   - Photo capture/upload with Supabase Storage
 *   - Photo thumbnails with delete
 *   - Canvas markup overlay (circle, arrow, text, freehand)
 *   - Inspection checklist
 *   - Health score calculation
 *   - WhatsApp sharing
 *
 * @module js/dvi
 */

/* global api, esc, authHeaders */

// ─── State ──────────────────────────────────
let _dviState = {
  currentTool: 'circle',
  currentImage: null,
  markupData: [],
  canvas: null,
  ctx: null,
  isDrawing: false,
  startX: 0,
  startY: 0,
  ordenId: null,
  dviId: null,
  inspectionId: null,
  photos: [],
  items: [],
};

// C-08 FIX: Auto-save state — persists DVI work to localStorage every 30 seconds
let _dviAutoSaveTimer = null;

// ─── DVI View ───────────────────────────────

function renderDVI(container) {
  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">DVI — Inspección Digital</h3>
          <p class="text-xs text-gray-500">Fotos, markup, checklist y health score</p>
        </div>
        <div class="flex gap-2">
          <button onclick="dviShareWhatsApp()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg> WhatsApp</button>
        </div>
      </div>

      <!-- Orden Selector -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-2">Orden de Trabajo</label>
        <div class="flex gap-2">
          <select id="dvi-orden" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">Seleccionar orden...</option>
          </select>
          <button onclick="dviLoadChecklist()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> Cargar</button>
        </div>
      </div>

      <!-- Photo Upload -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Fotos</label>
          <span id="dvi-photo-count" class="text-xs text-gray-600">0 fotos</span>
        </div>
        <div id="dvi-photo-grid" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"></div>
        <div id="dvi-upload-zone" class="block w-full border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition">
          <input type="file" accept="image/*" capture="environment" class="hidden" id="dvi-file-input" onchange="dviHandlePhotoUpload(event)">
          <span class="text-gray-500 text-sm">Tomar foto o seleccionar imagen</span>
          <p class="text-xs text-gray-600 mt-1">Máx 10MB · JPG, PNG, WebP</p>
        </div>
        <!-- Upload Progress -->
        <div id="dvi-upload-progress" class="hidden mt-3">
          <div class="flex items-center gap-3">
            <div class="flex-1 bg-gray-800 rounded-full h-2">
              <div id="dvi-upload-bar" class="bg-blue-500 h-2 rounded-full transition-all" style="width: 0%"></div>
            </div>
            <span id="dvi-upload-status" class="text-xs text-gray-400">Subiendo...</span>
          </div>
        </div>
      </div>

      <!-- Markup Tools -->
      <div id="dvi-markup-tools" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 hidden">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs text-gray-500 uppercase tracking-wider">Herramientas de Markup</span>
          <button onclick="dviClearMarkup()" class="ml-auto px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/40 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Limpiar</button>
        </div>
        <div class="flex gap-2">
          <button onclick="dviSetTool('circle')" class="dvi-tool-btn tool-active px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg> C&iacute;rculo</button>
          <button onclick="dviSetTool('arrow')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg> Flecha</button>
          <button onclick="dviSetTool('text')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> Texto</button>
          <button onclick="dviSetTool('freehand')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> Libre</button>
        </div>
        <!-- Canvas Markup Overlay -->
        <div id="dvi-canvas-container" class="relative mt-3 hidden">
          <img id="dvi-markup-image" class="w-full rounded-lg" alt="DVI">
          <canvas id="dvi-markup-canvas" class="absolute top-0 left-0 w-full h-full rounded-lg cursor-crosshair" style="touch-action:none;"></canvas>
        </div>
      </div>

      <!-- Checklist -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <h4 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> Checklist de Inspecci&oacute;n</h4>
        <div id="dvi-checklist" class="space-y-2">
          <p class="text-gray-500 text-sm">Seleccione una orden para cargar el checklist.</p>
        </div>
      </div>

      <!-- Health Score -->
      <div class="bg-gray-900/60 rounded-xl p-6 border border-gray-800 text-center">
        <h4 class="text-sm font-semibold text-gray-300 mb-2">Health Score</h4>
        <div id="dvi-health-score" class="text-5xl font-bold text-gray-600">—</div>
        <div id="dvi-health-label" class="text-xs text-gray-500 mt-1"></div>
      </div>
    </div>
  `;

  // Make upload zone clickable
  document.getElementById('dvi-upload-zone')?.addEventListener('click', () => {
    document.getElementById('dvi-file-input')?.click();
  });

  // Load OTs for selector
  _dviLoadOrdenes();

  // C-08: Restore auto-saved state from localStorage (if any)
  _dviRestoreAutoSave();
}

async function _dviLoadOrdenes() {
  try {
    const data = await api('/workshop/ordenes');
    const select = document.getElementById('dvi-orden');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar orden...</option>';
    (data || []).forEach(o => {
      select.innerHTML += `<option value="${esc(o.id)}">${esc(o.numero || o.id)} — ${esc(o.clienteNombre || '')}</option>`;
    });
  } catch (err) {
    console.error('[DVI] Error loading ordenes:', err);
  }
}

async function dviLoadChecklist() {
  const select = document.getElementById('dvi-orden');
  if (!select?.value) return;
  _dviState.ordenId = select.value;

  // C-08: Start auto-save interval when a DVI is loaded
  _dviStartAutoSave();

  // Create DVI inspection via API
  try {
    const result = await api('/dvi', {
      method: 'POST',
      body: { ordenTrabajoId: _dviState.ordenId },
    });
    _dviState.inspectionId = result?.id;
    console.log('[DVI] Inspection created:', _dviState.inspectionId);
  } catch (err) {
    console.error('[DVI] Error creating inspection:', err);
  }

  // Load existing photos
  await _dviLoadPhotos();

  // Show default checklist
  const checklist = document.getElementById('dvi-checklist');
  const defaultItems = [
    { nombre: 'Motor', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Frenos', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Suspensión', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Neumáticos', estado: 'ok', categoria: 'exterior' },
    { nombre: 'Luces', estado: 'ok', categoria: 'electrico' },
    { nombre: 'Aire Acondicionado', estado: 'ok', categoria: 'confort' },
    { nombre: 'Interior', estado: 'ok', categoria: 'interior' },
    { nombre: 'Exterior', estado: 'ok', categoria: 'exterior' },
    { nombre: 'Transmisión', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Dirección', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Correas', estado: 'ok', categoria: 'mecanico' },
    { nombre: 'Refrigeración', estado: 'ok', categoria: 'mecanico' },
  ];

  checklist.innerHTML = defaultItems.map((item, i) => `
    <div class="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg" data-index="${i}">
      <span class="text-sm text-gray-300 flex-1">${esc(item.nombre)}</span>
      <select onchange="dviUpdateItemStatus(${i}, this.value)" class="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
        <option value="ok">OK</option>
        <option value="atencion">Atenci&oacute;n</option>
        <option value="critico">Cr&iacute;tico</option>
        <option value="na">N/A</option>
      </select>
    </div>
  `).join('');

  _dviState.items = defaultItems;
  _dviUpdateHealthScore();
}

function dviUpdateItemStatus(index, status) {
  if (_dviState.items[index]) {
    _dviState.items[index].estado = status;
    _dviUpdateHealthScore();
  }
}

function _dviUpdateHealthScore() {
  const items = _dviState.items;
  if (!items.length) return;

  const critico = items.filter(i => i.estado === 'critico').length;
  const atencion = items.filter(i => i.estado === 'atencion').length;
  const total = items.filter(i => i.estado !== 'na').length;

  if (total === 0) return;

  const score = Math.max(0, Math.min(100, Math.round(100 - (critico * 20 + atencion * 10) / total * 10)));

  const scoreEl = document.getElementById('dvi-health-score');
  const labelEl = document.getElementById('dvi-health-label');
  if (!scoreEl || !labelEl) return;

  scoreEl.textContent = score;
  scoreEl.className = `text-5xl font-bold ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'}`;

  const labels = { 100: 'Excelente', 80: 'Bueno', 60: 'Regular', 0: 'Necesita atención' };
  const key = score >= 100 ? 100 : score >= 80 ? 80 : score >= 60 ? 60 : 0;
  labelEl.textContent = labels[key];
}

// ─── Photo Upload (Supabase Storage) ─────────

async function dviHandlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file || !_dviState.inspectionId) return;

  // Validate
  if (file.size > 10 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('El archivo excede 10MB', 'warning');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!allowedTypes.includes(file.type)) {
    if (typeof showToast === 'function') showToast('Tipo de archivo no permitido. Use JPG, PNG o WebP.', 'warning');
    return;
  }

  // Show progress
  const progressEl = document.getElementById('dvi-upload-progress');
  const barEl = document.getElementById('dvi-upload-bar');
  const statusEl = document.getElementById('dvi-upload-status');
  progressEl?.classList.remove('hidden');
  if (barEl) barEl.style.width = '30%';
  if (statusEl) statusEl.textContent = 'Subiendo...';

  try {
    // Upload via API
    const formData = new FormData();
    formData.append('photo', file);

    const result = await fetch(`/dvi/${_dviState.inspectionId}/photos`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
      },
      body: formData,
    }).then(r => r.json());

    if (barEl) barEl.style.width = '100%';
    if (statusEl) statusEl.textContent = '¡Listo!';

    // Add to local state
    _dviState.photos.push({
      id: result.id,
      url: result.url,
      path: result.path,
      markup: [],
    });

    _dviAddPhotoToGrid(result.url, _dviState.photos.length - 1, result.id);
    _dviUpdatePhotoCount();

    // Hide progress after delay
    setTimeout(() => {
      progressEl?.classList.add('hidden');
      if (barEl) barEl.style.width = '0%';
    }, 1500);

  } catch (err) {
    console.error('[DVI] Upload error:', err);
    if (statusEl) statusEl.textContent = 'Error al subir';
    if (barEl) barEl.style.width = '0%';
  }

  // Reset file input
  event.target.value = '';
}

async function _dviLoadPhotos() {
  if (!_dviState.inspectionId) return;

  try {
    const photos = await api(`/dvi/${_dviState.inspectionId}/photos`);
    const grid = document.getElementById('dvi-photo-grid');
    if (!grid) return;
    grid.innerHTML = '';
    _dviState.photos = [];

    (photos || []).forEach((photo, i) => {
      _dviState.photos.push({
        id: photo.name.split('.')[0],
        url: photo.path,
        path: photo.path,
        markup: [],
      });
      _dviAddPhotoToGrid(photo.path, i, photo.name.split('.')[0]);
    });

    _dviUpdatePhotoCount();
  } catch (err) {
    console.error('[DVI] Error loading photos:', err);
  }
}

function _dviAddPhotoToGrid(url, index, photoId) {
  const grid = document.getElementById('dvi-photo-grid');
  if (!grid) return;

  const div = document.createElement('div');
  div.className = 'relative group';
  div.id = `dvi-photo-${photoId}`;
  div.innerHTML = `
    <img src="${esc(url)}" class="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition" onclick="dviShowMarkupEditor('${esc(url)}', ${index})" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23374151%22 width=%22100%22 height=%22100%22/><path d=%22M50 30c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 35c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z%22 fill=%22%239CA3AF%22/><path d=%22M35 20l-5 10H20c-2.2 0-4 1.8-4 4v36c0 2.2 1.8 4 4 4h60c2.2 0 4-1.8 4-4V34c0-2.2-1.8-4-4-4H70l-5-10H35z%22 fill=%22%239CA3AF%22/></svg>'">
    <button onclick="dviDeletePhoto('${esc(photoId)}', ${index})" class="absolute top-1 right-1 bg-red-600 w-5 h-5 rounded-full text-xs hidden group-hover:flex items-center justify-center"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    <div class="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-gray-300 hidden group-hover:block">${index + 1}</div>
  `;
  grid.appendChild(div);
}

async function dviDeletePhoto(photoId, index) {
  if (!confirm('¿Eliminar esta foto?')) return;

  try {
    await fetch(`/dvi/${_dviState.inspectionId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    _dviState.photos.splice(index, 1);
    const el = document.getElementById(`dvi-photo-${photoId}`);
    if (el) el.remove();
    _dviUpdatePhotoCount();
    if (typeof showToast === 'function') showToast('Foto eliminada', 'success');
  } catch (err) {
    console.error('[DVI] Delete error:', err);
  }
}

function _dviUpdatePhotoCount() {
  const countEl = document.getElementById('dvi-photo-count');
  if (countEl) countEl.textContent = `${_dviState.photos.length} foto${_dviState.photos.length !== 1 ? 's' : ''}`;
}

// ─── Markup Editor ──────────────────────────

function dviShowMarkupEditor(url, index) {
  _dviState.currentImage = index;
  const container = document.getElementById('dvi-canvas-container');
  const toolsPanel = document.getElementById('dvi-markup-tools');
  const img = document.getElementById('dvi-markup-image');
  const canvas = document.getElementById('dvi-markup-canvas');

  if (!container || !img || !canvas) return;

  toolsPanel.classList.remove('hidden');
  container.classList.remove('hidden');

  _dviState.canvas = canvas;
  _dviState.ctx = canvas.getContext('2d');
  _dviState.markupData = _dviState.photos[index]?.markup || [];

  img.src = url;
  img.onload = () => {
    canvas.width = img.offsetWidth;
    canvas.height = img.offsetHeight;
    _dviRedrawMarkup();
  };

  // Canvas events
  canvas.onmousedown = (e) => _dviCanvasMouseDown(e);
  canvas.onmousemove = (e) => _dviCanvasMouseMove(e);
  canvas.onmouseup = (e) => _dviCanvasMouseUp(e);

  // Initialize touch gestures for mobile
  if (typeof initDVITouchGestures === 'function') {
    initDVITouchGestures();
  }
  canvas.ontouchmove = (e) => { e.preventDefault(); _dviCanvasMouseMove(e.touches[0]); };
  canvas.ontouchend = (e) => { e.preventDefault(); _dviCanvasMouseUp(e.changedTouches[0]); };
}

function _dviCanvasMouseDown(e) {
  _dviState.isDrawing = true;
  const rect = _dviState.canvas.getBoundingClientRect();
  _dviState.startX = e.clientX - rect.left;
  _dviState.startY = e.clientY - rect.top;
}

function _dviCanvasMouseMove(e) {
  if (!_dviState.isDrawing || !_dviState.ctx) return;
  const rect = _dviState.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  _dviRedrawMarkup();
  _dviState.ctx.strokeStyle = '#ef4444';
  _dviState.ctx.lineWidth = 3;

  if (_dviState.currentTool === 'circle') {
    const radius = Math.sqrt(Math.pow(x - _dviState.startX, 2) + Math.pow(y - _dviState.startY, 2));
    _dviState.ctx.beginPath();
    _dviState.ctx.arc(_dviState.startX, _dviState.startY, radius, 0, 2 * Math.PI);
    _dviState.ctx.stroke();
  } else if (_dviState.currentTool === 'arrow') {
    _dviState.ctx.beginPath();
    _dviState.ctx.moveTo(_dviState.startX, _dviState.startY);
    _dviState.ctx.lineTo(x, y);
    _dviState.ctx.stroke();
  } else if (_dviState.currentTool === 'freehand') {
    _dviState.ctx.lineTo(x, y);
    _dviState.ctx.stroke();
  }
}

function _dviCanvasMouseUp(e) {
  if (!_dviState.isDrawing) return;
  _dviState.isDrawing = false;

  const rect = _dviState.canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  _dviState.markupData.push({
    tool: _dviState.currentTool,
    startX: _dviState.startX,
    startY: _dviState.startY,
    endX, endY,
  });

  // Save markup to photo
  if (_dviState.photos[_dviState.currentImage]) {
    _dviState.photos[_dviState.currentImage].markup = [..._dviState.markupData];
  }

  _dviRedrawMarkup();
}

function _dviRedrawMarkup() {
  const ctx = _dviState.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, _dviState.canvas.width, _dviState.canvas.height);

  for (const item of _dviState.markupData) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;

    if (item.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(item.endX - item.startX, 2) + Math.pow(item.endY - item.startY, 2));
      ctx.beginPath();
      ctx.arc(item.startX, item.startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (item.tool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(item.startX, item.startY);
      ctx.lineTo(item.endX, item.endY);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(item.endY - item.startY, item.endX - item.startX);
      ctx.beginPath();
      ctx.moveTo(item.endX, item.endY);
      ctx.lineTo(item.endX - 10 * Math.cos(angle - Math.PI / 6), item.endY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(item.endX, item.endY);
      ctx.lineTo(item.endX - 10 * Math.cos(angle + Math.PI / 6), item.endY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (item.tool === 'freehand') {
      ctx.beginPath();
      ctx.moveTo(item.startX, item.startY);
      ctx.lineTo(item.endX, item.endY);
      ctx.stroke();
    } else if (item.tool === 'text') {
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Anotación', item.startX, item.startY);
    }
  }
}

function dviSetTool(tool) {
  _dviState.currentTool = tool;
  document.querySelectorAll('.dvi-tool-btn').forEach(b => b.classList.remove('tool-active'));
  event.target.classList.add('tool-active');
}

function dviClearMarkup() {
  _dviState.markupData = [];
  if (_dviState.photos[_dviState.currentImage]) {
    _dviState.photos[_dviState.currentImage].markup = [];
  }
  _dviRedrawMarkup();
}

// ─── C-08: Auto-Save (localStorage) ──────────

/**
 * Starts the auto-save timer — saves DVI state to localStorage every 30s.
 * Also registers beforeunload as a safety net.
 */
function _dviStartAutoSave() {
  _dviStopAutoSave(); // Clear any existing timer
  _dviAutoSaveTimer = setInterval(() => {
    _dviPersistAutoSave();
  }, 30000); // 30 seconds

  // C-09 FIX: beforeunload safety net — persist state on tab close
  window.addEventListener('beforeunload', _dviBeforeUnloadHandler);
}

/**
 * Stops the auto-save timer and removes beforeunload handler.
 */
function _dviStopAutoSave() {
  if (_dviAutoSaveTimer) {
    clearInterval(_dviAutoSaveTimer);
    _dviAutoSaveTimer = null;
  }
  window.removeEventListener('beforeunload', _dviBeforeUnloadHandler);
}

/**
 * Persists current DVI state to localStorage.
 */
function _dviPersistAutoSave() {
  if (!_dviState.inspectionId) return;
  try {
    const saveData = {
      inspectionId: _dviState.inspectionId,
      ordenId: _dviState.ordenId,
      items: _dviState.items,
      photos: _dviState.photos.map(p => ({ id: p.id, markup: p.markup })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('dvi-autosave-' + _dviState.inspectionId, JSON.stringify(saveData));
  } catch (err) {
    console.warn('[DVI] Auto-save failed:', err);
  }
}

/**
 * Restores DVI state from localStorage (if available and recent).
 */
function _dviRestoreAutoSave() {
  // Check all dvi-autosave-* keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('dvi-autosave-')) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data || !data.savedAt) continue;
      // Only restore if saved within last 2 hours
      const age = Date.now() - new Date(data.savedAt).getTime();
      if (age > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        continue;
      }
      // Restore state if inspection matches
      if (data.inspectionId) {
        _dviState.inspectionId = data.inspectionId;
        _dviState.ordenId = data.ordenId;
        if (data.items) _dviState.items = data.items;
        if (data.photos) {
          _dviState.photos = data.photos;
          console.log('[DVI] Restored auto-saved state from', data.savedAt);
        }
      }
    } catch {
      // Corrupt data — remove
      localStorage.removeItem(key);
    }
  }
}

/**
 * beforeunload handler — persist state immediately on tab close.
 */
function _dviBeforeUnloadHandler() {
  _dviPersistAutoSave();
}

/**
 * Clears auto-save from localStorage (call after successful server save).
 */
function _dviClearAutoSave() {
  if (_dviState.inspectionId) {
    localStorage.removeItem('dvi-autosave-' + _dviState.inspectionId);
  }
}

// ─── WhatsApp Share ─────────────────────────

function dviShareWhatsApp() {
  const score = document.getElementById('dvi-health-score')?.textContent || '—';
  const text = `📊 *DVI — Inspección de Vehículo*\nHealth Score: ${score}/100\n\nFotos: ${_dviState.photos.length}\nItems: ${_dviState.items.length}\n\nAdjunto fotos e inspección detallada.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
