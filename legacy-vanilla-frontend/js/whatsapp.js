/**
 * WhatsApp Integration — Frontend Module.
 *
 * Features:
 *   - QR code pairing screen in Configuración
 *   - Connection status indicator in header
 *   - "Enviar por WhatsApp" buttons in all order views
 *   - Preview modal with template text before sending
 *   - Error handling with visual feedback
 *
 * @module frontend/whatsapp
 */

/* ─── WhatsApp State ─────────────────────────── */
const whatsappState = {
  status: 'DISCONNECTED',
  phoneNumber: '',
  qrBase64: '',
  qrPolling: null,
  statusPolling: null,
};

/* ─── Template Definitions ───────────────────── */
const WA_TEMPLATES = {
  RECEPCIONADO: {
    label: 'Recepción',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11h18l-2.25 6.75a2 2 0 01-2 1.25H7.25a2 2 0 01-2-1.25L3 11z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11l1.5-4.5A2 2 0 016.5 5h11a2 2 0 012 1.5L21 11"/></svg>',
    color: 'blue',
    estado: 'RECEPCIONADO',
  },
  PRESUPUESTADO: {
    label: 'Presupuesto',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>',
    color: 'yellow',
    estado: 'PRESUPUESTADO',
  },
  EN_REPARACION: {
    label: 'Taller',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"/></svg>',
    color: 'orange',
    estado: 'EN_REPARACION',
  },
  LISTO_ENTREGA: {
    label: 'Control Calidad',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    color: 'purple',
    estado: 'LISTO_ENTREGA',
  },
  FINALIZADO_RETIRADO: {
    label: 'Caja/Salida',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>',
    color: 'green',
    estado: 'FINALIZADO_RETIRADO',
  },
};

/* ─── QR Pairing Screen ──────────────────────── */

/**
 * Renders the WhatsApp QR pairing section within the Config view.
 */
function renderWhatsAppConfig(container) {
  const section = document.createElement('div');
  section.className = 'bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow';
  section.id = 'whatsapp-config-section';
  section.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <div>
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">WhatsApp Business</h3>
          <p class="text-xs text-gray-600">Conecta el teléfono del taller para enviar notificaciones</p>
        </div>
      </div>
      <div class="flex items-center gap-2" id="wa-status-badge">
        <span class="ws-dot bg-red-500" id="wa-conn-dot"></span>
        <span class="text-xs text-gray-500" id="wa-conn-label">Desconectado</span>
      </div>
    </div>
    <div id="wa-qr-area" class="hidden">
      <div class="text-center py-6">
        <div class="inline-block bg-white p-4 rounded-xl mb-4">
          <img id="wa-qr-img" class="w-48 h-48" src="" alt="Código QR de WhatsApp">
        </div>
        <p class="text-sm text-gray-400 mb-2">Escanea este código con WhatsApp en tu teléfono</p>
        <p class="text-xs text-gray-600">WhatsApp → Menú → Dispositivos vinculados → Vincular dispositivo</p>
        <div class="mt-3">
          <span class="inline-block animate-spin text-gray-500">⟳</span>
          <span class="text-xs text-gray-500 ml-1">Esperando escaneo...</span>
        </div>
      </div>
    </div>
    <div id="wa-connected-area" class="hidden">
      <div class="text-center py-4">
        <svg class="w-10 h-10 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-sm text-green-400 font-medium">WhatsApp Conectado</p>
        <p class="text-xs text-gray-500 mt-1" id="wa-phone-display"></p>
      </div>
    </div>
    <div id="wa-disconnected-area">
      <div class="text-center py-4">
        <p class="text-sm text-gray-500 mb-4">No hay dispositivo conectado</p>
        <button id="wa-connect-btn" class="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center gap-2 mx-auto">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Conectar Dispositivo
        </button>
      </div>
    </div>
    <div id="wa-error-area" class="hidden mt-3 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
      <p class="text-sm text-red-400" id="wa-error-msg"></p>
    </div>
  `;
  container.appendChild(section);

  // Setup event listeners
  const connectBtn = document.getElementById('wa-connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', startWhatsAppPairing);
  }

  // Check current status
  checkWhatsAppStatus();
}

/**
 * Starts the QR pairing process.
 */
async function startWhatsAppPairing() {
  const qrArea = document.getElementById('wa-qr-area');
  const disconnectedArea = document.getElementById('wa-disconnected-area');
  const errorArea = document.getElementById('wa-error-area');
  const errorMsg = document.getElementById('wa-error-msg');

  if (disconnectedArea) disconnectedArea.classList.add('hidden');
  if (errorArea) errorArea.classList.add('hidden');
  if (qrArea) qrArea.classList.remove('hidden');

  try {
    // Create instance first
    await api('/whatsapp/instance/create', { method: 'POST' });

    // Fetch QR code
    const qr = await api('/whatsapp/qr');
    if (qr.base64) {
      const qrImg = document.getElementById('wa-qr-img');
      if (qrImg) {
        qrImg.src = qr.base64.startsWith('data:') ? qr.base64 : `data:image/png;base64,${qr.base64}`;
      }
    }

    // Start polling for connection status
    startQRPolling();
  } catch (err) {
    if (qrArea) qrArea.classList.add('hidden');
    if (disconnectedArea) disconnectedArea.classList.remove('hidden');
    if (errorArea) errorArea.classList.remove('hidden');
    if (errorMsg) errorMsg.textContent = `Error: ${err.message || 'No se pudo generar el QR'}`;
  }
}

/**
 * Polls for QR scan / connection status.
 */
function startQRPolling() {
  if (whatsappState.qrPolling) clearInterval(whatsappState.qrPolling);
  whatsappState.qrPolling = setInterval(async () => {
    try {
      const status = await api('/whatsapp/status');
      if (status.status === 'CONNECTED') {
        clearInterval(whatsappState.qrPolling);
        whatsappState.qrPolling = null;
        updateWhatsAppUI(status);
        if (typeof showToast === 'function') showToast('WhatsApp conectado exitosamente', 'success');
      }
    } catch {
      // Ignore polling errors
    }
  }, 3000);
}

/**
 * Checks current WhatsApp connection status.
 */
async function checkWhatsAppStatus() {
  try {
    const status = await api('/whatsapp/status');
    updateWhatsAppUI(status);
  } catch {
    updateWhatsAppUI({ status: 'DISCONNECTED' });
  }
}

/**
 * Updates the WhatsApp UI based on connection status.
 */
function updateWhatsAppUI(status) {
  const qrArea = document.getElementById('wa-qr-area');
  const connectedArea = document.getElementById('wa-connected-area');
  const disconnectedArea = document.getElementById('wa-disconnected-area');
  const connDot = document.getElementById('wa-conn-dot');
  const connLabel = document.getElementById('wa-conn-label');
  const phoneDisplay = document.getElementById('wa-phone-display');

  const isConnected = status.status === 'CONNECTED';
  const isQR = status.status === 'QR_READY' || status.status === 'CONNECTING';

  // Status badge
  if (connDot) {
    connDot.className = `ws-dot ${isConnected ? 'bg-green-500' : isQR ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`;
  }
  if (connLabel) {
    connLabel.textContent = isConnected ? 'Conectado' : isQR ? 'Emparejando...' : 'Desconectado';
  }

  // Areas
  if (qrArea) qrArea.classList.toggle('hidden', !isQR);
  if (connectedArea) connectedArea.classList.toggle('hidden', !isConnected);
  if (disconnectedArea) disconnectedArea.classList.toggle('hidden', isConnected || isQR);

  if (phoneDisplay && status.phoneNumber) {
    phoneDisplay.textContent = status.phoneNumber;
  }

  // Update header WhatsApp indicator
  updateHeaderWhatsAppStatus(status.status);

  whatsappState.status = status.status;
  whatsappState.phoneNumber = status.phoneNumber || '';
}

/**
 * Updates the header WhatsApp status indicator.
 */
function updateHeaderWhatsAppStatus(status) {
  const headerDot = document.getElementById('wa-header-dot');
  const headerLabel = document.getElementById('wa-header-label');
  if (!headerDot || !headerLabel) return;

  const isConnected = status === 'CONNECTED';
  headerDot.className = `ws-dot ${isConnected ? 'bg-green-500' : 'bg-red-500'}`;
  headerLabel.textContent = isConnected ? 'WA: OK' : 'WA: —';
}

/* ─── Send WhatsApp Button ───────────────────── */

/**
 * Creates a "Enviar por WhatsApp" button for an order.
 *
 * @param {string} ordenId - Work order UUID
 * @param {string} currentStatus - Current order status
 * @param {object} orderData - Additional order data for template preview
 * @returns {string} HTML string for the button
 */
function createWhatsAppButton(ordenId, currentStatus, orderData = {}) {
  // Determine which template to use based on current status
  const templateKey = getStatusTemplate(currentStatus);
  if (!templateKey) return '';

  const tmpl = WA_TEMPLATES[templateKey];
  const shortId = ordenId.substring(0, 8).toUpperCase();

  return `
    <button
      class="wa-send-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-800/30 rounded-lg text-xs text-green-300 font-medium transition"
      data-orden="${ordenId}"
      data-template="${templateKey}"
      data-short-id="${shortId}"
      data-order='${JSON.stringify(orderData).replace(/'/g, "&#39;")}'
      title="Enviar mensaje por WhatsApp"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> WhatsApp
    </button>
  `;
}

/**
 * Determines which WhatsApp template to use based on order status.
 */
function getStatusTemplate(status) {
  const map = {
    Presupuestado: 'RECEPCIONADO',
    Aprobado: 'PRESUPUESTADO',
    En_Proceso: 'EN_REPARACION',
    Control_Calidad: 'LISTO_ENTREGA',
    Listo: 'FINALIZADO_RETIRADO',
  };
  return map[status] || null;
}

/* ─── Preview Modal ──────────────────────────── */

/**
 * Opens the WhatsApp preview modal with template text.
 *
 * @param {string} ordenId - Work order UUID
 * @param {string} templateKey - Template key
 * @param {object} orderData - Order data for template filling
 */
function openWhatsAppPreview(ordenId, templateKey, orderData = {}) {
  const tmpl = WA_TEMPLATES[templateKey];
  if (!tmpl) return;

  // Build preview message
  const previewMsg = buildPreviewMessage(templateKey, orderData);
  const shortId = orderData.shortId || ordenId.substring(0, 8).toUpperCase();

  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">${tmpl.icon}</span>
          <h3 class="text-lg font-bold text-white">Enviar por WhatsApp</h3>
        </div>
        <button id="wa-modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>

      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Plantilla</p>
        <p class="text-sm text-gray-300">${tmpl.label} — Orden #${shortId}</p>
      </div>

      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Vista previa del mensaje</p>
        <div id="wa-preview-text" class="text-sm text-gray-300 whitespace-pre-wrap mt-2 bg-gray-900/50 p-3 rounded border border-gray-700 max-h-48 overflow-y-auto">${esc(previewMsg)}</div>
      </div>

      ${templateKey === 'PRESUPUESTADO' ? `
      <div class="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3">
        <p class="text-xs text-yellow-400"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Se adjuntará el PDF del presupuesto automáticamente</p>
      </div>
      ` : ''}

      <div class="flex gap-3">
        <button id="wa-modal-cancel" class="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition">Cancelar</button>
        <button id="wa-modal-send" class="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> Enviar Ahora
        </button>
      </div>

      <p id="wa-send-status" class="text-sm text-center hidden"></p>
    </div>
  `;

  overlay.classList.remove('hidden');

  // Event listeners
  document.getElementById('wa-modal-close')?.addEventListener('click', closeWhatsAppPreview);
  document.getElementById('wa-modal-cancel')?.addEventListener('click', closeWhatsAppPreview);
  document.getElementById('wa-modal-send')?.addEventListener('click', async () => {
    await sendWhatsAppMessage(ordenId, templateKey, orderData);
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWhatsAppPreview();
  });
}

/**
 * Closes the WhatsApp preview modal.
 */
function closeWhatsAppPreview() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Builds a preview message from template and data.
 */
function buildPreviewMessage(templateKey, data) {
  const templates = {
    RECEPCIONADO: `¡Hola ${data.nombre_cliente || 'Cliente'}! 🚗 Tu ${data.vehiculo_marca || ''} ${data.vehiculo_modelo || ''} (Chapa: ${data.chapa || 'S/N'}) ya ingresó a nuestros talleres. Se ha generado la Orden de Trabajo #${data.shortId || '—'}. Iniciamos la fase de diagnóstico. Te mantendremos informado por aquí.`,
    PRESUPUESTADO: `Estimado/a ${data.nombre_cliente || 'Cliente'}, tenemos listo el diagnóstico para la Orden #${data.shortId || '—'}. El presupuesto total estimado es de Gs. ${data.monto_total || '0'}. Adjuntamos el documento PDF detallado 👇. Aguardamos tu confirmación por este medio para iniciar las reparaciones.`,
    EN_REPARACION: `¡Buenas noticias, ${data.nombre_cliente || 'Cliente'}! Hemos iniciado las reparaciones de tu ${data.vehiculo_modelo || 'vehículo'}. El técnico asignado es ${data.nombre_mecanico || '—'}. Estimamos tener el vehículo listo para el ${data.fecha_estimada_entrega || '—'}.`,
    LISTO_ENTREGA: `✨ ¡Tu vehículo está listo, ${data.nombre_cliente || 'Cliente'}! Concluimos con éxito todos los trabajos de la Orden #${data.shortId || '—'} y superamos el control de calidad. Ya puedes pasar a retirar tu ${data.vehiculo_modelo || 'vehículo'}.`,
    FINALIZADO_RETIRADO: `Muchas gracias por tu confianza, ${data.nombre_cliente || 'Cliente'}. Se registró la salida de tu vehículo con la Factura Nº ${data.numero_factura || '—'}. Nos ayudaría muchísimo si calificas nuestro servicio en este enlace de 30 segundos: ${data.url_encuesta || 'https://encuesta.taller.com.py'}`,
  };
  return templates[templateKey] || '';
}

/* ─── Send Message ───────────────────────────── */

/**
 * Sends a WhatsApp message via the API.
 */
async function sendWhatsAppMessage(ordenId, templateKey, orderData = {}) {
  const statusEl = document.getElementById('wa-send-status');
  const sendBtn = document.getElementById('wa-modal-send');

  if (statusEl) {
    statusEl.classList.remove('hidden', 'text-red-400');
    statusEl.classList.add('text-gray-400');
    statusEl.textContent = '⏳ Enviando mensaje...';
  }
  if (sendBtn) sendBtn.disabled = true;

  try {
    const result = await api('/whatsapp/send', {
      method: 'POST',
      body: {
        ordenId,
        estadoSolicitado: WA_TEMPLATES[templateKey]?.estado || templateKey,
      },
    });

    if (result.success) {
      if (statusEl) {
        statusEl.classList.remove('text-gray-400');
        statusEl.classList.add('text-green-400');
        statusEl.textContent = `✅ Mensaje enviado a ${result.phone}`;
      }

      if (typeof showToast === 'function') {
        showToast(`Mensaje enviado por WhatsApp a ${result.phone}`, 'success');
      }

      // Close modal after 2 seconds
      setTimeout(closeWhatsAppPreview, 2000);
    } else {
      throw new Error(result.message || 'Error de envío');
    }
  } catch (err) {
    if (statusEl) {
      statusEl.classList.remove('text-gray-400');
      statusEl.classList.add('text-red-400');
      statusEl.textContent = `❌ Error de envío: ${err.message}`;
    }
    if (sendBtn) {
      sendBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
      sendBtn.classList.add('bg-red-600', 'hover:bg-red-500');
    }
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ─── Event Delegation ───────────────────────── */

/**
 * Sets up global event delegation for WhatsApp buttons.
 * Called once from app.js after login.
 */
function setupWhatsAppListeners() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.wa-send-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const ordenId = btn.dataset.orden;
    const templateKey = btn.dataset.template;
    let orderData = {};

    try {
      orderData = JSON.parse(btn.dataset.order || '{}');
    } catch {}

    openWhatsAppPreview(ordenId, templateKey, orderData);
  });
}

// Initialize listeners on script load
if (typeof document !== 'undefined') {
  setupWhatsAppListeners();
}

/* ─── Full WhatsApp View ─────────────────────── */

/**
 * Renders the full WhatsApp management view.
 */
function renderWhatsAppView(container) {
  container.innerHTML = `
    <div class="max-w-3xl space-y-6">
      <!-- Connection Status Card -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <div>
              <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Estado de Conexión</h3>
              <p class="text-xs text-gray-600">WhatsApp Business via Evolution API</p>
            </div>
          </div>
          <div class="flex items-center gap-2" id="wa-view-status">
            <span class="ws-dot bg-red-500" id="wa-view-dot"></span>
            <span class="text-xs text-gray-500" id="wa-view-label">Verificando...</span>
          </div>
        </div>

        <!-- QR Code Area -->
        <div id="wa-view-qr" class="hidden text-center py-6">
          <div class="inline-block bg-white p-4 rounded-xl mb-4">
            <img id="wa-view-qr-img" class="w-56 h-56" src="" alt="QR WhatsApp">
          </div>
          <p class="text-sm text-gray-400 mb-1">Escanea con WhatsApp → Menú → Dispositivos vinculados</p>
          <div class="mt-3">
            <span class="inline-block animate-spin text-gray-500">⟳</span>
            <span class="text-xs text-gray-500 ml-1">Esperando escaneo...</span>
          </div>
        </div>

        <!-- Connected Area -->
        <div id="wa-view-connected" class="hidden text-center py-4">
        <svg class="w-10 h-10 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p class="text-sm text-green-400 font-medium">WhatsApp Conectado</p>
          <p class="text-xs text-gray-500 mt-1" id="wa-view-phone"></p>
        </div>

        <!-- Disconnected Area -->
        <div id="wa-view-disconnected" class="text-center py-4">
          <p class="text-sm text-gray-500 mb-4">Conecta el teléfono del taller para enviar notificaciones a clientes</p>
          <button id="wa-view-connect-btn" class="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center gap-2 mx-auto">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Conectar Dispositivo
          </button>
        </div>

        <!-- Error Area -->
        <div id="wa-view-error" class="hidden mt-3 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
          <p class="text-sm text-red-400" id="wa-view-error-msg"></p>
        </div>

        <!-- Disconnect Button -->
        <div id="wa-view-disconnect" class="hidden mt-4 pt-4 border-t border-gray-800 text-center">
          <button id="wa-view-disconnect-btn" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-400 transition">
            Desconectar Dispositivo
          </button>
        </div>
      </div>

      <!-- Message Log Card -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Historial de Mensajes</h3>
        <div id="wa-log-list" class="space-y-2">
          <p class="text-sm text-gray-600 text-center py-4">Cargando historial...</p>
        </div>
        <div id="wa-log-pagination" class="flex justify-center gap-2 mt-4"></div>
      </div>

      <!-- Available Templates Card -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Plantillas Disponibles</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${Object.entries(WA_TEMPLATES).map(([key, tmpl]) => `
            <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">${tmpl.icon}</span>
                <span class="text-sm font-medium text-gray-300">${tmpl.label}</span>
                <span class="text-xs text-gray-600">(${tmpl.estado})</span>
              </div>
              <p class="text-xs text-gray-500 leading-relaxed">${buildPreviewMessage(key, {}).substring(0, 120)}...</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Setup event listeners
  document.getElementById('wa-view-connect-btn')?.addEventListener('click', startWhatsAppPairing);
  document.getElementById('wa-view-disconnect-btn')?.addEventListener('click', async () => {
    try {
      await api('/whatsapp/disconnect', { method: 'POST' });
      checkWhatsAppStatus();
      if (typeof showToast === 'function') showToast('WhatsApp desconectado', 'info');
    } catch (err) {
      if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Load status and log
  checkWhatsAppStatus();
  loadWhatsAppLog();
}

/**
 * Loads the WhatsApp message log.
 */
async function loadWhatsAppLog(page = 1) {
  const logList = document.getElementById('wa-log-list');
  if (!logList) return;

  try {
    const result = await api(`/whatsapp/log?page=${page}&limit=10`);
    if (!result.items || result.items.length === 0) {
      logList.innerHTML = '<p class="text-sm text-gray-600 text-center py-4">No hay mensajes enviados</p>';
      return;
    }

    logList.innerHTML = result.items.map(msg => `
      <div class="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-800/50">
        <span class="text-lg">${msg.status === 'SENT' ? '✅' : msg.status === 'FAILED' ? '❌' : '⏳'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-300">${esc(msg.clienteName)}</span>
            <span class="text-xs text-gray-600">${esc(msg.phoneNumber)}</span>
          </div>
          <p class="text-xs text-gray-500 truncate mt-0.5">${esc(msg.messageText?.substring(0, 80))}...</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-xs text-gray-600">${msg.sentAt ? new Date(msg.sentAt).toLocaleDateString('es-PY') : '—'}</p>
          <p class="text-xs text-gray-600">${msg.template}</p>
        </div>
      </div>
    `).join('');

    // Pagination
    const pagination = document.getElementById('wa-log-pagination');
    if (pagination && result.totalPages > 1) {
      let btns = '';
      if (result.hasPrev) btns += `<button class="wa-log-page px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs" data-page="${page - 1}">← Anterior</button>`;
      btns += `<span class="text-xs text-gray-500 px-2">Página ${page} de ${result.totalPages}</span>`;
      if (result.hasNext) btns += `<button class="wa-log-page px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs" data-page="${page + 1}">Siguiente →</button>`;
      pagination.innerHTML = btns;

      pagination.querySelectorAll('.wa-log-page').forEach(btn => {
        btn.addEventListener('click', () => loadWhatsAppLog(parseInt(btn.dataset.page)));
      });
    }
  } catch {
    logList.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Error cargando historial</p>';
  }
}

/* ─── Config Integration ─────────────────────── */

/**
 * Adds WhatsApp section to the Config view.
 * Called from renderConfig.
 */
function addWhatsAppConfigSection() {
  const configContainer = document.querySelector('#config-form')?.closest('.max-w-2xl') || document.querySelector('.max-w-2xl');
  if (configContainer) {
    renderWhatsAppConfig(configContainer);
  }
}

/* ─── Order View Integration Helpers ─────────── */

/**
 * Injects WhatsApp button into an order row.
 * Call this from order rendering functions.
 *
 * @param {object} order - Order object with id, status, client, vehicle, etc.
 * @returns {string} HTML for the WhatsApp button
 */
function getWhatsAppButtonForOrder(order) {
  return createWhatsAppButton(order.id, order.status, {
    nombre_cliente: order.cliente || order.clientName || '',
    vehiculo_marca: order.vehiculo || order.vehicleBrand || '',
    vehiculo_modelo: order.vehicleModel || '',
    chapa: order.plate || '',
    shortId: (order.id || '').substring(0, 8).toUpperCase(),
    monto_total: order.totalCost ? Number(order.totalCost).toLocaleString('es-PY') : '0',
  });
}

