/**
 * Marketing — Campaign & Loyalty Module (Enhanced).
 *
 * Frontend module for:
 *   - Campaign management with creation modal
 *   - Loyalty program dashboard with tier display
 *   - Google Reviews overview with stats
 *
 * @module js/marketing
 */

/* global api, esc */

// ─── Marketing View ─────────────────────────

function renderMarketing(container) {
  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
      <h3 class="text-lg font-bold text-white">📢 Marketing & Fidelización</h3>

      <!-- Tabs -->
      <div class="flex gap-2 border-b border-gray-800 pb-2">
        <button onclick="marketingTab('campaigns')" class="marketing-tab px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400">Campañas</button>
        <button onclick="marketingTab('loyalty')" class="marketing-tab px-4 py-2 text-sm font-medium text-gray-500 hover:text-white transition">Fidelización</button>
        <button onclick="marketingTab('reviews')" class="marketing-tab px-4 py-2 text-sm font-medium text-gray-500 hover:text-white transition">Reseñas</button>
      </div>

      <!-- Campaigns Tab -->
      <div id="marketing-campaigns" class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-gray-300">Campañas</h4>
          <button onclick="marketingOpenCampaignModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Campaña</button>
        </div>
        <div id="marketing-campaign-list" class="space-y-2">
          <p class="text-gray-500 text-sm">Cargando campañas...</p>
        </div>
      </div>

      <!-- Loyalty Tab -->
      <div id="marketing-loyalty" class="hidden space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-gray-300">Programa de Fidelización</h4>
        </div>
        <!-- Tier Legend -->
        <div class="grid grid-cols-4 gap-3">
          <div class="bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
            <div class="text-lg">🥉</div>
            <div class="text-xs font-medium text-amber-400">BRONCE</div>
            <div class="text-[10px] text-gray-500">0-999 pts</div>
          </div>
          <div class="bg-gray-700/20 border border-gray-600/30 rounded-xl p-3 text-center">
            <div class="text-lg">🥈</div>
            <div class="text-xs font-medium text-gray-300">PLATA</div>
            <div class="text-[10px] text-gray-500">1,000-4,999 pts</div>
          </div>
          <div class="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-3 text-center">
            <div class="text-lg">🥇</div>
            <div class="text-xs font-medium text-yellow-400">ORO</div>
            <div class="text-[10px] text-gray-500">5,000-19,999 pts</div>
          </div>
          <div class="bg-purple-900/20 border border-purple-800/30 rounded-xl p-3 text-center">
            <div class="text-lg">💎</div>
            <div class="text-xs font-medium text-purple-400">PLATINO</div>
            <div class="text-[10px] text-gray-500">20,000+ pts</div>
          </div>
        </div>
        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
            <div class="text-2xl font-bold text-blue-400" id="loyalty-total">—</div>
            <div class="text-xs text-gray-500">Clientes</div>
          </div>
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
            <div class="text-2xl font-bold text-green-400" id="loyalty-points">—</div>
            <div class="text-xs text-gray-500">Puntos Totales</div>
          </div>
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
            <div class="text-2xl font-bold text-yellow-400" id="loyalty-rewards">—</div>
            <div class="text-xs text-gray-500">Recompensas</div>
          </div>
        </div>
        <!-- Rewards List -->
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h5 class="text-sm font-semibold text-gray-300 mb-3">Recompensas Disponibles</h5>
          <div id="marketing-rewards-list" class="space-y-2">
            <p class="text-gray-500 text-sm">Cargando recompensas...</p>
          </div>
        </div>
      </div>

      <!-- Reviews Tab -->
      <div id="marketing-reviews" class="hidden space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-gray-300">Reseñas de Google</h4>
          <div id="marketing-reviews-avg" class="flex items-center gap-2">
            <span class="text-yellow-400 text-lg">★</span>
            <span class="text-white font-bold" id="reviews-avg-rating">—</span>
            <span class="text-gray-500 text-xs" id="reviews-count">(0 reseñas)</span>
          </div>
        </div>
        <div id="marketing-reviews-list" class="space-y-2">
          <p class="text-gray-500 text-sm">Cargando reseñas...</p>
        </div>
      </div>
    </div>

    <!-- Campaign Modal -->
    <div id="marketing-campaign-modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 modal-content">
        <h3 class="text-lg font-bold text-white mb-4">Nueva Campaña</h3>
        <form id="marketing-campaign-form" class="space-y-4">
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre *</label>
            <input type="text" id="campaign-name" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required placeholder="Ej: Promoción de aceite">
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Tipo *</label>
            <select id="campaign-type" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Mensaje *</label>
            <textarea id="campaign-message" rows="4" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required placeholder="Escriba el mensaje de la campaña..."></textarea>
            <p class="text-[10px] text-gray-600 mt-1"><span id="campaign-char-count">0</span>/2000 caracteres</p>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Segmento (opcional)</label>
            <input type="text" id="campaign-segment" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Ej: clientes-frecuentes">
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Crear Campaña</button>
            <button type="button" onclick="marketingCloseCampaignModal()" class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Character counter
  document.getElementById('campaign-message')?.addEventListener('input', (e) => {
    const count = document.getElementById('campaign-char-count');
    if (count) count.textContent = e.target.value.length;
  });

  // Form submit
  document.getElementById('marketing-campaign-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _marketingCreateCampaign();
  });

  _marketingLoadCampaigns();
}

function marketingTab(tab) {
  ['campaigns', 'loyalty', 'reviews'].forEach(t => {
    const el = document.getElementById(`marketing-${t}`);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.marketing-tab').forEach(btn => {
    btn.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400');
    btn.classList.add('text-gray-500');
  });
  event.target.classList.add('text-blue-400', 'border-b-2', 'border-blue-400');
  event.target.classList.remove('text-gray-500');

  if (tab === 'campaigns') _marketingLoadCampaigns();
  if (tab === 'loyalty') _marketingLoadLoyalty();
  if (tab === 'reviews') _marketingLoadReviews();
}

// ─── Campaigns ──────────────────────────────

function marketingOpenCampaignModal() {
  document.getElementById('marketing-campaign-modal')?.classList.remove('hidden');
  document.getElementById('marketing-campaign-modal')?.classList.add('flex');
}

function marketingCloseCampaignModal() {
  document.getElementById('marketing-campaign-modal')?.classList.add('hidden');
  document.getElementById('marketing-campaign-modal')?.classList.remove('flex');
  document.getElementById('marketing-campaign-form')?.reset();
  const count = document.getElementById('campaign-char-count');
  if (count) count.textContent = '0';
}

async function _marketingCreateCampaign() {
  const data = {
    nombre: document.getElementById('campaign-name')?.value,
    tipo: document.getElementById('campaign-type')?.value,
    mensaje: document.getElementById('campaign-message')?.value,
    segmento: document.getElementById('campaign-segment')?.value || undefined,
  };

  try {
    await api('/marketing/campaigns', { method: 'POST', body: data });
    marketingCloseCampaignModal();
    await _marketingLoadCampaigns();
  } catch (err) {
    console.error('[Marketing] Error creating campaign:', err);
    alert('Error al crear la campaña');
  }
}

async function _marketingLoadCampaigns() {
  try {
    const data = await api('/marketing/campaigns');
    const list = document.getElementById('marketing-campaign-list');
    if (!list) return;

    if (!data?.length) {
      list.innerHTML = '<p class="text-gray-500 text-sm">No hay campañas creadas. Cree su primera campaña para empezar.</p>';
      return;
    }

    const tipoIcons = { whatsapp: '💬', email: '📧', sms: '📱' };
    const estadoColors = {
      borrador: 'bg-gray-700 text-gray-300',
      programada: 'bg-yellow-900/50 text-yellow-400',
      activa: 'bg-green-900/50 text-green-400',
      completada: 'bg-blue-900/50 text-blue-400',
      cancelada: 'bg-red-900/50 text-red-400',
    };

    list.innerHTML = data.map(c => `
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 flex items-center justify-between hover:border-gray-700 transition">
        <div class="flex items-center gap-3">
          <span class="text-xl">${tipoIcons[c.tipo] || '📢'}</span>
          <div>
            <p class="text-sm font-medium text-white">${esc(c.nombre)}</p>
            <p class="text-xs text-gray-500">${esc(c.tipo)} · ${c.totalEnv || 0} enviados</p>
          </div>
        </div>
        <span class="status-badge ${estadoColors[c.estado] || 'bg-gray-700 text-gray-300'}">${esc(c.estado || 'borrador')}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('[Marketing] Error loading campaigns:', err);
  }
}

// ─── Loyalty ────────────────────────────────

async function _marketingLoadLoyalty() {
  try {
    const stats = await api('/marketing/campaigns/stats');
    const totalEl = document.getElementById('loyalty-total');
    const pointsEl = document.getElementById('loyalty-points');
    const rewardsEl = document.getElementById('loyalty-rewards');
    if (totalEl) totalEl.textContent = stats?.totalClientes || '0';
    if (pointsEl) pointsEl.textContent = (stats?.totalPuntos || 0).toLocaleString();
    if (rewardsEl) rewardsEl.textContent = stats?.totalRecompensas || '0';

    // Load rewards
    const rewards = await api('/marketing/rewards');
    const rewardsList = document.getElementById('marketing-rewards-list');
    if (rewardsList && rewards?.length) {
      rewardsList.innerHTML = rewards.map(r => `
        <div class="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
          <div>
            <p class="text-sm text-white">${esc(r.nombre)}</p>
            <p class="text-xs text-gray-500">${esc(r.descripcion || '')}</p>
          </div>
          <span class="text-sm font-medium text-yellow-400">${r.puntosRequeridos} pts</span>
        </div>
      `).join('');
    } else if (rewardsList) {
      rewardsList.innerHTML = '<p class="text-gray-500 text-sm">No hay recompensas configuradas.</p>';
    }
  } catch (err) {
    console.error('[Marketing] Error loading loyalty:', err);
  }
}

// ─── Reviews ────────────────────────────────

async function _marketingLoadReviews() {
  try {
    const data = await api('/marketing/reviews');
    const list = document.getElementById('marketing-reviews-list');
    const avgEl = document.getElementById('reviews-avg-rating');
    const countEl = document.getElementById('reviews-count');

    if (!data?.length) {
      if (list) list.innerHTML = '<p class="text-gray-500 text-sm">No hay reseñas disponibles.</p>';
      return;
    }

    // Calculate average
    const avg = data.reduce((sum, r) => sum + (r.rating || 5), 0) / data.length;
    if (avgEl) avgEl.textContent = avg.toFixed(1);
    if (countEl) countEl.textContent = `(${data.length} reseñas)`;

    list.innerHTML = data.map(r => `
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-yellow-400">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</span>
            <span class="text-sm text-white">${esc(r.reviewerName || 'Anónimo')}</span>
          </div>
          <span class="text-xs text-gray-500">${esc(r.reviewDate || '')}</span>
        </div>
        <p class="text-sm text-gray-300">${esc(r.comment || '')}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('[Marketing] Error loading reviews:', err);
  }
}
