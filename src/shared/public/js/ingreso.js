function renderIngreso(container) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto">
      <div class="bg-gray-900/60 rounded-xl p-6 border border-gray-800 card-glow">
        <h3 class="text-base font-semibold text-gray-300 mb-5">Formulario de Ingreso</h3>
        <form id="ingreso-form" class="space-y-5">
          <!-- Cliente -->
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cliente</label>
            <div class="flex gap-2">
              <select id="ingreso-cliente" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">Seleccionar cliente...</option>
              </select>
              <button type="button" id="ingreso-add-cliente" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm" title="Nuevo cliente">➕</button>
            </div>
          </div>
          <!-- Vehículo -->
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Vehículo</label>
            <div class="grid grid-cols-2 gap-3">
              <select id="ingreso-vehiculo" class="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">Seleccionar vehículo...</option>
              </select>
              <div class="flex gap-2">
                <input id="ingreso-vin" type="text" placeholder="VIN (opcional)" class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono uppercase">
                <button type="button" id="decode-vin-btn" class="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium" title="Decodificar VIN (NHTSA)">🔍</button>
                <button type="button" id="scan-vin-btn" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm" title="Escanear VIN con cámara">📷</button>
              </div>
            </div>
          </div>
          <!-- Check-in fields -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Kilometraje</label>
              <input id="ingreso-km" type="number" placeholder="ej: 50000" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nivel Combustible</label>
              <select id="ingreso-fuel" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">—</option>
                <option value="Vacío">Vacío</option>
                <option value="1/4">1/4</option>
                <option value="1/2">1/2</option>
                <option value="3/4">3/4</option>
                <option value="Lleno">Lleno</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Estado Exterior</label>
            <textarea id="ingreso-exterior" rows="2" placeholder="Rayones, abolladuras, observaciones..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"></textarea>
          </div>
          <!-- Orden de Trabajo -->
          <div class="border-t border-gray-800 pt-4">
            <div class="flex items-center gap-2 mb-3">
              <input id="ingreso-crear-ot" type="checkbox" class="accent-blue-500" checked>
              <label for="ingreso-crear-ot" class="text-sm text-gray-300">Crear Orden de Trabajo</label>
            </div>
            <div id="ingreso-ot-fields">
              <div>
                <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción del Trabajo</label>
                <textarea id="ingreso-desc" rows="2" placeholder="Ej: Cambio de aceite y filtros, revisión de frenos..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"></textarea>
              </div>
            </div>
          </div>
          <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition">Registrar Ingreso</button>
          <p id="ingreso-msg" class="text-sm text-center hidden"></p>
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
      alert('Ingrese un VIN de 17 caracteres');
      return;
    }
    try {
      const result = await api('/workshop/vehiculos/decode-vin', { method: 'POST', body: { vin } });
      if (result.brand || result.model || result.year) {
        alert(`VIN decodificado:\nMarca: ${result.brand || '—'}\nModelo: ${result.model || '—'}\nAño: ${result.year || '—'}\nMotor: ${result.engineType || '—'}\n\nUse estos datos para crear/actualizar el vehículo.`);
      } else {
        alert('VIN decodificado pero no se encontraron datos completos. Verifique el VIN.');
      }
    } catch (e) {
      alert('Error al decodificar VIN: ' + e.message);
    }
  });
}


