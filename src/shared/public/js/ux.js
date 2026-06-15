/* ─── UX Utilities ─────────────────────────── */
/* Toast notifications + Loading skeletons        */

// ═════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ═════════════════════════════════════════════════

/**
 * Show a toast notification (bottom-right, auto-dismiss).
 *
 * @param {string} message - Toast message
 * @param {'success'|'error'|'info'|'warning'} type - Toast type
 * @param {number} duration - Auto-dismiss in ms (default 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const colors = {
    success: 'border-green-600 bg-green-900/90 text-green-200',
    error: 'border-red-600 bg-red-900/90 text-red-200',
    info: 'border-blue-600 bg-blue-900/90 text-blue-200',
    warning: 'border-yellow-600 bg-yellow-900/90 text-yellow-200',
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl backdrop-blur-sm transform translate-x-full opacity-0 transition-all duration-300 ${colors[type] || colors.info} max-w-sm`;
  toast.innerHTML = `
    <span class="text-lg flex-shrink-0">${icons[type] || 'ℹ️'}</span>
    <span class="text-sm flex-1">${esc(message)}</span>
    <button class="text-current opacity-50 hover:opacity-100 text-lg leading-none flex-shrink-0" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═════════════════════════════════════════════════
//  LOADING SKELETON COMPONENT
// ═════════════════════════════════════════════════

/**
 * Render a loading skeleton placeholder.
 *
 * @param {'card'|'table'|'list'|'chart'} variant - Skeleton type
 * @param {number} count - Number of skeleton rows/items
 * @returns {string} HTML string
 */
function renderSkeleton(variant = 'card', count = 3) {
  const pulse = 'animate-pulse bg-gray-800 rounded';

  if (variant === 'card') {
    return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${Array(count).fill('').map(() => `
        <div class="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div class="${pulse} h-4 w-24 mb-3"></div>
          <div class="${pulse} h-8 w-16 mb-2"></div>
          <div class="${pulse} h-3 w-32"></div>
        </div>
      `).join('')}
    </div>`;
  }

  if (variant === 'table') {
    return `<div class="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800"><div class="${pulse} h-4 w-32"></div></div>
      ${Array(count).fill('').map(() => `
        <div class="flex items-center gap-4 px-4 py-3 border-b border-gray-800/50">
          <div class="${pulse} h-4 flex-1"></div>
          <div class="${pulse} h-4 w-20"></div>
          <div class="${pulse} h-4 w-16"></div>
        </div>
      `).join('')}
    </div>`;
  }

  if (variant === 'list') {
    return `<div class="space-y-3">
      ${Array(count).fill('').map(() => `
        <div class="flex items-center gap-3 bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div class="${pulse} h-10 w-10 rounded-lg flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="${pulse} h-4 w-3/4"></div>
            <div class="${pulse} h-3 w-1/2"></div>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  if (variant === 'chart') {
    return `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div class="${pulse} h-4 w-48 mb-4"></div>
      <div class="flex items-end gap-2 h-40">
        ${Array(count).fill('').map((_, i) => `
          <div class="${pulse} flex-1" style="height: ${30 + Math.random() * 70}%"></div>
        `).join('')}
      </div>
    </div>`;
  }

  return `<div class="${pulse} h-8 w-full"></div>`;
}

/**
 * Show skeleton inside a container while data loads.
 *
 * @param {HTMLElement} container - Target element
 * @param {'card'|'table'|'list'|'chart'} variant - Skeleton type
 * @param {number} count - Number of skeleton items
 */
function showSkeleton(container, variant = 'card', count = 3) {
  if (!container) return;
  container.dataset.originalContent = container.innerHTML;
  container.innerHTML = renderSkeleton(variant, count);
}

/**
 * Restore original content after loading completes.
 *
 * @param {HTMLElement} container - Target element
 */
function hideSkeleton(container) {
  if (!container) return;
  if (container.dataset.originalContent) {
    container.innerHTML = container.dataset.originalContent;
    delete container.dataset.originalContent;
  }
}

// ─── Expose to global scope ─────────────────────

window.showToast = showToast;
window.renderSkeleton = renderSkeleton;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
