/* ═══════════════════════════════════════════════════════════════════
   P3.6 — Metabase Embedded Dashboard
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderMetabaseDashboard(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Metabase — Analytics Embebido</h2>
      <p class="text-sm text-gray-500">Dashboards interactivos de Metabase embebidos en el ERP</p>
    </div>

    <!-- Status Check -->
    <div id="mb-status" class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <div class="text-center py-4 text-gray-600 text-sm">Verificando conexión con Metabase...</div>
    </div>

    <!-- Dashboard Grid -->
    <div id="mb-dashboards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"></div>

    <!-- Embedded Frame -->
    <div id="mb-embed-container" class="hidden bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400" id="mb-embed-title">Dashboard</h3>
        <button onclick="closeEmbed()" class="text-gray-500 hover:text-white text-sm">✕ Cerrar</button>
      </div>
      <div class="w-full" style="height: 70vh;">
        <iframe id="mb-embed-iframe" class="w-full h-full border-0" src="" loading="lazy"></iframe>
      </div>
    </div>`;
}

async function loadMetabaseStatus() {
  const el = document.getElementById('mb-status');
  const dashboardsEl = document.getElementById('mb-dashboards');

  try {
    const [config, health] = await Promise.all([
      api('/analytics/metabase/config').catch(() => null),
      api('/analytics/metabase/health').catch(() => null)
    ]);

    if (!config?.configured) {
      el.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span class="text-sm text-yellow-400">Metabase no configurado</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">Configurá las variables de entorno para habilitar:</p>
        <div class="mt-2 bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-400">
          <p>METABASE_URL=https://metabase.tu-dominio.com</p>
          <p>METABASE_SECRET_KEY=tu-clave-secreta-hmac</p>
        </div>`;
      dashboardsEl.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-3 h-3 rounded-full ${health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}"></span>
        <span class="text-sm ${health?.status === 'healthy' ? 'text-green-400' : 'text-red-400'}">Metabase ${health?.status === 'healthy' ? 'conectado' : 'inaccesible'}</span>
        <span class="text-xs text-gray-600">· ${config.url || ''}</span>
      </div>`;

    // Render dashboard cards
    const dashboards = config.dashboards || [];
    dashboardsEl.innerHTML = dashboards.map(d => `
      <div onclick="openMetabaseDashboard(${d.id}, '${esc(d.name)}')" class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow cursor-pointer hover:border-blue-500/50 transition-all">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-sm">${esc(d.name)}</p>
            <p class="text-xs text-gray-500">${esc(d.description || '')}</p>
          </div>
        </div>
        <p class="text-xs text-blue-400">Click para abrir embebido →</p>
      </div>`).join('');

  } catch (e) {
    el.innerHTML = `<div class="text-red-400 text-sm">Error al verificar Metabase: ${esc(e.message)}</div>`;
  }
}

async function openMetabaseDashboard(dashboardId, name) {
  const container = document.getElementById('mb-embed-container');
  const iframe = document.getElementById('mb-embed-iframe');
  const title = document.getElementById('mb-embed-title');

  title.textContent = name;
  container.classList.remove('hidden');

  try {
    const result = await api('/analytics/metabase/embed-url', {
      method: 'POST',
      body: { resourceType: 'dashboard', resourceId: dashboardId }
    });
    if (result?.url) {
      iframe.src = result.url;
    } else {
      showToast('No se pudo generar URL embebida', 'error');
    }
  } catch (e) {
    showToast(e.message || 'Error al cargar dashboard', 'error');
  }

  container.scrollIntoView({ behavior: 'smooth' });
}

function closeEmbed() {
  const container = document.getElementById('mb-embed-container');
  const iframe = document.getElementById('mb-embed-iframe');
  container.classList.add('hidden');
  iframe.src = '';
}
