/* ─── Accessibility Module ──────────────────── */
/* ARIA labels, keyboard nav, focus management,  */
/* empty states, screen reader support            */

(function() {
  'use strict';

  // ═════════════════════════════════════════════════
  //  LIVE REGION (Screen Reader Announcements)
  // ═════════════════════════════════════════════════

  let liveRegion = null;

  function getLiveRegion() {
    if (liveRegion) return liveRegion;
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
    return liveRegion;
  }

  /**
   * Announce a message to screen readers.
   * @param {string} message - Message to announce
   * @param {'polite'|'assertive'} priority - Urgency level
   */
  function announce(message, priority = 'polite') {
    const region = getLiveRegion();
    region.setAttribute('aria-live', priority);
    region.textContent = '';
    // Force DOM update for screen readers
    requestAnimationFrame(() => { region.textContent = message; });
  }

  // ═════════════════════════════════════════════════
  //  FOCUS MANAGEMENT
  // ═════════════════════════════════════════════════

  let previousFocus = null;

  /**
   * Trap focus within a container (for modals).
   * @param {HTMLElement} container - Container to trap focus in
   */
  function trapFocus(container) {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Save current focus
    previousFocus = document.activeElement;

    // Focus first element
    first.focus();

    container.addEventListener('keydown', function handler(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }

      // Cleanup on Escape
      if (e.key === 'Escape') {
        container.removeEventListener('keydown', handler);
        releaseFocus();
      }
    });
  }

  /**
   * Release focus trap and restore previous focus.
   */
  function releaseFocus() {
    if (previousFocus && previousFocus.focus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  // ═════════════════════════════════════════════════
  //  KEYBOARD NAVIGATION
  // ═════════════════════════════════════════════════

  /**
   * Add keyboard navigation to sidebar.
   * Arrow keys move between items, Enter/Space activates.
   */
  function initSidebarKeyboard() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const items = sidebar.querySelectorAll('.sidebar-item');
    if (items.length === 0) return;

    sidebar.addEventListener('keydown', (e) => {
      const current = document.activeElement;
      const index = Array.from(items).indexOf(current);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[(index + 1) % items.length];
        next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[(index - 1 + items.length) % items.length];
        prev.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    });
  }

  /**
   * Close modals on Escape key.
   */
  function initEscapeHandler() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('modal-overlay');
        if (modal && !modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
          releaseFocus();
          const msg = window.I18n ? window.I18n.t('a11y.dialogoCerrado') : 'Diálogo cerrado';
          announce(msg);
        }
      }
    });
  }

  // ═════════════════════════════════════════════════
  //  EMPTY STATE COMPONENT
  // ═════════════════════════════════════════════════

  /**
   * Render an accessible empty state.
   * @param {object} options - Configuration
   * @param {string} options.icon - Emoji icon
   * @param {string} options.title - Main message
   * @param {string} options.description - Additional context
   * @param {string} [options.actionText] - Action button text
   * @param {string} [options.actionId] - Action button ID
   * @returns {string} HTML string
   */
  function renderEmptyState({ icon, title, description, actionText, actionId }) {
    return `
      <div class="flex flex-col items-center justify-center py-16 px-4 text-center" role="status">
        <span class="text-5xl mb-4" aria-hidden="true">${icon}</span>
        <h3 class="text-lg font-semibold text-gray-300 mb-2">${title}</h3>
        <p class="text-sm text-gray-500 max-w-md mb-6">${description}</p>
        ${actionText ? `
          <button id="${actionId || ''}" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">
            ${actionText}
          </button>
        ` : ''}
      </div>
    `;
  }

  // ═════════════════════════════════════════════════
  //  ARIA LABEL ENHANCEMENTS
  // ═════════════════════════════════════════════════

  /**
   * Auto-add ARIA labels to elements missing them.
   */
  function enhanceAriaLabels() {
    // Sidebar navigation
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.setAttribute('role', 'navigation');
      sidebar.setAttribute('aria-label', window.I18n ? window.I18n.t('a11y.menuPrincipal') : 'Menú principal');
    }

    // Main content area
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('role', 'main');
      main.setAttribute('aria-label', window.I18n ? window.I18n.t('a11y.contenidoPrincipal') : 'Contenido principal');
    }

    // Modal overlay
    const modal = document.getElementById('modal-overlay');
    if (modal) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'modal-title');
    }

    // Sidebar items — add aria-current for active
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      item.setAttribute('role', 'menuitem');
      if (item.classList.contains('active')) {
        item.setAttribute('aria-current', 'page');
      }
    });

    // Buttons without text — auto-label from title, onclick, or SVG context
    document.querySelectorAll('button:not([aria-label])').forEach((btn) => {
      const text = btn.textContent?.trim();
      if (!text || text.length < 2) {
        // 1. Try title attribute
        const title = btn.getAttribute('title');
        if (title) {
          btn.setAttribute('aria-label', title);
          return;
        }
        // 2. Try to infer from onclick handler name (e.g., "crmCloseDetail" → "Cerrar detalle")
        const onclick = btn.getAttribute('onclick') || '';
        const fnMatch = onclick.match(/(\w+)\(/);
        if (fnMatch) {
          const fn = fnMatch[1];
          const labels = {
            close: 'Cerrar', dismiss: 'Descartar', cancel: 'Cancelar',
            delete: 'Eliminar', remove: 'Eliminar', edit: 'Editar',
            save: 'Guardar', submit: 'Enviar', refresh: 'Actualizar',
            search: 'Buscar', filter: 'Filtrar', sort: 'Ordenar',
            prev: 'Anterior', next: 'Siguiente', back: 'Volver',
            toggle: 'Alternar', expand: 'Expandir', collapse: 'Colapsar',
            share: 'Compartir', export: 'Exportar', import: 'Importar',
            print: 'Imprimir', download: 'Descargar', upload: 'Subir',
            copy: 'Copiar', paste: 'Pegar', undo: 'Deshacer',
            redo: 'Rehacer', play: 'Reproducir', pause: 'Pausar',
            stop: 'Detener', start: 'Iniciar', connect: 'Conectar',
            disconnect: 'Desconectar', sync: 'Sincronizar', retry: 'Reintentar',
          };
          const fnLower = fn.toLowerCase();
          for (const [key, label] of Object.entries(labels)) {
            if (fnLower.includes(key)) {
              btn.setAttribute('aria-label', label);
              return;
            }
          }
          // Generic fallback: use function name
          const readable = fn.replace(/([A-Z])/g, ' $1').trim();
          btn.setAttribute('aria-label', readable);
        }
      }
    });

    // Tables
    document.querySelectorAll('table').forEach((table) => {
      if (!table.getAttribute('role')) {
        table.setAttribute('role', 'table');
      }
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.setAttribute('aria-label', window.I18n ? window.I18n.t('a11y.busqueda') : 'Buscar en el sistema');
      searchInput.setAttribute('role', 'searchbox');
    }
  }

  /**
   * Update aria-current when view changes.
   * @param {string} viewId - Active view identifier
   */
  function updateActiveView(viewId) {
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      item.removeAttribute('aria-current');
      if (item.dataset.view === viewId) {
        item.setAttribute('aria-current', 'page');
      }
    });
  }

  // ═════════════════════════════════════════════════
  //  SKIP TO CONTENT LINK
  // ═════════════════════════════════════════════════

  function addSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#view-content';
    skipLink.textContent = window.I18n ? window.I18n.t('a11y.skipToContent') : 'Saltar al contenido principal';
    skipLink.className = 'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm';
    skipLink.setAttribute('tabindex', '0');
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  // ═════════════════════════════════════════════════
  //  CSS for Screen Readers
  // ═════════════════════════════════════════════════

  function addA11yStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .sr-only.focus\:not-sr-only:focus {
        position: fixed;
        width: auto;
        height: auto;
        padding: 0.5rem 1rem;
        margin: 0;
        overflow: visible;
        clip: auto;
        white-space: normal;
      }
      /* Focus visible styles */
      :focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      /* High contrast mode support */
      @media (forced-colors: active) {
        .sidebar-item.active {
          border-left: 3px solid LinkText;
        }
        .status-badge {
          border: 1px solid LinkText;
        }
      }
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ═════════════════════════════════════════════════
  //  INITIALIZATION
  // ═════════════════════════════════════════════════

  function init() {
    addSkipLink();
    addA11yStyles();
    enhanceAriaLabels();
    initSidebarKeyboard();
    initEscapeHandler();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Expose to global scope ─────────────────────
  window.A11y = {
    announce,
    trapFocus,
    releaseFocus,
    renderEmptyState,
    updateActiveView,
    enhanceAriaLabels,
  };

})();
