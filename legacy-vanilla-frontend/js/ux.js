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

// ═════════════════════════════════════════════════
//  FORM VALIDATION HELPERS
// ═════════════════════════════════════════════════

/**
 * Validate a form field and show error state.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field - Field to validate
 * @param {function} validator - (value) => true | error message string
 * @returns {boolean} true if valid
 */
function validateField(field, validator) {
  const value = field.value?.trim();
  const result = validator(value);
  const errorEl = document.getElementById(`${field.id}-error`);

  if (result === true) {
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-700');
    if (errorEl) errorEl.classList.add('hidden');
    return true;
  } else {
    field.classList.remove('border-gray-700');
    field.classList.add('border-red-500');
    if (errorEl) {
      errorEl.textContent = result;
      errorEl.classList.remove('hidden');
    }
    return false;
  }
}

/**
 * Validate an entire form by mapping fields to validators.
 *
 * @param {Object} schema - { fieldId: validatorFn }
 * @returns {boolean} true if all valid
 */
function validateForm(schema) {
  let allValid = true;
  for (const [fieldId, validator] of Object.entries(schema)) {
    const field = document.getElementById(fieldId);
    if (field && !validateField(field, validator)) {
      allValid = false;
    }
  }
  return allValid;
}

/**
 * Common validators for Paraguayan workshop forms.
 */
const Validators = {
  required: (msg = 'Campo obligatorio') => (v) => v ? true : msg,
  minLength: (min, msg) => (v) => v.length >= min ? true : (msg || `Mínimo ${min} caracteres`),
  maxLength: (max, msg) => (v) => v.length <= max ? true : (msg || `Máximo ${max} caracteres`),
  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : 'Email inválido',
  ruc: (v) => !v || /^\d{6,8}-\d$/.test(v) ? true : 'RUC inválido (formato: 1234567-8)',
  numeric: (v) => !v || !isNaN(Number(v)) ? true : 'Debe ser numérico',
  positive: (v) => !v || Number(v) > 0 ? true : 'Debe ser mayor a 0',
  phone: (v) => !v || /^\+?[\d\s-]{8,15}$/.test(v) ? true : 'Teléfono inválido',
  plate: (v) => !v || /^[A-Z]{3}-?\d{3,4}$/i.test(v) ? true : 'Formato de patente inválido (ABC-1234)',
  vin: (v) => !v || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v) ? true : 'VIN debe tener 17 caracteres alfanuméricos',
  // Smart validation for workshop-specific fields
  workshopName: (v) => !v || /^[A-Za-z0-9\s\-\'\.]{2,50}$/.test(v) ? true : 'Nombre de taller inválido (2-50 caracteres, solo letras, números, espacios y guiones)',
  clientName: (v) => !v || /^[A-Za-z\s\'\.]{2,50}$/.test(v) ? true : 'Nombre de cliente inválido (2-50 caracteres, solo letras y espacios)',
  vehicleModel: (v) => !v || /^[A-Za-z0-9\s\-\'\.]{2,50}$/.test(v) ? true : 'Modelo de vehículo inválido (2-50 caracteres)',
  serviceDescription: (v) => !v || /^[A-Za-z0-9\s\-\'\.\,]{5,200}$/.test(v) ? true : 'Descripción de servicio inválida (5-200 caracteres)',
};

/**
 * Add real-time validation to a form with enhanced UX.
 *
 * @param {string} formId - Form element ID
 * @param {Object} schema - { fieldId: validatorFn }
 * @param {Object} options - Validation options
 */
function attachValidation(formId, schema) {
  var options = arguments[2] || {};
  const form = document.getElementById(formId);
  if (!form) return;
  
  const config = {
    showToast: options.showToast !== false,
    highlightInvalid: options.highlightInvalid !== false,
    validateOnInput: options.validateOnInput !== false,
    ...options
  };
  
  for (const [fieldId, validator] of Object.entries(schema)) {
    const field = document.getElementById(fieldId);
    if (field) {
      // Store original placeholder for better UX
      const originalPlaceholder = field.placeholder;
      
      field.addEventListener('blur', () => {
        const isValid = validateField(field, validator);
        if (!isValid && config.showToast) {
          const errorEl = document.getElementById(`${fieldId}-error`);
          if (errorEl && errorEl.textContent) {
            showToast(errorEl.textContent, 'warning', 3000);
          }
        }
      });
      
      if (config.validateOnInput) {
        field.addEventListener('input', () => {
          if (field.classList.contains('border-red-500')) {
            validateField(field, validator);
          }
        });
      }
      
      // Add visual feedback for field interaction
      field.addEventListener('focus', () => {
        field.classList.add('ring-2', 'ring-blue-500/30');
      });
      
      field.addEventListener('blur', () => {
        field.classList.remove('ring-2', 'ring-blue-500/30');
      });
    }
  }
  
  form.addEventListener('submit', (e) => {
    if (!validateForm(schema)) {
      e.preventDefault();
      if (config.showToast) {
        showToast('Corrige los errores antes de continuar', 'warning');
      }
      // Focus first invalid field for better UX
      const firstInvalid = Object.keys(schema).find(fieldId => {
        const field = document.getElementById(fieldId);
        return field && field.classList.contains('border-red-500');
      });
      if (firstInvalid) {
        document.getElementById(firstInvalid)?.focus();
      }
    }
  });
}

// ═════════════════════════════════════════════════
//  REUSABLE UI HELPERS — Consistent components
// ═════════════════════════════════════════════════

// Safe escape fallback (esc is defined in app.js, but loaded after ux.js)
function _esc(s) {
  if (typeof esc === 'function') return esc(s);
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

/**
 * Render a form group with label, input, and error container.
 *
 * @param {Object} opts
 * @param {string} opts.id - Field ID
 * @param {string} opts.label - Label text
 * @param {string} opts.type - Input type (text, email, number, select, textarea)
 * @param {string} opts.placeholder - Placeholder text
 * @param {string} opts.value - Current value
 * @param {Array} opts.options - For select: [{value, label}]
 * @param {string} opts.helpText - Help text below field
 * @param {boolean} opts.required - Required field
 * @param {boolean} opts.disabled - Disabled field
 * @param {string} opts.className - Extra CSS classes for the input
 * @param {Object} opts.inputAttrs - Extra attributes as key/value
 * @returns {string} HTML string
 */
function renderFormGroup(opts) {
  const { id, label, type = 'text', placeholder = '', value = '', options, helpText, required = false, disabled = false, className = '', inputAttrs = {} } = opts;
  const requiredAttr = required ? ' required' : '';
  const disabledAttr = disabled ? ' disabled' : '';
  const extraAttrs = Object.entries(inputAttrs).map(([k, v]) => ` ${k}="${_esc(String(v))}"`).join('');
  const baseInputClass = `w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`;
  const baseLabelClass = 'text-xs text-gray-400 uppercase tracking-wider block mb-1.5 font-medium';

  let inputHtml = '';
  if (type === 'select') {
    const optsHtml = (options || []).map(o =>
      `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`
    ).join('');
    inputHtml = `<select id="${id}" class="${baseInputClass}"${requiredAttr}${disabledAttr}${extraAttrs} aria-describedby="${id}-error">
      <option value="">${esc(placeholder || 'Seleccionar...')}</option>
      ${optsHtml}
    </select>`;
  } else if (type === 'textarea') {
    inputHtml = `<textarea id="${id}" rows="3" class="${baseInputClass}" placeholder="${esc(placeholder)}"${requiredAttr}${disabledAttr}${extraAttrs} aria-describedby="${id}-error">${esc(value)}</textarea>`;
  } else {
    inputHtml = `<input id="${id}" type="${type}" class="${baseInputClass}" placeholder="${esc(placeholder)}" value="${esc(value)}"${requiredAttr}${disabledAttr}${extraAttrs} aria-describedby="${id}-error">`;
  }

  return `
    <div class="form-group">
      <label for="${id}" class="${baseLabelClass}">${esc(label)}</label>
      ${inputHtml}
      ${helpText ? `<p class="text-xs text-gray-500 mt-1">${esc(helpText)}</p>` : ''}
      <p id="${id}-error" class="text-xs mt-1 hidden" role="alert">
        <span class="inline-flex items-center gap-1 text-red-400">
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          <span id="${id}-error-text"></span>
        </span>
      </p>
    </div>`;
}

/**
 * Render a data table with consistent styling.
 *
 * @param {Object} opts
 * @param {Array} opts.headers - [{key, label, className}]
 * @param {Array} opts.rows - Array of row objects
 * @param {Function} opts.renderRow - (row, index) => string of <td> elements
 * @param {string} opts.emptyMessage - Message when no rows
 * @param {string} opts.className - Extra CSS classes
 * @returns {string} HTML string
 */
function renderTable(opts) {
  const { headers = [], rows = [], renderRow, emptyMessage = 'Sin datos', className = '' } = opts;

  const headerHtml = headers.map(h =>
    `<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${h.className || ''}">${esc(h.label)}</th>`
  ).join('');

  let bodyHtml;
  if (!rows || rows.length === 0) {
    bodyHtml = `<tr><td colspan="${headers.length}" class="table-empty">${esc(emptyMessage)}</td></tr>`;
  } else {
    bodyHtml = rows.map((row, i) => {
      const cells = renderRow ? renderRow(row, i) : '<td>—</td>';
      return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors cursor-pointer">${cells}</tr>`;
    }).join('');
  }

  return `
    <div class="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden ${className}">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800/50">${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    </div>`;
}

/**
 * Render a stat/KPI card.
 *
 * @param {Object} opts
 * @param {string} opts.label - Metric label
 * @param {string} opts.value - Display value
 * @param {string} opts.icon - Emoji icon
 * @param {string} opts.color - Tailwind text color class (e.g., 'text-blue-400')
 * @param {string} opts.subtext - Secondary text below value
 * @param {string} opts.id - Element ID for dynamic updates
 * @param {string} opts.className - Extra CSS classes
 * @returns {string} HTML string
 */
function renderStatCard(opts) {
  const { label, value = '—', icon = '', color = 'text-blue-400', subtext = '', id, className = '' } = opts;
  return `
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow card-hover ${className}">
      ${icon ? `<div class="text-xl mb-1" aria-hidden="true">${icon}</div>` : ''}
      <p class="text-gray-500 text-xs uppercase tracking-wider">${esc(label)}</p>
      <p ${id ? `id="${id}"` : ''} class="text-2xl font-bold mt-1 ${color}">${esc(value)}</p>
      ${subtext ? `<p class="text-[10px] text-gray-600 mt-0.5">${esc(subtext)}</p>` : ''}
    </div>`;
}

/**
 * Show a loading spinner inside a container.
 *
 * @param {HTMLElement} container - Target element
 * @param {string} message - Loading message
 */
function showLoading(container, message = 'Cargando...') {
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
      <svg class="animate-spin h-8 w-8 mb-3 text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm">${esc(message)}</p>
    </div>`;
}

/**
 * Show an empty state with icon and message.
 *
 * @param {HTMLElement} container - Target element
 * @param {string} message - Empty state message
 * @param {string} icon - Emoji icon
 */
function showEmpty(container, message = 'Sin datos disponibles', icon = '📭') {
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
      <span class="text-3xl mb-3" aria-hidden="true">${icon}</span>
      <p class="text-sm">${esc(message)}</p>
    </div>`;
}

/**
 * Render a button with consistent styling.
 *
 * @param {Object} opts
 * @param {string} opts.label - Button text
 * @param {string} opts.id - Element ID
 * @param {string} opts.variant - 'primary' | 'secondary' | 'ghost' | 'danger'
 * @param {string} opts.icon - Emoji icon
 * @param {boolean} opts.loading - Show loading spinner
 * @param {boolean} opts.disabled - Disabled state
 * @param {string} opts.className - Extra CSS classes
 * @param {string} opts.size - 'sm' | 'md' | 'lg'
 * @returns {string} HTML string
 */
function renderButton(opts) {
  const { label, id, variant = 'secondary', icon = '', loading = false, disabled = false, className = '', size = 'md' } = opts;

  const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-blue-500/20',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white',
    danger: 'bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-medium',
  };

  const spinner = loading ? `<svg class="animate-spin -ml-1 mr-1.5 h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>` : '';

  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `<button ${id ? `id="${id}"` : ''}
    class="inline-flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClass} ${className}"
    ${disabled ? 'disabled' : ''}>
    ${icon ? `<span aria-hidden="true">${icon}</span>` : ''}
    ${spinner}
    <span>${esc(label)}</span>
  </button>`;
}

// ─── Expose to global scope ─────────────────────

window.showToast = showToast;
window.renderSkeleton = renderSkeleton;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;

// Expose validation utilities
window.validateField = validateField;
window.validateForm = validateForm;
window.Validators = Validators;
window.attachValidation = attachValidation;

// Expose UI helpers
window.renderFormGroup = renderFormGroup;
window.renderTable = renderTable;
window.renderStatCard = renderStatCard;
window.showLoading = showLoading;
window.showEmpty = showEmpty;
window.renderButton = renderButton;

// ═════════════════════════════════════════════════
//  INTERSECTION OBSERVER — Lazy Animations
// ═════════════════════════════════════════════════

/**
 * Observe elements and trigger a CSS class when they enter the viewport.
 * Usage: add class="lazy-animate" data-lazy-class="animate-slide-up" to any element.
 * The observer adds the class when visible and unobserves (runs once).
 */
(function() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const cls = entry.target.dataset.lazyClass || 'opacity-100';
        entry.target.classList.add(cls);
        entry.target.classList.remove('opacity-0');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // Auto-observe on DOMContentLoaded and after dynamic renders
  function observeLazy() {
    document.querySelectorAll('.lazy-animate:not(.observed)').forEach(el => {
      el.classList.add('observed');
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLazy);
  } else {
    observeLazy();
  }

  // Re-observe after view changes (called from navigate/renderView)
  window.observeLazyElements = observeLazy;
})();

// ═════════════════════════════════════════════════
//  EVENT DELEGATION — Replaces individual addEventListener
// ═════════════════════════════════════════════════

/**
 * Delegate events from a parent to children matching a selector.
 * Replaces multiple addEventListener calls with one per parent.
 *
 * @param {HTMLElement|string} parent - Parent element or CSS selector (uses document as fallback)
 * @param {string} eventType - Event type (e.g., 'click')
 * @param {string} childSelector - CSS selector to match children
 * @param {Function} handler - Event handler (receives event and matched element)
 *
 * @example
 * // Instead of: document.querySelectorAll('.btn').forEach(b => b.addEventListener('click', handler))
 * delegate('#view-content', 'click', '.btn', (e, el) => { ... });
 */
function delegate(parent, eventType, childSelector, handler) {
  const el = typeof parent === 'string' ? document.querySelector(parent) : parent || document;
  el.addEventListener(eventType, (e) => {
    const target = e.target.closest(childSelector);
    if (target && el.contains(target)) {
      handler(e, target);
    }
  });
}

window.delegate = delegate;

// ═════════════════════════════════════════════════
//  DOCUMENT FRAGMENT — Efficient DOM insertion
// ═════════════════════════════════════════════════

/**
 * Convert an HTML string to a DocumentFragment for batch DOM insertion.
 * Avoids re-triggering reflows per element when inserting multiple nodes.
 *
 * @param {string} html - HTML string (can contain multiple root elements)
 * @returns {DocumentFragment}
 *
 * @example
 * const frag = htmlToFragment('<div>A</div><div>B</div><div>C</div>');
 * container.appendChild(frag); // Single reflow, not three
 */
function htmlToFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

/**
 * Replace a container's innerHTML efficiently using DocumentFragment.
 * Parses once, clears, appends — single reflow.
 *
 * @param {HTMLElement} container
 * @param {string} html
 */
function setHTML(container, html) {
  const frag = htmlToFragment(html);
  container.innerHTML = '';
  container.appendChild(frag);
}

window.htmlToFragment = htmlToFragment;
window.setHTML = setHTML;

// ═════════════════════════════════════════════════
//  PERFORMANCE MONITOR — Runtime Metrics
// ═════════════════════════════════════════════════

const PerfMonitor = (() => {
  const metrics = {
    views: {},       // { viewName: { renders: N, totalMs: N, lastMs: N } }
    api: {},         // { path: { calls: N, totalMs: N, lastMs: N, errors: N } }
    load: {},        // { moduleName: { loadMs: N } }
    memory: [],      // [{ ts, usedJSHeapSize }]
    startTime: Date.now(),
  };

  /**
   * Time a view render.
   * @param {string} view - View name
   * @param {Function} fn - Render function to time
   */
  function timeView(view, fn) {
    const t0 = performance.now();
    const result = fn();
    const t1 = performance.now();
    const ms = Math.round(t1 - t0);

    if (!metrics.views[view]) metrics.views[view] = { renders: 0, totalMs: 0, lastMs: 0 };
    metrics.views[view].renders++;
    metrics.views[view].totalMs += ms;
    metrics.views[view].lastMs = ms;

    // Warn if render takes > 100ms
    if (ms > 100) console.warn(`[Perf] ${view} render: ${ms}ms (slow)`);

    return result;
  }

  /**
   * Time an API call.
   * @param {string} path - API path
   * @param {Function} fn - Fetch function to time
   */
  async function timeApi(path, fn) {
    const t0 = performance.now();
    try {
      const result = await fn();
      const t1 = performance.now();
      const ms = Math.round(t1 - t0);
      if (!metrics.api[path]) metrics.api[path] = { calls: 0, totalMs: 0, lastMs: 0, errors: 0 };
      metrics.api[path].calls++;
      metrics.api[path].totalMs += ms;
      metrics.api[path].lastMs = ms;
      return result;
    } catch (err) {
      if (!metrics.api[path]) metrics.api[path] = { calls: 0, totalMs: 0, lastMs: 0, errors: 0 };
      metrics.api[path].errors++;
      throw err;
    }
  }

  /**
   * Record module load time.
   * @param {string} name - Module name
   */
  function recordLoad(name) {
    metrics.load[name] = { loadMs: Math.round(performance.now()) };
  }

  /**
   * Sample memory usage (if available).
   */
  function sampleMemory() {
    if (performance.memory) {
      metrics.memory.push({
        ts: Date.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
      });
      // Keep last 60 samples
      if (metrics.memory.length > 60) metrics.memory.shift();
    }
  }

  /**
   * Get summary of all metrics.
   * @returns {Object}
   */
  function getSummary() {
    const uptimeMs = Date.now() - metrics.startTime;
    const viewSummary = {};
    for (const [name, v] of Object.entries(metrics.views)) {
      viewSummary[name] = {
        renders: v.renders,
        avgMs: Math.round(v.totalMs / v.renders),
        lastMs: v.lastMs,
      };
    }
    return {
      uptime: Math.round(uptimeMs / 1000) + 's',
      views: viewSummary,
      api: metrics.api,
      memory: metrics.memory.length > 0 ? metrics.memory[metrics.memory.length - 1] : null,
    };
  }

  /**
   * Render a floating debug panel (toggle with Ctrl+Shift+P).
   */
  function showDebugPanel() {
    let panel = document.getElementById('perf-debug-panel');
    if (panel) { panel.remove(); return; }

    sampleMemory();
    const summary = getSummary();

    panel = document.createElement('div');
    panel.id = 'perf-debug-panel';
    panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;background:#111827;border:1px solid #374151;border-radius:12px;padding:16px;max-height:70vh;overflow-y:auto;min-width:380px;font-family:monospace;font-size:12px;color:#e5e7eb;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="color:#60a5fa">⚡ Performance Monitor</b><button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px">&times;</button></div>';
    html += `<div style="color:#6b7280;margin-bottom:8px">Uptime: ${summary.uptime}</div>`;

    // Views
    html += '<div style="margin-bottom:12px"><b style="color:#34d399">Views</b>';
    for (const [name, v] of Object.entries(summary.views)) {
      const color = v.avgMs > 100 ? '#ef4444' : v.avgMs > 50 ? '#f59e0b' : '#10b981';
      html += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${name}</span><span style="color:${color}">${v.lastMs}ms (avg ${v.avgMs}ms, ${v.renders}x)</span></div>`;
    }
    html += '</div>';

    // API
    html += '<div style="margin-bottom:12px"><b style="color:#60a5fa">API</b>';
    for (const [path, a] of Object.entries(summary.api)) {
      const avgMs = a.calls > 0 ? Math.round(a.totalMs / a.calls) : 0;
      const color = a.errors > 0 ? '#ef4444' : avgMs > 500 ? '#f59e0b' : '#10b981';
      html += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${path}</span><span style="color:${color};margin-left:8px">${a.calls}x, ${avgMs}ms${a.errors ? ', ' + a.errors + ' err' : ''}</span></div>`;
    }
    html += '</div>';

    // Memory
    if (summary.memory) {
      const mb = (summary.memory.usedJSHeapSize / 1048576).toFixed(1);
      const color = mb > 50 ? '#ef4444' : mb > 20 ? '#f59e0b' : '#10b981';
      html += `<div><b style="color:#a78bfa">Memory</b> <span style="color:${color}">${mb} MB</span></div>`;
    }

    panel.innerHTML = html;
    document.body.appendChild(panel);
  }

  // Keyboard shortcut: Ctrl+Shift+P
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      showDebugPanel();
    }
  });

  return { timeView, timeApi, recordLoad, sampleMemory, getSummary, showDebugPanel };
})();

window.PerfMonitor = PerfMonitor;
