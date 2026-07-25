/* ═══════════════════════════════════════════════════════════════════
   P3.2 — WhatsApp Notificación al Cambiar Estado OT
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderWhatsAppConfig(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">WhatsApp — Notificaciones OT</h2>
      <p class="text-sm text-gray-500">Configuración de mensajes automáticos por cambio de estado</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Template Config -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Plantillas de Mensajes</h3>
        <div id="wa-templates" class="space-y-3">Cargando plantillas...</div>
      </div>

      <!-- Status Rules -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Reglas por Estado</h3>
        <p class="text-xs text-gray-500 mb-4">Seleccioná qué estados disparan notificación automática al cliente</p>
        <div class="space-y-3" id="wa-rules">
          ${['Presupuestado', 'Aprobado', 'En_Proceso', 'Control_Calidad', 'Listo', 'Finalizado_Retirado'].map((s, i) => `
            <div class="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${['bg-yellow-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-cyan-500', 'bg-green-500'][i]}"></span>
                <span class="text-sm">${s.replace(/_/g, ' ')}</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" ${['Presupuestado', 'Listo', 'Finalizado_Retirado'].includes(s) ? 'checked' : ''} data-rule="${s}">
                <div class="w-9 h-5 bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>`).join('')}
        </div>
        <button onclick="saveWhatsAppRules()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Guardar Reglas</button>
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mt-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Vista Previa del Mensaje</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Seleccionar estado</label>
          <select id="wa-preview-status" onchange="previewWhatsAppMessage()" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="Presupuestado">Presupuestado</option>
            <option value="Aprobado">Aprobado</option>
            <option value="En_Proceso">En Proceso</option>
            <option value="Control_Calidad">Control de Calidad</option>
            <option value="Listo" selected>Listo para Retirar</option>
            <option value="Finalizado_Retirado">Finalizado</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Variables disponibles</label>
          <div class="text-xs text-gray-600 space-y-0.5">
            <span class="bg-gray-800 px-2 py-0.5 rounded inline-block mr-1">{{cliente_nombre}}</span>
            <span class="bg-gray-800 px-2 py-0.5 rounded inline-block mr-1">{{vehiculo_patente}}</span>
            <span class="bg-gray-800 px-2 py-0.5 rounded inline-block mr-1">{{ot_numero}}</span>
            <span class="bg-gray-800 px-2 py-0.5 rounded inline-block mr-1">{{estado}}</span>
          </div>
        </div>
      </div>
      <div class="mt-4 bg-[#0b141a] rounded-xl p-4 max-w-md">
        <div class="bg-[#005c4b] rounded-lg p-3 text-sm text-white" id="wa-preview-msg">
          <p>🚗 Hola {{cliente_nombre}},</p>
          <p class="mt-1">Tu vehículo <strong>{{vehiculo_patente}}</strong> (OT #{{ot_numero}}) está <strong>Listo para Retirar</strong>.</p>
          <p class="mt-1">📍 Horarios: Lun-Vie 8:00-17:00</p>
          <p class="mt-2 text-xs text-gray-300">AutomotiveOS Workshop</p>
        </div>
      </div>
    </div>`;

  loadWhatsAppTemplates();
}

async function loadWhatsAppTemplates() {
  const el = document.getElementById('wa-templates');
  const templates = await api('/whatsapp/templates').catch(() => null);
  const list = templates?.data || templates || [];

  if (!Array.isArray(list) || !list.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">Sin plantillas configuradas. Usá "Seed" para crear las predeterminadas.</div>';
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
      <div>
        <p class="text-sm font-medium">${esc(t.key || t.nombre || '—')}</p>
        <p class="text-xs text-gray-500 truncate max-w-xs">${esc((t.body || t.text || '').substring(0, 60))}...</p>
      </div>
      <span class="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">${t.status || 'active'}</span>
    </div>`).join('');
}

function previewWhatsAppMessage() {
  const status = document.getElementById('wa-preview-status')?.value;
  const messages = {
    Presupuestado: '🚗 Hola {cliente_nombre},\n\nTu vehículo {vehiculo_patente} tiene un presupuesto listo para revisar.\n\n📋 OT #{ot_numero}\n\n¿Aprobás el presupuesto? Respondé SI o NO.\n\nAutomotiveOS Workshop',
    Aprobado: '✅ Hola {cliente_nombre},\n\nPresupuesto aprobado para {vehiculo_patente}.\n\n🔧 Comenzaremos con los trabajos pronto.\n📋 OT #{ot_numero}\n\nAutomotiveOS Workshop',
    En_Proceso: '🔧 Hola {cliente_nombre},\n\nTu vehículo {vehiculo_patente} está siendo atendido.\n\n📋 OT #{ot_numero} — Estado: En Proceso\n\nTe mantendremos informado.\n\nAutomotiveOS Workshop',
    Control_Calidad: '🔬 Hola {cliente_nombre},\n\n{vehiculo_patente} pasó a control de calidad.\n\n📋 OT #{ot_numero}\n\nCasi listo!\n\nAutomotiveOS Workshop',
    Listo: '✅ Hola {cliente_nombre},\n\nTu vehículo {vehiculo_patente} está listo para retirar!\n\n📋 OT #{ot_numero}\n📍 Horarios: Lun-Vie 8:00-17:00\n\nAutomotiveOS Workshop',
    Finalizado_Retirado: '👋 Hola {cliente_nombre},\n\nGracias por confiar en nosotros con {vehiculo_patente}.\n\n📋 OT #{ot_numero} completada.\n\n¿Todo bien? Respondé tu experiencia.\n\nAutomotiveOS Workshop',
  };
  const el = document.getElementById('wa-preview-msg');
  if (el && messages[status]) {
    el.innerHTML = `<p class="whitespace-pre-line">${esc(messages[status]).replace(/\n/g, '<br>')}</p>`;
  }
}

function saveWhatsAppRules() {
  const rules = {};
  document.querySelectorAll('#wa-rules input[type="checkbox"]').forEach(cb => {
    rules[cb.dataset.rule] = cb.checked;
  });
  localStorage.setItem('whatsapp-ot-rules', JSON.stringify(rules));
  showToast('Reglas de WhatsApp guardadas');
}
