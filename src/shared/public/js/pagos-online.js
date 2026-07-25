/* ═══════════════════════════════════════════════════════════════════
   P2.7 — Pagos Online Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderPagosOnline(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Pagos Online</h2>
      <p class="text-sm text-gray-500">Generá links de pago para facturas vía Stripe o PagosPy</p>
    </div>

    <!-- Generate Payment Link -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
        Generar Link de Pago
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">ID Factura *</label>
          <input id="po-factura" placeholder="UUID de la factura" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Proveedor de Pago *</label>
          <select id="po-provider" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50">
            <option value="STRIPE">Stripe</option>
            <option value="PAGOS_PY">PagosPy</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">URL de Éxito (opcional)</label>
          <input id="po-success" placeholder="https://taller.com/pago-exitoso" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">URL de Cancelación (opcional)</label>
          <input id="po-cancel" placeholder="https://taller.com/pago-cancelado" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        </div>
      </div>
      <div class="mt-4">
        <button onclick="generatePaymentLink()" class="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          Generar Link de Pago
        </button>
      </div>
      <div id="po-result" class="mt-4 hidden"></div>
    </div>

    <!-- Info Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-sm">Stripe</p>
            <p class="text-xs text-gray-500">Pagos con tarjeta de crédito/débito</p>
          </div>
        </div>
        <ul class="text-xs text-gray-500 space-y-1">
          <li>• Visa, Mastercard, American Express</li>
          <li>• Comisión: 2.9% + $0.30 por transacción</li>
          <li>• Settlement: 2-3 días hábiles</li>
          <li>• Soporta suscripciones recurrentes</li>
        </ul>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-sm">PagosPy</p>
            <p class="text-xs text-gray-500">Pagos locales Paraguay</p>
          </div>
        </div>
        <ul class="text-xs text-gray-500 space-y-1">
          <li>• Transferencia bancaria local</li>
          <li>• Comisión: 1.5% por transacción</li>
          <li>• Settlement: 1 día hábil</li>
          <li>• Guaraníes (Gs.) nativo</li>
        </ul>
      </div>
    </div>`;
}

async function generatePaymentLink() {
  const facturaId = document.getElementById('po-factura')?.value?.trim();
  const provider = document.getElementById('po-provider')?.value;
  const successUrl = document.getElementById('po-success')?.value?.trim() || undefined;
  const cancelUrl = document.getElementById('po-cancel')?.value?.trim() || undefined;

  if (!facturaId) { showToast('Ingresá el ID de la factura', 'error'); return; }

  const el = document.getElementById('po-result');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="text-blue-400 text-sm flex items-center gap-2"><svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generando link de pago...</div>';

  try {
    const result = await api('/finance/payments/link', {
      method: 'POST',
      body: { facturaId, provider, successUrl, cancelUrl }
    });

    const url = result?.url || result?.sessionUrl || result?.paymentUrl || '';
    const sessionId = result?.sessionId || result?.session_id || '';

    el.innerHTML = `
      <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <p class="text-sm font-semibold text-green-400 mb-2">✓ Link de pago generado</p>
        <div class="flex items-center gap-2">
          <input id="po-link" value="${esc(url)}" readonly class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono">
          <button onclick="copyPaymentLink()" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">📋 Copiar</button>
        </div>
        ${sessionId ? `<p class="text-xs text-gray-500 mt-2">Session ID: ${esc(sessionId)}</p>` : ''}
        <p class="text-xs text-gray-500 mt-1">Proveedor: ${provider} · Enviá este link al cliente por WhatsApp o email</p>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">${esc(e.message || 'Error al generar link de pago. Verificá que la factura exista y esté pendiente de pago.')}</div>`;
  }
}

function copyPaymentLink() {
  const input = document.getElementById('po-link');
  if (input?.value) {
    navigator.clipboard.writeText(input.value).then(() => showToast('Link copiado al portapapeles'));
  }
}
