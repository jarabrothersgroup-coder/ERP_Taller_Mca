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
            <span class="text-gray-500 text-lg">🔍</span>
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
      search: '🔍', dashboard: '📊', ordenes: '📋', ingreso: '🚗',
      facturacion: '💰', inventario: '📦', contabilidad: '📒',
      tesoreria: '💳', payroll: '👥',
      'new-ot': '➕', 'new-client': '👤', close: '✖',
    };
    return icons[action] || '⚡';
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
