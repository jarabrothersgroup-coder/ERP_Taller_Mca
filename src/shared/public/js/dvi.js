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

/* global api, esc */

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
          <button onclick="dviShareWhatsApp()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">📤 WhatsApp</button>
        </div>
      </div>

      <!-- Orden Selector -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-2">Orden de Trabajo</label>
        <div class="flex gap-2">
          <select id="dvi-orden" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">Seleccionar orden...</option>
          </select>
          <button onclick="dviLoadChecklist()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">📋 Cargar</button>
        </div>
      </div>

      <!-- Photo Upload -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-gray-500 uppercase tracking-wider">📸 Fotos</label>
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
          <button onclick="dviClearMarkup()" class="ml-auto px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/40 transition">🗑️ Limpiar</button>
        </div>
        <div class="flex gap-2">
          <button onclick="dviSetTool('circle')" class="dvi-tool-btn tool-active px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition">⭕ Círculo</button>
          <button onclick="dviSetTool('arrow')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition">➡️ Flecha</button>
          <button onclick="dviSetTool('text')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition">📝 Texto</button>
          <button onclick="dviSetTool('freehand')" class="dvi-tool-btn px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 transition">✏️ Libre</button>
        </div>
        <!-- Canvas Markup Overlay -->
        <div id="dvi-canvas-container" class="relative mt-3 hidden">
          <img id="dvi-markup-image" class="w-full rounded-lg" alt="DVI">
          <canvas id="dvi-markup-canvas" class="absolute top-0 left-0 w-full h-full rounded-lg cursor-crosshair" style="touch-action:none;"></canvas>
        </div>
      </div>

      <!-- Checklist -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <h4 class="text-sm font-semibold text-gray-300 mb-3">📋 Checklist de Inspección</h4>
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
        <option value="ok">✅ OK</option>
        <option value="atencion">⚠️ Atención</option>
        <option value="critico">🔴 Crítico</option>
        <option value="na">⬜ N/A</option>
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
    alert('El archivo excede 10MB');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de archivo no permitido. Use JPG, PNG o WebP.');
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
        'X-Tenant-Slug': window.state?.auth?.slug || '',
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
    <img src="${esc(url)}" class="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition" onclick="dviShowMarkupEditor('${esc(url)}', ${index})" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23374151%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%239CA3AF%22 font-size=%2214%22>📷</text></svg>'">
    <button onclick="dviDeletePhoto('${esc(photoId)}', ${index})" class="absolute top-1 right-1 bg-red-600 w-5 h-5 rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>
    <div class="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-gray-300 hidden group-hover:block">${index + 1}</div>
  `;
  grid.appendChild(div);
}

async function dviDeletePhoto(photoId, index) {
  if (!confirm('¿Eliminar esta foto?')) return;

  try {
    await fetch(`/dvi/${_dviState.inspectionId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-Slug': window.state?.auth?.slug || '' },
    });

    _dviState.photos.splice(index, 1);
    const el = document.getElementById(`dvi-photo-${photoId}`);
    if (el) el.remove();
    _dviUpdatePhotoCount();
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

// ─── WhatsApp Share ─────────────────────────

function dviShareWhatsApp() {
  const score = document.getElementById('dvi-health-score')?.textContent || '—';
  const text = `📊 *DVI — Inspección de Vehículo*\nHealth Score: ${score}/100\n\nFotos: ${_dviState.photos.length}\nItems: ${_dviState.items.length}\n\nAdjunto fotos e inspección detallada.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
