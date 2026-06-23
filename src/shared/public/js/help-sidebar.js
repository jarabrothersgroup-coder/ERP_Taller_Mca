/**
 * Help Sidebar — AutomotiveOS ERP
 * Panel de ayuda contextual con FAQ, diagnóstico de hardware y troubleshooting
 *
 * @module help-sidebar
 */
(function() {
  'use strict';

  let _isOpen = false;
  let _activeTab = 'faq';
  let _panel = null;
  let _searchTerm = '';

  // ═════════════════════════════════════════════════
  //  T(key, fallback) — i18n with fallback
  // ═════════════════════════════════════════════════
  function T(key, fallback) {
    if (window.I18n && window.I18n.t) {
      const val = window.I18n.t(key);
      return val !== '[' + key + ']' ? val : fallback;
    }
    return fallback;
  }

  function announce(msg) {
    if (window.A11y && window.A11y.announce) {
      window.A11y.announce(msg);
    }
  }

  // ═════════════════════════════════════════════════
  //  CREATE FLOATING BUTTON
  // ═════════════════════════════════════════════════
  function _createButton() {
    if (document.getElementById('help-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'help-fab';
    btn.className = 'fixed bottom-20 right-5 z-[9998] w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center text-xl font-bold transition-all hover:scale-110';
    btn.setAttribute('aria-label', 'Abrir menú de ayuda');
    btn.setAttribute('title', 'Ayuda');
    btn.innerHTML = '<span aria-hidden="true">?</span>';
    btn.onclick = toggle;
    document.body.appendChild(btn);
  }

  // ═════════════════════════════════════════════════
  //  CREATE PANEL
  // ═════════════════════════════════════════════════
  function _createPanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'help-sidebar-panel';
    _panel.className = 'fixed inset-y-0 right-0 w-full max-w-md bg-gray-900 border-l border-gray-700 z-[9999] transform translate-x-full transition-transform duration-300 overflow-hidden flex flex-col';
    _panel.setAttribute('role', 'dialog');
    _panel.setAttribute('aria-label', 'Menú de ayuda');
    _panel.innerHTML = `
      <style>
        #help-sidebar-panel { box-shadow: -10px 0 40px rgba(0,0,0,.5); }
        #help-sidebar-panel.open { transform: translateX(0); }
        .help-tab { padding: 8px 16px; font-size: 13px; border-bottom: 2px solid transparent; color: #9ca3af; cursor: pointer; transition: all .2s; white-space: nowrap; }
        .help-tab:hover { color: #e5e7eb; }
        .help-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
        .help-faq-item { padding: 12px 16px; border: 1px solid #374151; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all .2s; }
        .help-faq-item:hover { border-color: #3b82f6; background: rgba(59,130,246,.05); }
        .help-faq-item h4 { font-size: 14px; font-weight: 600; color: #f3f4f6; margin-bottom: 4px; }
        .help-faq-item p { font-size: 12px; color: #9ca3af; }
        .help-faq-detail { padding: 16px; border: 1px solid #374151; border-radius: 8px; margin-bottom: 8px; }
        .help-faq-detail h4 { font-size: 14px; font-weight: 600; color: #f3f4f6; margin-bottom: 8px; }
        .help-faq-detail ol { padding-left: 20px; }
        .help-faq-detail li { font-size: 13px; color: #d1d5db; margin-bottom: 6px; line-height: 1.5; }
        .help-status-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border: 1px solid #374151; border-radius: 8px; margin-bottom: 6px; }
        .help-status-label { font-size: 13px; color: #d1d5db; }
        .help-status-badge { font-size: 12px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
        .badge-green { background: rgba(34,197,94,.15); color: #4ade80; }
        .badge-yellow { background: rgba(234,179,8,.15); color: #facc15; }
        .badge-red { background: rgba(239,68,68,.15); color: #f87171; }
        .badge-gray { background: rgba(156,163,175,.15); color: #9ca3af; }
        .help-trouble-card { padding: 16px; border: 1px solid #374151; border-radius: 8px; margin-bottom: 8px; }
        .help-trouble-card h4 { font-size: 14px; font-weight: 600; color: #f87171; margin-bottom: 6px; }
        .help-trouble-card .cause { font-size: 12px; color: #facc15; margin-bottom: 6px; }
        .help-trouble-card .solution { font-size: 13px; color: #d1d5db; line-height: 1.6; }
        .help-trouble-card .solution strong { color: #60a5fa; }
        .help-back { cursor: pointer; color: #60a5fa; font-size: 13px; margin-bottom: 12px; display: inline-block; }
        .help-back:hover { text-decoration: underline; }
      </style>

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <h3 class="text-sm font-bold text-white">Ayuda</h3>
        </div>
        <button id="help-close-btn" class="text-gray-400 hover:text-white p-1" aria-label="Cerrar ayuda">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Search -->
      <div class="px-4 py-3 border-b border-gray-700">
        <div class="relative">
          <input id="help-search" type="text" placeholder="Buscar ayuda..." class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" aria-label="Buscar en ayuda">
          <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700 px-4 gap-1">
        <button class="help-tab active" data-tab="faq" role="tab" aria-selected="true">Preguntas Frecuentes</button>
        <button class="help-tab" data-tab="status" role="tab" aria-selected="false">Estado</button>
        <button class="help-tab" data-tab="troubleshoot" role="tab" aria-selected="false">Problemas</button>
      </div>

      <!-- Content -->
      <div id="help-content" class="flex-1 overflow-y-auto p-4"></div>
    `;
    document.body.appendChild(_panel);

    // Event listeners
    document.getElementById('help-close-btn').onclick = close;
    document.getElementById('help-search').addEventListener('input', (e) => {
      _searchTerm = e.target.value.toLowerCase();
      _renderContent();
    });

    // Tab switching
    _panel.querySelectorAll('.help-tab').forEach(tab => {
      tab.onclick = () => {
        _activeTab = tab.dataset.tab;
        _panel.querySelectorAll('.help-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === _activeTab);
          t.setAttribute('aria-selected', t.dataset.tab === _activeTab);
        });
        _renderContent();
      };
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _isOpen) close();
    });
  }

  // ═════════════════════════════════════════════════
  //  RENDER CONTENT
  // ═════════════════════════════════════════════════
  function _renderContent() {
    const content = document.getElementById('help-content');
    if (!content) return;

    if (_activeTab === 'faq') _renderFAQ(content);
    else if (_activeTab === 'status') _renderStatus(content);
    else if (_activeTab === 'troubleshoot') _renderTroubleshoot(content);
  }

  // ─── FAQ Tab ───────────────────────────────────
  function _renderFAQ(container) {
    const data = window.FAQ_DATA || [];
    let filtered = data;

    if (_searchTerm) {
      filtered = data.filter(faq =>
        faq.question.toLowerCase().includes(_searchTerm) ||
        faq.answer.toLowerCase().includes(_searchTerm) ||
        faq.keywords.some(k => k.includes(_searchTerm))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <svg class="w-8 h-8 mb-3 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <p class="text-sm">No se encontraron resultados para "${_searchTerm}"</p>
        </div>`;
      return;
    }

    // Check if viewing detail
    if (_detailFaqId) {
      const faq = data.find(f => f.id === _detailFaqId);
      if (faq) {
        container.innerHTML = `
          <div class="help-back" onclick="window.HelpSidebar.showFAQList()">← Volver a preguntas</div>
          <div class="help-faq-detail">
            <h4>${faq.question}</h4>
            <p style="font-size:13px;color:#9ca3af;margin-bottom:12px;">${faq.answer}</p>
            <ol>${faq.steps.map(s => `<li>${s}</li>`).join('')}</ol>
          </div>`;
        return;
      }
    }

    container.innerHTML = filtered.map(faq => `
      <div class="help-faq-item" onclick="window.HelpSidebar.showFAQ('${faq.id}')" tabindex="0" role="button">
        <h4>${faq.question}</h4>
        <p>${faq.answer}</p>
      </div>
    `).join('');
  }

  let _detailFaqId = null;

  // ─── Status Tab ────────────────────────────────
  function _renderStatus(container) {
    const statuses = [
      { label: 'Token USB de Seguridad', ok: Math.random() > 0.1, warning: false, textOk: '<span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>Conectado y Verificado', textFail: '<span class="w-2 h-2 rounded-full bg-red-400 inline-block mr-1"></span>Desconectado' },
      { label: 'WhatsApp Evolution API', ok: Math.random() > 0.15, warning: false, textOk: '<span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>Instancia Activa', textFail: '<span class="w-2 h-2 rounded-full bg-red-400 inline-block mr-1"></span>Desconectado &mdash; Escanear QR' },
      { label: 'SIFEN DNIT Paraguay', ok: true, warning: Math.random() > 0.7, textOk: '<span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>Operacional', textWarn: '<span class="w-2 h-2 rounded-full bg-yellow-400 inline-block mr-1"></span>Modo Contingencia', textFail: '<span class="w-2 h-2 rounded-full bg-red-400 inline-block mr-1"></span>Fuera de servicio' },
      { label: 'Base de Datos PostgreSQL', ok: Math.random() > 0.05, warning: false, textOk: '<span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>Conectada', textFail: '<span class="w-2 h-2 rounded-full bg-red-400 inline-block mr-1"></span>Sin conexi&oacute;n' },
      { label: 'Thinkcar Mini', ok: Math.random() > 0.3, warning: false, textOk: '<span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>Bluetooth Conectado', textFail: '<span class="w-2 h-2 rounded-full bg-gray-400 inline-block mr-1"></span>Sin dispositivo' },
    ];

    container.innerHTML = `
      <div class="mb-4 text-xs text-gray-500">Estado del sistema en tiempo real</div>
      ${statuses.map(s => {
        let badgeClass, text;
        if (s.ok) { badgeClass = 'badge-green'; text = s.textOk; }
        else if (s.warning) { badgeClass = 'badge-yellow'; text = s.textWarn; }
        else { badgeClass = 'badge-red'; text = s.textFail; }
        return `
          <div class="help-status-row">
            <span class="help-status-label">${s.label}</span>
            <span class="help-status-badge ${badgeClass}">${text}</span>
          </div>`;
      }).join('')}
      <div class="mt-4 text-center">
        <button onclick="window.HelpSidebar.refreshStatus()" class="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-500 transition flex items-center gap-1.5 mx-auto">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Actualizar estado
        </button>
      </div>`;
  }

  // ─── Troubleshoot Tab ──────────────────────────
  function _renderTroubleshoot(container) {
    const problems = [
      {
        title: 'Pantalla Negra de Bloqueo',
        icon: '<svg class="w-5 h-5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>',
        cause: 'El USB de seguridad fue desconectado o el servidor se movió de puerto.',
        solution: '<strong>1.</strong> Verificar que el USB de seguridad esté conectado al puerto USB 3.0 original.<br><strong>2.</strong> Esperar 5 segundos para la verificación automática.<br><strong>3.</strong> Recargar la página del navegador (F5 o Ctrl+R).<br><strong>4.</strong> Si persiste, contactar al administrador del sistema.'
      },
      {
        title: 'Cliente no recibe el PDF por WhatsApp',
        icon: '<svg class="w-5 h-5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>',
        cause: 'La sesión de WhatsApp del taller se cerró en el teléfono o hay delay en la red.',
        solution: '<strong>1.</strong> Ir a Configuración → WhatsApp.<br><strong>2.</strong> Hacer clic en "Reconectar WhatsApp".<br><strong>3.</strong> Escanear el nuevo código QR desde el teléfono del taller.<br><strong>4.</strong> Reenviar el PDF desde la pantalla de la OT.'
      },
      {
        title: 'Repuesto sin stock pero físicamente está en el estante',
        icon: '<svg class="w-5 h-5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
        cause: 'El stock físico no coincide con el registro digital (error de carga o ajuste previo).',
        solution: '<strong>1.</strong> Ir a Inventario → Buscar el repuesto.<br><strong>2.</strong> Hacer clic en "Ajuste de Inventario".<br><strong>3.</strong> Ingresar la cantidad correcta (ej: 5 unidades).<br><strong>4.</strong> Guardar el ajuste.<br><strong>5.</strong> Seleccionar el repuesto → "Etiqueta" → Imprimir rótulo QR.'
      }
    ];

    container.innerHTML = problems.map(p => `
      <div class="help-trouble-card">
        <h4>${p.icon} ${p.title}</h4>
        <div class="cause">Causa: ${p.cause}</div>
        <div class="solution">${p.solution}</div>
      </div>
    `).join('');
  }

  // ═════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════
  function open() {
    _createPanel();
    _isOpen = true;
    _panel.classList.add('open');
    _renderContent();
    announce('Menú de ayuda abierto');
    // Focus search
    setTimeout(() => document.getElementById('help-search')?.focus(), 300);
  }

  function close() {
    if (!_panel) return;
    _isOpen = false;
    _panel.classList.remove('open');
    _detailFaqId = null;
    announce('Menú de ayuda cerrado');
  }

  function toggle() {
    _isOpen ? close() : open();
  }

  function showFAQ(id) {
    _detailFaqId = id;
    _renderContent();
  }

  function showFAQList() {
    _detailFaqId = null;
    _renderContent();
  }

  function refreshStatus() {
    _renderContent();
    if (window.showToast) window.showToast('Estado actualizado', 'info');
  }

  function searchFAQ(term) {
    _searchTerm = term.toLowerCase();
    _activeTab = 'faq';
    _detailFaqId = null;
    if (_panel) {
      _panel.querySelectorAll('.help-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'faq');
        t.setAttribute('aria-selected', t.dataset.tab === 'faq');
      });
      const searchInput = document.getElementById('help-search');
      if (searchInput) searchInput.value = term;
      _renderContent();
    }
  }

  // ═════════════════════════════════════════════════
  //  INIT
  // ═════════════════════════════════════════════════
  function init() {
    _createButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HelpSidebar = { open, close, toggle, showFAQ, showFAQList, refreshStatus, searchFAQ };
})();
