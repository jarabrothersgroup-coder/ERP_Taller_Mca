/**
 * Search Module — Global Ctrl+K search bar.
 *
 * Provides a universal search interface that queries across
 * vehicles, clients, and work orders with keyboard navigation.
 *
 * @module js/search
 */

/* global state, api, esc, navigate */

// ─── State ──────────────────────────────────────

let searchTimeout = null;
let searchOpen = false;

// ─── Render ─────────────────────────────────────

/**
 * Injects the search bar into the header.
 * Called from init() in app.js.
 */
function initSearchBar() {
  const headerRight = document.querySelector('#view-content')?.closest('main')?.querySelector('header .flex.items-center.gap-4');
  if (!headerRight || document.getElementById('global-search-container')) return;

  const container = document.createElement('div');
  container.id = 'global-search-container';
  container.className = 'relative';
  container.innerHTML = `
    <button id="search-trigger" class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:border-blue-500 hover:text-white transition cursor-pointer" title="Buscar (Ctrl+K)">
      <span>🔍</span>
      <span class="hidden md:inline">Buscar</span>
      <kbd class="hidden md:inline text-[10px] text-gray-500 border border-gray-600 rounded px-1 py-0.5 font-mono">Ctrl+K</kbd>
    </button>
    <div id="search-dropdown" class="hidden absolute right-0 top-full mt-2 w-[420px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div class="p-3 border-b border-gray-800">
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input id="search-input" type="text" placeholder="Buscar vehículos, clientes, órdenes..." class="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" autocomplete="off" />
        </div>
      </div>
      <div id="search-results" class="max-h-[320px] overflow-y-auto p-2"></div>
      <div class="px-3 py-2 border-t border-gray-800 text-[11px] text-gray-500 flex items-center justify-between">
        <span><kbd class="border border-gray-600 rounded px-1 py-0.5 font-mono">↑↓</kbd> navegar · <kbd class="border border-gray-600 rounded px-1 py-0.5 font-mono">Enter</kbd> seleccionar · <kbd class="border border-gray-600 rounded px-1 py-0.5 font-mono">Esc</kbd> cerrar</span>
      </div>
    </div>
    <!-- Export dropdown -->
    <div id="export-container" class="relative">
      <button id="export-trigger" class="flex items-center gap-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:border-green-500 hover:text-green-400 transition cursor-pointer" title="Exportar CSV">
        <span>📥</span>
        <span class="hidden md:inline">Exportar</span>
      </button>
      <div id="export-dropdown" class="hidden absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
        <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">Exportar CSV</div>
        <button class="export-option w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition" data-table="vehiculos">🚗 Vehículos</button>
        <button class="export-option w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition" data-table="clientes">👤 Clientes</button>
        <button class="export-option w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition" data-table="ordenes">📋 Órdenes de Trabajo</button>
      </div>
    </div>
  `;

  // Insert as first child of header-right (before notif bell)
  headerRight.insertBefore(container, headerRight.firstChild);

  // ─── Events ────────────────────────
  document.getElementById('search-trigger')?.addEventListener('click', toggleSearch);
  document.getElementById('search-input')?.addEventListener('input', onSearchInput);
  document.getElementById('search-input')?.addEventListener('keydown', onSearchKeydown);

  // Ctrl+K global shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearch();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('search-dropdown');
    const trigger = document.getElementById('search-trigger');
    if (searchOpen && !dropdown?.contains(e.target) && !trigger?.contains(e.target)) {
      closeSearch();
    }
    // Close export dropdown
    const exportDropdown = document.getElementById('export-dropdown');
    const exportTrigger = document.getElementById('export-trigger');
    if (exportDropdown && !exportDropdown.classList.contains('hidden') && !exportDropdown.contains(e.target) && !exportTrigger?.contains(e.target)) {
      exportDropdown.classList.add('hidden');
    }
  });

  // Export trigger
  document.getElementById('export-trigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('export-dropdown');
    dd?.classList.toggle('hidden');
  });

  // Export options
  document.querySelectorAll('.export-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = btn.dataset.table;
      if (table) downloadCsvExport(table);
      document.getElementById('export-dropdown')?.classList.add('hidden');
    });
  });
}

// ─── Toggle ─────────────────────────────────────

function toggleSearch() {
  if (searchOpen) {
    closeSearch();
  } else {
    openSearch();
  }
}

function openSearch() {
  searchOpen = true;
  const dropdown = document.getElementById('search-dropdown');
  const input = document.getElementById('search-input');
  dropdown?.classList.remove('hidden');
  input?.focus();
  input.value = '';
  document.getElementById('search-results').innerHTML = renderEmptyState('Escriba para buscar...');
}

function closeSearch() {
  searchOpen = false;
  document.getElementById('search-dropdown')?.classList.add('hidden');
  if (searchTimeout) { clearTimeout(searchTimeout); searchTimeout = null; }
}

// ─── Search ─────────────────────────────────────

let searchHighlightIndex = -1;

function onSearchInput(e) {
  const q = e.target.value.trim();
  if (searchTimeout) clearTimeout(searchTimeout);

  if (q.length < 1) {
    document.getElementById('search-results').innerHTML = renderEmptyState('Escriba para buscar...');
    return;
  }

  // Debounce 300ms
  document.getElementById('search-results').innerHTML = '<div class="flex items-center justify-center py-6 text-gray-500 text-sm">Buscando...</div>';
  searchTimeout = setTimeout(async () => {
    try {
      const data = await api(`/api/v1/search?q=${encodeURIComponent(q)}&limit=5`);
      renderSearchResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      document.getElementById('search-results').innerHTML = renderEmptyState('Error al buscar');
    }
  }, 300);
}

// ─── Keyboard navigation ────────────────────────

function onSearchKeydown(e) {
  const items = document.querySelectorAll('.search-result-item');

  if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchHighlightIndex = Math.min(searchHighlightIndex + 1, items.length - 1);
    updateHighlight(items);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchHighlightIndex = Math.max(searchHighlightIndex - 1, 0);
    updateHighlight(items);
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    if (searchHighlightIndex >= 0 && items[searchHighlightIndex]) {
      items[searchHighlightIndex].click();
    }
    return;
  }
}

function updateHighlight(items) {
  items.forEach((item, i) => {
    if (i === searchHighlightIndex) {
      item.classList.add('bg-gray-800');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-gray-800');
    }
  });
}

// ─── Render results ─────────────────────────────

function renderSearchResults(results) {
  searchHighlightIndex = -1;
  const container = document.getElementById('search-results');

  if (results.length === 0) {
    container.innerHTML = renderEmptyState('Sin resultados');
    return;
  }

  const typeIcons = { vehiculo: '🚗', cliente: '👤', orden: '📋' };
  const typeLabels = { vehiculo: 'Vehículo', cliente: 'Cliente', orden: 'OT' };

  let html = '';
  let lastType = '';

  for (const r of results) {
    // Group header
    if (r.type !== lastType) {
      html += `<div class="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">${typeIcons[r.type] || '📄'} ${typeLabels[r.type] || r.type}</div>`;
      lastType = r.type;
    }

    html += `
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 transition group" data-type="${esc(r.type)}" data-id="${esc(r.id)}">
        <button class="search-result-item flex-1 flex items-center gap-3 text-left min-w-0" data-route="${esc(r.route)}" data-type="${esc(r.type)}" data-id="${esc(r.id)}">
          <span class="text-lg flex-shrink-0">${typeIcons[r.type] || '📄'}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-white truncate">${esc(r.title)}</p>
            <p class="text-xs text-gray-500 truncate">${esc(r.subtitle)}</p>
          </div>
        </button>
        ${(r.type === 'vehiculo' || r.type === 'cliente') ? `<button class="history-btn text-gray-600 hover:text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition flex-shrink-0 px-2" data-type="${esc(r.type)}" data-id="${esc(r.id)}" title="Ver historial">📋</button>` : ''}
      </div>
    `;
  }

  container.innerHTML = html;

  // Attach click handlers
  container.querySelectorAll('.search-result-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const route = btn.dataset.route;
      if (route) {
        closeSearch();
        navigate(route);
      }
    });
  });

  // History buttons
  container.querySelectorAll('.history-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      closeSearch();
      if (type === 'vehiculo' && typeof showVehicleHistory === 'function') {
        showVehicleHistory(id);
      } else if (type === 'cliente' && typeof showClientHistory === 'function') {
        showClientHistory(id);
      }
    });
  });
}

function renderEmptyState(msg) {
  return `<div class="flex flex-col items-center justify-center py-8 text-gray-500 text-sm">
    <span class="text-2xl mb-2">🔍</span>
    <span>${msg}</span>
  </div>`;
}

// ─── CSV Export ─────────────────────────────────

function downloadCsvExport(table) {
  if (typeof showToast === 'function') showToast(`Descargando ${table}...`, 'info', 2000);
  // Create a hidden link and trigger download
  const a = document.createElement('a');
  a.href = `/api/v1/export/${encodeURIComponent(table)}`;
  a.style.display = 'none';
  // Add headers via fetch to include auth headers
  fetch(a.href, {
    headers: {
      'X-Tenant-Slug': state?.auth?.slug || '',
      'X-User-Email': state?.auth?.profile?.email || '',
    },
  }).then(res => {
    if (!res.ok) throw new Error('Error al exportar');
    return res.blob();
  }).then(blob => {
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${table}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`${table} exportado correctamente`, 'success');
  }).catch(err => {
    console.error('Export error:', err);
    if (typeof showToast === 'function') showToast(`Error al exportar: ${err.message}`, 'error');
  });
}

// ─── Expose to global scope ─────────────────────

window.initSearchBar = initSearchBar;
