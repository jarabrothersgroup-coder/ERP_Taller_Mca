/* ═══════════════════════════════════════════════════════════════════
   P3.1 — Email Automático de Factura + Configuración
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderEmailConfig(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Email Automático</h2>
      <p class="text-sm text-gray-500">Configuración de envío automático de facturas por email</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Config Panel -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Configuración de Envío</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Envío automático al emitir factura</p>
              <p class="text-xs text-gray-500">Envía la factura por email al cliente automáticamente</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ec-auto-send" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Incluir PDF adjunto</p>
              <p class="text-xs text-gray-500">Adjunta el PDF de la factura al email</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ec-include-pdf" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Incluir link de pago</p>
              <p class="text-xs text-gray-500">Agrega botón de pago online en el email</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ec-include-payment" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Asunto del email</label>
            <input id="ec-subject" value="Factura — AutomotiveOS Workshop" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50">
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Mensaje adicional (opcional)</p>
            <textarea id="ec-message" rows="3" placeholder="Gracias por su preferencia..." class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 resize-none"></textarea>
          </div>
          <button onclick="saveEmailConfig()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Guardar Configuración</button>
        </div>
      </div>

      <!-- Test Email Panel -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Enviar Email de Prueba</h3>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-500 block mb-1">ID Factura</label>
            <input id="ec-test-factura" placeholder="UUID de factura para prueba" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Email destino (override)</label>
            <input id="ec-test-email" placeholder="test@ejemplo.com" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
          </div>
          <button onclick="sendTestEmail()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">Enviar Prueba</button>
          <div id="ec-test-result" class="hidden"></div>
        </div>

        <!-- Email History -->
        <div class="mt-6 pt-4 border-t border-gray-800">
          <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3">Últimos Emails Enviados</h4>
          <div id="ec-history" class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
        </div>
      </div>
    </div>`;

  loadEmailHistory();
}

async function loadEmailHistory() {
  const el = document.getElementById('ec-history');
  const data = await api('/email/log?limit=10').catch(() => null);
  const logs = data?.data || data || [];
  if (!Array.isArray(logs) || !logs.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">Sin emails enviados recientemente</div>';
    return;
  }
  el.innerHTML = `
    <div class="space-y-2">
      ${logs.map(l => `
        <div class="flex items-center justify-between text-xs py-2 border-b border-gray-800/50 last:border-0">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${l.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}"></span>
            <span class="text-gray-400">${esc(l.to || '—')}</span>
          </div>
          <span class="text-gray-600">${l.createdAt ? new Date(l.createdAt).toLocaleDateString('es-PY') : '—'}</span>
        </div>`).join('')}
    </div>`;
}

function saveEmailConfig() {
  const config = {
    autoSend: document.getElementById('ec-auto-send')?.checked,
    includePdf: document.getElementById('ec-include-pdf')?.checked,
    includePaymentLink: document.getElementById('ec-include-payment')?.checked,
    subject: document.getElementById('ec-subject')?.value?.trim(),
    message: document.getElementById('ec-message')?.value?.trim(),
  };
  localStorage.setItem('email-config', JSON.stringify(config));
  showToast('Configuración guardada');
}

async function sendTestEmail() {
  const facturaId = document.getElementById('ec-test-factura')?.value?.trim();
  const testEmail = document.getElementById('ec-test-email')?.value?.trim();
  if (!facturaId) { showToast('Ingresá el ID de factura', 'error'); return; }
  const el = document.getElementById('ec-test-result');
  el.classList.remove('hidden');
  try {
    await api('/email/send-invoice', { method: 'POST', body: { facturaId, overrideEmail: testEmail || undefined } });
    el.innerHTML = '<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">✓ Email enviado correctamente</div>';
  } catch (e) {
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">${esc(e.message || 'Error al enviar')}</div>`;
  }
}
