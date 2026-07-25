/* ═══════════════════════════════════════════════════════════════════
   P3.3 — DVI Comparación Before/After
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderDVIComparison(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">DVI — Comparación Before/After</h2>
      <p class="text-sm text-gray-500">Compará fotos de inspección antes y después del servicio</p>
    </div>

    <!-- Inspection Selector -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">ID Inspección DVI</label>
          <input id="dvi-comp-id" placeholder="UUID de la inspección" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        </div>
        <div class="flex items-end gap-2">
          <button onclick="loadDVIPhotos()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Cargar Fotos</button>
        </div>
      </div>
    </div>

    <!-- Upload Section -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Subir Nueva Foto</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Tipo</label>
          <select id="dvi-photo-type" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="BEFORE">Before (antes)</option>
            <option value="AFTER">After (después)</option>
            <option value="DURING">During (durante)</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Zona del vehículo</label>
          <select id="dvi-photo-zone" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="general">General</option>
            <option value="motor">Motor</option>
            <option value="interior">Interior</option>
            <option value="exterior">Exterior</option>
            <option value="chasis">Chasis</option>
            <option value="ruedas">Ruedas/Frenos</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Foto</label>
          <input id="dvi-photo-file" type="file" accept="image/*" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-sm file:cursor-pointer">
        </div>
      </div>
      <button onclick="uploadDVIPhoto()" class="mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">Subir Foto</button>
    </div>

    <!-- Comparison View -->
    <div id="dvi-comparison" class="hidden">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Comparación Visual</h3>
      <div id="dvi-comparison-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    </div>

    <!-- All Photos -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mt-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Todas las Fotos</h3>
      <div id="dvi-all-photos" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div class="text-center py-8 text-gray-600 text-sm col-span-full">Cargá una inspección para ver fotos</div>
      </div>
    </div>`;
}

async function loadDVIPhotos() {
  const inspectionId = document.getElementById('dvi-comp-id')?.value?.trim();
  if (!inspectionId) { showToast('Ingresá el ID de la inspección', 'error'); return; }

  const data = await api(`/dvi/${inspectionId}/photos`).catch(() => null);
  const photos = data?.data || data || [];

  // Load signed URLs for each photo
  const photosWithUrls = await Promise.all(
    (Array.isArray(photos) ? photos : []).map(async (p) => {
      try {
        const urlData = await api(`/dvi/${inspectionId}/photos/${p.id}`);
        return { ...p, url: urlData?.url };
      } catch { return { ...p, url: null }; }
    })
  );

  renderPhotoGrid(photosWithUrls);
  renderComparison(photosWithUrls);
}

function renderPhotoGrid(photos) {
  const el = document.getElementById('dvi-all-photos');
  if (!photos.length) {
    el.innerHTML = '<div class="text-center py-8 text-gray-600 text-sm col-span-full">Sin fotos para esta inspección</div>';
    return;
  }

  const typeColors = { BEFORE: 'border-yellow-500', AFTER: 'border-green-500', DURING: 'border-blue-500' };
  const typeLabels = { BEFORE: 'Before', AFTER: 'After', DURING: 'During' };

  el.innerHTML = photos.map(p => `
    <div class="relative group rounded-lg overflow-hidden border-2 ${typeColors[p.tipo || p.type] || 'border-gray-700'}">
      ${p.url ? `<img src="${p.url}" alt="${esc(p.descripcion || '')}" class="w-full h-32 object-cover">` : `<div class="w-full h-32 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">Sin vista previa</div>`}
      <div class="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
        <span class="text-xs font-medium ${p.tipo === 'BEFORE' || p.type === 'BEFORE' ? 'text-yellow-400' : p.tipo === 'AFTER' || p.type === 'AFTER' ? 'text-green-400' : 'text-blue-400'}">${typeLabels[p.tipo || p.type] || '—'}</span>
        <span class="text-xs text-gray-500 ml-2">${esc(p.zona || p.descripcion || '')}</span>
      </div>
      <button onclick="deleteDVIPhoto('${p.id}')" class="absolute top-1 right-1 w-6 h-6 bg-red-600/80 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
    </div>`).join('');
}

function renderComparison(photos) {
  const compEl = document.getElementById('dvi-comparison');
  const gridEl = document.getElementById('dvi-comparison-grid');

  const befores = photos.filter(p => (p.tipo || p.type) === 'BEFORE');
  const afters = photos.filter(p => (p.tipo || p.type) === 'AFTER');

  if (!befores.length || !afters.length) {
    compEl.classList.add('hidden');
    return;
  }

  compEl.classList.remove('hidden');
  const maxPairs = Math.min(befores.length, afters.length, 4);

  gridEl.innerHTML = Array.from({ length: maxPairs }, (_, i) => `
    <div class="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
      <div class="grid grid-cols-2 gap-2">
        <div class="text-center">
          <p class="text-xs text-yellow-400 font-medium mb-1">ANTES</p>
          ${befores[i].url ? `<img src="${befores[i].url}" class="w-full h-40 object-cover rounded-lg">` : `<div class="w-full h-40 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">Sin foto</div>`}
        </div>
        <div class="text-center">
          <p class="text-xs text-green-400 font-medium mb-1">DESPUÉS</p>
          ${afters[i].url ? `<img src="${afters[i].url}" class="w-full h-40 object-cover rounded-lg">` : `<div class="w-full h-40 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">Sin foto</div>`}
        </div>
      </div>
      <p class="text-xs text-gray-500 text-center mt-2">${esc(befores[i].zona || befores[i].descripcion || '')}</p>
    </div>`).join('');
}

async function uploadDVIPhoto() {
  const inspectionId = document.getElementById('dvi-comp-id')?.value?.trim();
  const file = document.getElementById('dvi-photo-file')?.files?.[0];
  if (!inspectionId) { showToast('Ingresá el ID de la inspección', 'error'); return; }
  if (!file) { showToast('Seleccioná una foto', 'error'); return; }

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('tipo', document.getElementById('dvi-photo-type')?.value || 'BEFORE');
  formData.append('zona', document.getElementById('dvi-photo-zone')?.value || 'general');

  try {
    await fetch(`/dvi/${inspectionId}/photos`, { method: 'POST', body: formData, headers: { 'X-Tenant-Slug': window.state?.auth?.tenant || '' } });
    showToast('Foto subida');
    loadDVIPhotos();
  } catch (e) { showToast('Error al subir foto', 'error'); }
}

async function deleteDVIPhoto(photoId) {
  const inspectionId = document.getElementById('dvi-comp-id')?.value?.trim();
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/dvi/${inspectionId}/photos/${photoId}`, { method: 'DELETE' });
    showToast('Foto eliminada');
    loadDVIPhotos();
  } catch (e) { showToast('Error al eliminar', 'error'); }
}
