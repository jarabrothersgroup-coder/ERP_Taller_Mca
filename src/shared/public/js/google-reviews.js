/* ═══════════════════════════════════════════════════════════════════
   P3.8 — Google Reviews + Loyalty Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderGoogleReviews(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Google Reviews + Loyalty</h2>
      <p class="text-sm text-gray-500">Gestioná reseñas de Google y el programa de fidelización</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-4">
      <button id="gr-tab-reviews" class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Google Reviews</button>
      <button id="gr-tab-loyalty" class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Programa Loyalty</button>
      <button id="gr-tab-campaigns" class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Campañas</button>
    </div>

    <!-- Reviews Tab -->
    <div id="gr-reviews-panel">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Review Stats -->
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Resumen de Reseñas</h3>
          <div id="gr-stats" class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
        </div>

        <!-- Recent Reviews -->
        <div class="lg:col-span-2 bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Últimas Reseñas</h3>
          <div id="gr-reviews-list" class="space-y-3 text-center py-4 text-gray-600 text-sm">Cargando...</div>
        </div>
      </div>

      <!-- Auto-Review Request -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mt-6">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Solicitar Reseña Automática</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="text-xs text-gray-500 block mb-1">ID OT completada</label>
            <input id="gr-ot-id" placeholder="UUID de la OT" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Canal</label>
            <select id="gr-channel" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div class="flex items-end">
            <button onclick="sendReviewRequest()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">Enviar Solicitud</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loyalty Tab -->
    <div id="gr-loyalty-panel" class="hidden">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Loyalty Config -->
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Configuración del Programa</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Programa activo</p>
                <p class="text-xs text-gray-500">Habilitar acumulación de puntos</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="gr-loyalty-active" class="sr-only peer" checked>
                <div class="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Puntos por ₲ 10.000 gastados</label>
              <input id="gr-points-per" type="number" value="1" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Descuento por 100 puntos (%)</label>
              <input id="gr-discount-per" type="number" value="5" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Beneficios por nivel</label>
              <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2"><span class="text-yellow-400">⭐</span><span class="text-gray-400">Bronce (0-99 pts): Descuento 0%</span></div>
                <div class="flex items-center gap-2"><span class="text-gray-300">⭐</span><span class="text-gray-400">Plata (100-499 pts): Descuento 5%</span></div>
                <div class="flex items-center gap-2"><span class="text-yellow-500">⭐</span><span class="text-gray-400">Oro (500+ pts): Descuento 10% + prioridad</span></div>
              </div>
            </div>
            <button onclick="saveLoyaltyConfig()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Guardar Configuración</button>
          </div>
        </div>

        <!-- Top Loyalty Clients -->
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Clientes Loyalty</h3>
          <div id="gr-top-clients" class="text-center py-4 text-gray-600 text-sm">Cargando...</div>
        </div>
      </div>
    </div>

    <!-- Campaigns Tab -->
    <div id="gr-campaigns-panel" class="hidden">
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Campañas de Marketing</h3>
        <div id="gr-campaigns" class="text-center py-4 text-gray-600 text-sm">Cargando campañas...</div>
      </div>
    </div>`;

  setupGrTabs();
  loadReviewStats();
  loadReviewsList();
}

function setupGrTabs() {
  const tabs = [
    { id: 'gr-tab-reviews', panel: 'gr-reviews-panel' },
    { id: 'gr-tab-loyalty', panel: 'gr-loyalty-panel' },
    { id: 'gr-tab-campaigns', panel: 'gr-campaigns-panel' }
  ];
  tabs.forEach(t => {
    document.getElementById(t.id)?.addEventListener('click', () => {
      tabs.forEach(x => {
        document.getElementById(x.id).className = 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700';
        document.getElementById(x.panel).classList.add('hidden');
      });
      document.getElementById(t.id).className = 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white';
      document.getElementById(t.panel).classList.remove('hidden');
      if (t.panel === 'gr-loyalty-panel') loadTopLoyaltyClients();
      if (t.panel === 'gr-campaigns-panel') loadMarketingCampaigns();
    });
  });
}

async function loadReviewStats() {
  const el = document.getElementById('gr-stats');
  const data = await api('/marketing/reviews/stats').catch(() => null);
  if (!data) { el.innerHTML = '<div class="text-gray-600 text-sm">Sin estadísticas de reseñas</div>'; return; }

  el.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-4xl font-bold text-yellow-400">${data.promedio || '—'}</p>
      <p class="text-xs text-gray-500 mt-1">Promedio de ${data.total || 0} reseñas</p>
    </div>
    <div class="space-y-1">
      ${[5,4,3,2,1].map(star => {
        const count = data.distribution?.[star] || 0;
        const pct = data.total ? (count / data.total) * 100 : 0;
        return `<div class="flex items-center gap-2 text-xs">
          <span class="text-yellow-400 w-3">${star}★</span>
          <div class="flex-1 bg-gray-800 rounded-full h-2"><div class="bg-yellow-500 rounded-full h-2" style="width:${pct}%"></div></div>
          <span class="text-gray-500 w-6 text-right">${count}</span>
        </div>`;
      }).join('')}
    </div>`;
}

async function loadReviewsList() {
  const el = document.getElementById('gr-reviews-list');
  const data = await api('/marketing/reviews?limit=10').catch(() => null);
  const reviews = data?.data || data || [];

  if (!Array.isArray(reviews) || !reviews.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">Sin reseñas recientes. Configurá la integración con Google My Business API.</div>';
    return;
  }

  el.innerHTML = reviews.map(r => `
    <div class="bg-gray-800/50 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-yellow-400 text-sm">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
          <span class="text-sm font-medium">${esc(r.author || 'Anónimo')}</span>
        </div>
        <span class="text-xs text-gray-600">${r.date ? new Date(r.date).toLocaleDateString('es-PY') : '—'}</span>
      </div>
      <p class="text-sm text-gray-400">${esc(r.text || r.comment || '')}</p>
    </div>`).join('');
}

async function loadTopLoyaltyClients() {
  const el = document.getElementById('gr-top-clients');
  const data = await api('/marketing/loyalty/top?limit=10').catch(() => null);
  const clients = data?.data || data || [];

  if (!Array.isArray(clients) || !clients.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">Sin datos de fidelización. Configurá el programa para empezar a acumular puntos.</div>';
    return;
  }

  el.innerHTML = `
    <div class="space-y-2">
      ${clients.map((c, i) => {
        const nivel = (c.puntos || 0) >= 500 ? 'Oro' : (c.puntos || 0) >= 100 ? 'Plata' : 'Bronce';
        const nivelColor = nivel === 'Oro' ? 'text-yellow-500' : nivel === 'Plata' ? 'text-gray-300' : 'text-orange-400';
        return `<div class="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-600">${i + 1}</span>
            <div>
              <p class="text-sm font-medium">${esc(c.nombre || c.clienteNombre || '—')}</p>
              <p class="text-xs text-gray-500">${esc(c.telefono || c.email || '')}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold ${nivelColor}">${c.puntos || 0} pts · ${nivel}</p>
            <p class="text-xs text-gray-500">${c.totalFacturado ? '₲ ' + fmt(c.totalFacturado) : '—'}</p>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function loadMarketingCampaigns() {
  const el = document.getElementById('gr-campaigns');
  const data = await api('/marketing/campaigns').catch(() => null);
  const campaigns = data?.data || data || [];

  if (!Array.isArray(campaigns) || !campaigns.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">Sin campañas creadas. Creá tu primera campaña de marketing para fidelizar clientes.</div>';
    return;
  }

  el.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${campaigns.map(c => `
        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <p class="font-medium text-sm">${esc(c.nombre || c.name || '—')}</p>
            <span class="px-2 py-0.5 rounded-full text-xs ${c.estado === 'ACTIVA' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}">${c.estado || '—'}</span>
          </div>
          <p class="text-xs text-gray-500 mb-2">${esc(c.descripcion || c.description || '')}</p>
          <div class="flex justify-between text-xs text-gray-600">
            <span>Canal: ${esc(c.canal || '—')}</span>
            <span>Enviados: ${c.enviados || 0}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

async function sendReviewRequest() {
  const otId = document.getElementById('gr-ot-id')?.value?.trim();
  const channel = document.getElementById('gr-channel')?.value;
  if (!otId) { showToast('Ingresá el ID de la OT', 'error'); return; }
  try {
    await api('/marketing/reviews/request', { method: 'POST', body: { ordenTrabajoId: otId, canal: channel } });
    showToast('Solicitud de reseña enviada');
  } catch (e) { showToast(e.message || 'Error al enviar solicitud', 'error'); }
}

function saveLoyaltyConfig() {
  const config = {
    active: document.getElementById('gr-loyalty-active')?.checked,
    pointsPerAmount: parseInt(document.getElementById('gr-points-per')?.value) || 1,
    discountPerPoints: parseInt(document.getElementById('gr-discount-per')?.value) || 5,
  };
  localStorage.setItem('loyalty-config', JSON.stringify(config));
  showToast('Configuración de loyalty guardada');
}
