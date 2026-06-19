function renderConfig(container) {
  container.innerHTML = `
    <div class="max-w-2xl space-y-6">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Información de la Empresa</h3>
        <form id="config-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre</label>
              <input id="cfg-name" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">RUC</label>
              <input id="cfg-ruc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Dirección</label>
            <input id="cfg-address" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Teléfono</label>
              <input id="cfg-phone" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <input id="cfg-email" type="email" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
            </div>
          </div>
          <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Guardar Cambios</button>
          <p id="config-msg" class="text-sm text-green-400 hidden"></p>
        </form>
      </div>

      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Logotipo Corporativo</h3>
        <div id="logo-drop-zone" class="drop-zone border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition">
          <div id="logo-preview-wrap" class="hidden mb-4">
            <img id="logo-preview" class="w-32 h-32 mx-auto rounded-xl object-contain bg-gray-800" src="" alt="Logo">
          </div>
          <div id="logo-placeholder">
            <p class="text-4xl mb-2">🖼️</p>
            <p class="text-sm text-gray-400">Arrastra una imagen aquí o haz clic para seleccionar</p>
            <p class="text-xs text-gray-600 mt-1">PNG o JPEG · Máx 5MB</p>
          </div>
          <input id="logo-file-input" type="file" accept="image/png,image/jpeg" class="hidden">
        </div>
        <p id="logo-msg" class="text-sm mt-2 hidden"></p>
      </div>
    </div>`;
  loadConfigForm();
  setupLogoUpload();
  // WhatsApp config section (defined in whatsapp.js)
  if (typeof renderWhatsAppConfig === 'function') {
    const wrapper = container.querySelector('.max-w-2xl') || container;
    renderWhatsAppConfig(wrapper);
  }
}

async function loadConfigForm() {
  try {
    const settings = await api('/api/config/settings');
    if (settings) state.settings = settings;
    const f = (id) => $(id);
    if (f('cfg-name')) f('cfg-name').value = settings.companyName || '';
    if (f('cfg-ruc')) f('cfg-ruc').value = settings.rucOrTaxId || '';
    if (f('cfg-address')) f('cfg-address').value = settings.address || '';
    if (f('cfg-phone')) f('cfg-phone').value = settings.phone || '';
    if (f('cfg-email')) f('cfg-email').value = settings.email || '';
    loadLogoPreview();
  } catch {}
}

async function loadLogoPreview() {
  try {
    const result = await api('/api/config/logo');
    if (result && result.logoBase64 && result.logoBase64 !== 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') {
      showLogoPreview(result.logoBase64);
    }
  } catch {}
}

function showLogoPreview(dataUrl) {
  const wrap = document.querySelector('#logo-preview-wrap');
  const prev = document.querySelector('#logo-preview');
  const placeholder = document.querySelector('#logo-placeholder');
  if (wrap && prev) {
    wrap.classList.remove('hidden');
    prev.src = dataUrl;
    dom.sidebarLogo.src = dataUrl;
  }
  if (placeholder) placeholder.classList.add('hidden');
}

function setupLogoUpload() {
  const zone = document.querySelector('#logo-drop-zone');
  const input = document.querySelector('#logo-file-input');
  if (!zone || !input) return;
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files.length) handleLogoFile(input.files[0]);
  });
}

async function handleLogoFile(file) {
  if (!file.type.match(/^image\/(png|jpeg)$/)) { showLogoMsg('Solo PNG o JPEG', 'red'); return; }
  if (file.size > 5 * 1024 * 1024) { showLogoMsg('Máximo 5MB', 'red'); return; }
  showLogoMsg('Subiendo...', 'blue');
  const form = new FormData();
  form.append('file', file);
  try {
    const result = await api('/api/config/upload-logo', { method: 'POST', body: form });
    if (result && result.logoBase64) {
      showLogoPreview(result.logoBase64);
      showLogoMsg('Logo actualizado correctamente', 'green');
    }
  } catch (e) {
    showLogoMsg('Error: ' + e.message, 'red');
  }
}

function showLogoMsg(text, color) {
  const el = document.querySelector('#logo-msg');
  if (el) { el.textContent = text; el.className = `text-sm mt-2 text-${color}-400`; el.classList.remove('hidden'); }
}

