function renderIngreso(container) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto">
      <div class="bg-gray-900/60 rounded-xl p-6 border border-gray-800 card-glow">
        <h3 class="text-base font-semibold text-gray-300 mb-5">Formulario de Ingreso</h3>
        <form id="ingreso-form" class="space-y-5" novalidate>
          <!-- Cliente -->
          <div class="form-group">
            <label for="ingreso-cliente" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Cliente</label>
            <div class="flex gap-2">
              <select id="ingreso-cliente" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-describedby="ingreso-cliente-error" required>
                <option value="">Seleccionar cliente...</option>
              </select>
              <button type="button" id="ingreso-add-cliente" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors" title="Nuevo cliente" aria-label="Nuevo cliente">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
            <p id="ingreso-cliente-error" class="text-xs mt-1 hidden" role="alert">
              <span class="inline-flex items-center gap-1 text-red-400">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                <span id="ingreso-cliente-error-text"></span>
              </span>
            </p>
          </div>
          <!-- Vehículo -->
          <div class="form-group">
            <label for="ingreso-vehiculo" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Vehículo</label>
            <div class="grid grid-cols-2 gap-3">
              <select id="ingreso-vehiculo" class="px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-describedby="ingreso-vehiculo-error" required>
                <option value="">Seleccionar vehículo...</option>
              </select>
              <div class="flex gap-2">
                <input id="ingreso-vin" type="text" placeholder="VIN (opcional)" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-mono uppercase">
                <button type="button" id="decode-vin-btn" class="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors" title="Decodificar VIN (NHTSA)" aria-label="Decodificar VIN">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </button>
                <button type="button" id="scan-vin-btn" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors" title="Escanear VIN con cámara" aria-label="Escanear VIN">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
              </div>
            </div>
            <p id="ingreso-vehiculo-error" class="text-xs mt-1 hidden" role="alert">
              <span class="inline-flex items-center gap-1 text-red-400">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                <span id="ingreso-vehiculo-error-text"></span>
              </span>
            </p>
          </div>
          <!-- Check-in fields -->
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label for="ingreso-km" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Kilometraje</label>
              <input id="ingreso-km" type="number" placeholder="ej: 50000" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            </div>
            <div class="form-group">
              <label for="ingreso-fuel" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Nivel Combustible</label>
              <select id="ingreso-fuel" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                <option value="">—</option>
                <option value="Vacío">Vacío</option>
                <option value="1/4">1/4</option>
                <option value="1/2">1/2</option>
                <option value="3/4">3/4</option>
                <option value="Lleno">Lleno</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="ingreso-exterior" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Estado Exterior</label>
            <textarea id="ingreso-exterior" rows="2" placeholder="Rayones, abolladuras, observaciones..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"></textarea>
          </div>
          <!-- Orden de Trabajo -->
          <div class="border-t border-gray-800 pt-4">
            <div class="flex items-center gap-2 mb-3">
              <input id="ingreso-crear-ot" type="checkbox" class="accent-blue-500 w-4 h-4" checked>
              <label for="ingreso-crear-ot" class="text-sm text-gray-300 cursor-pointer select-none">Crear Orden de Trabajo</label>
            </div>
            <div id="ingreso-ot-fields">
              <div class="form-group">
                <label for="ingreso-desc" class="text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium">Descripción del Trabajo</label>
                <textarea id="ingreso-desc" rows="2" placeholder="Ej: Cambio de aceite y filtros, revisión de frenos..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"></textarea>
              </div>
            </div>
          </div>
          <button type="submit" id="ingreso-submit-btn" class="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="inline-flex items-center justify-center gap-2">
              <span id="ingreso-submit-text">Registrar Ingreso</span>
              <span id="ingreso-submit-spinner" class="hidden">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            </span>
          </button>
          <div id="ingreso-feedback" role="status" aria-live="polite">
            <p id="ingreso-msg" class="flex items-center gap-2 text-sm text-center hidden"></p>
          </div>
        </form>
      </div>
    </div>`;
  loadIngresoForm();
}

async function loadIngresoForm() {
  // Load clients into select
  try {
    const clients = await api('/workshop/clientes');
    const sel = document.querySelector('#ingreso-cliente');
    if (sel && clients) {
      sel.innerHTML = '<option value="">Seleccionar cliente...</option>' +
        clients.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.ruc ? ' (' + esc(c.ruc) + ')' : ''}</option>`).join('');
    }
  } catch {}
  // Load vehicles into select
  try {
    const vehicles = await api('/workshop/vehiculos');
    const sel = document.querySelector('#ingreso-vehiculo');
    if (sel && vehicles) {
      sel.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
        vehicles.map((v) => `<option value="${esc(v.id)}">${esc(v.brand)} ${esc(v.model)}${v.plate ? ' [' + esc(v.plate) + ']' : ''}</option>`).join('');
    }
  } catch {}

  // VIN decode button
  document.getElementById('decode-vin-btn')?.addEventListener('click', async () => {
    const vinInput = document.getElementById('ingreso-vin');
    const vin = (vinInput?.value || '').trim().toUpperCase();
    if (!vin || vin.length !== 17) {
      if (typeof showToast === 'function') showToast('Ingrese un VIN de 17 caracteres', 'warning');
      return;
    }
    try {
      const result = await api('/workshop/vehiculos/decode-vin', { method: 'POST', body: { vin } });
      if (result.brand || result.model || result.year) {
        const msg = `VIN decodificado: ${result.brand || '—'} ${result.model || '—'} (${result.year || '—'})`;
        if (typeof showToast === 'function') showToast(msg, 'success', 5000);
      } else {
        if (typeof showToast === 'function') showToast('VIN decodificado pero sin datos completos', 'warning');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Error al decodificar VIN: ' + e.message, 'error');
    }
  });

  // Attach client-side validation
  if (typeof attachValidation === 'function' && typeof Validators !== 'undefined') {
    attachValidation('ingreso-form', {
      'ingreso-cliente': Validators.required('Seleccione un cliente'),
      'ingreso-vehiculo': Validators.required('Seleccione un vehículo'),
    });
  }
}


