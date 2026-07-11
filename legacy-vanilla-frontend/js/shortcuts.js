/* ─── Keyboard Shortcuts + Command Palette ──── */
/* Global shortcuts + Ctrl+K command palette      */

(function() {
  'use strict';

  const SHORTCUTS = [
    { key: 'k', ctrl: true, action: 'search', label: 'Buscar', view: null },
    { key: '1', ctrl: true, action: 'dashboard', label: 'Dashboard', view: 'dashboard' },
    { key: '2', ctrl: true, action: 'ordenes', label: 'Órdenes', view: 'ordenes' },
    { key: '3', ctrl: true, action: 'ingreso', label: 'Ingreso', view: 'ingreso' },
    { key: '4', ctrl: true, action: 'facturacion', label: 'Facturación', view: 'facturacion' },
    { key: '5', ctrl: true, action: 'inventario', label: 'Inventario', view: 'inventario' },
    { key: '6', ctrl: true, action: 'contabilidad', label: 'Contabilidad', view: 'contabilidad' },
    { key: '7', ctrl: true, action: 'tesoreria', label: 'Tesorería', view: 'tesoreria' },
    { key: 'n', ctrl: true, action: 'new-ot', label: 'Nueva OT', view: 'ordenes' },
    { key: 'i', ctrl: true, action: 'new-client', label: 'Nuevo Cliente', view: 'ingreso' },
    { key: 'p', ctrl: true, action: 'payroll', label: 'Nómina', view: 'nomina' },
    { key: 'Escape', ctrl: false, action: 'close', label: 'Cerrar modal' },
  ];

  // ─── Command Palette State ───────────────────

  let paletteOpen = false;

  function createPalette() {
    if (document.getElementById('command-palette')) return;

    const palette = document.createElement('div');
    palette.id = 'command-palette';
    palette.className = 'fixed inset-0 z-[9999] hidden';
    palette.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" id="palette-overlay"></div>
      <div class="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg mx-4">
        <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              id="palette-input"
              type="text"
              class="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              placeholder="Escribí un comando..."
              autocomplete="off"
              aria-label="Buscar comando"
            >
            <kbd class="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">ESC</kbd>
          </div>
          <div id="palette-results" class="max-h-80 overflow-y-auto py-2"></div>
          <div class="px-4 py-2 border-t border-gray-800 text-[11px] text-gray-600 flex justify-between">
            <span>↑↓ navegar · Enter seleccionar · Esc cerrar</span>
            <span>${SHORTCUTS.length} comandos</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(palette);

    // Event listeners
    const input = document.getElementById('palette-input');
    const overlay = document.getElementById('palette-overlay');
    const results = document.getElementById('palette-results');

    overlay.addEventListener('click', closePalette);
    input.addEventListener('input', () => filterCommands(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePalette(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
      if (e.key === 'Enter') { e.preventDefault(); executeSelected(); }
    });

    renderCommands(SHORTCUTS);
  }

  function renderCommands(commands) {
    const results = document.getElementById('palette-results');
    if (!results) return;

    results.innerHTML = commands.map((cmd, i) => `
      <button
        class="palette-item w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-600/10 transition text-sm ${i === 0 ? 'bg-blue-600/10' : ''}"
        data-index="${i}"
        data-action="${cmd.action}"
        data-view="${cmd.view || ''}"
        role="option"
        aria-selected="${i === 0}"
      >
        <span class="text-gray-400 w-5 text-center">${getIcon(cmd.action)}</span>
        <span class="flex-1 text-gray-300">${cmd.label}</span>
        <kbd class="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">${formatKey(cmd)}</kbd>
      </button>
    `).join('');

    // Click handlers
    results.querySelectorAll('.palette-item').forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const view = item.dataset.view;
        executeAction(action, view);
      });
    });
  }

  function filterCommands(query) {
    const filtered = SHORTCUTS.filter((cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.action.toLowerCase().includes(query.toLowerCase())
    );
    renderCommands(filtered);
  }

  let selectedIndex = 0;

  function moveSelection(delta) {
    const items = document.querySelectorAll('.palette-item');
    if (items.length === 0) return;

    items[selectedIndex]?.setAttribute('aria-selected', 'false');
    items[selectedIndex]?.classList.remove('bg-blue-600/10');

    selectedIndex = (selectedIndex + delta + items.length) % items.length;

    items[selectedIndex]?.setAttribute('aria-selected', 'true');
    items[selectedIndex]?.classList.add('bg-blue-600/10');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function executeSelected() {
    const items = document.querySelectorAll('.palette-item');
    const selected = items[selectedIndex];
    if (selected) {
      executeAction(selected.dataset.action, selected.dataset.view);
    }
  }

  function executeAction(action, view) {
    closePalette();

    if (action === 'search') {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.focus();
      return;
    }

    if (action === 'close') {
      const modal = document.getElementById('modal-overlay');
      if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
      return;
    }

    if (view && typeof window.navigate === 'function') {
      window.navigate(view);
    }
  }

  function getIcon(action) {
    const icons = {
      search: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
      dashboard: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
      ordenes: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
      ingreso: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
      facturacion: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
      inventario: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
      contabilidad: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>',
      tesoreria: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>',
      payroll: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
      'new-ot': '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
      'new-client': '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>',
      close: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    };
    return icons[action] || '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
  }

  function formatKey(cmd) {
    const parts = [];
    if (cmd.ctrl) parts.push('Ctrl');
    parts.push(cmd.key.toUpperCase());
    return parts.join('+');
  }

  function openPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette) createPalette();
    const el = document.getElementById('command-palette');
    el.classList.remove('hidden');
    const input = document.getElementById('palette-input');
    if (input) { input.value = ''; input.focus(); }
    selectedIndex = 0;
    paletteOpen = true;
    renderCommands(SHORTCUTS);
  }

  function closePalette() {
    const el = document.getElementById('command-palette');
    if (el) el.classList.add('hidden');
    paletteOpen = false;
  }

  // ─── Global Keyboard Handler ─────────────────

  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+K — always open search/palette
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (paletteOpen) { closePalette(); }
      else { openPalette(); }
      return;
    }

    // Escape — close palette or modal
    if (e.key === 'Escape') {
      if (paletteOpen) { closePalette(); return; }
      const modal = document.getElementById('modal-overlay');
      if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
      return;
    }

    // Don't process shortcuts while in inputs (except Ctrl combos)
    if (isInput && !e.ctrlKey && !e.metaKey) return;

    // Ctrl+number — navigate to views
    if (e.ctrlKey || e.metaKey) {
      const num = e.key;
      if (num >= '1' && num <= '9') {
        const views = ['dashboard', 'ordenes', 'ingreso', 'facturacion', 'inventario', 'contabilidad', 'tesoreria', 'nomina', 'config'];
        const index = parseInt(num) - 1;
        if (views[index]) {
          e.preventDefault();
          if (typeof window.navigate === 'function') {
            window.navigate(views[index]);
          }
        }
      }
    }
  });

  // ─── Initialize ──────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    createPalette();
  });

  // ─── Expose ──────────────────────────────────
  window.openCommandPalette = openPalette;
  window.closeCommandPalette = closePalette;

})();
