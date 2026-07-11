/* ─── Internationalization (i18n) Engine ───── */
/* Multi-language support: ES (Spanish), GU (Guarani) */
/* Lazy-loads locale files, interpolates, and re-renders */

(function() {
  'use strict';

  const DEFAULT_LOCALE = 'es';
  const SUPPORTED_LOCALES = ['es', 'gu'];
  const LOCALE_API = '/api/v1/locale';
  const STORAGE_KEY = 'automotiveos_locale';

  let _currentLocale = DEFAULT_LOCALE;
  let _translations = {};
  let _loaded = {};

  // ═════════════════════════════════════════════════
  //  LOCALE DETECTION
  // ═════════════════════════════════════════════════

  /**
   * Detect the user's preferred locale.
   * Priority: localStorage → navigator.language → default
   * @returns {string} Locale code
   */
  function detectLocale() {
    // 1. localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

    // 2. navigator.language
    const browserLang = navigator.language || navigator.userLanguage || '';
    const short = browserLang.split('-')[0].toLowerCase();
    if (SUPPORTED_LOCALES.includes(short)) return short;

    // 3. Default
    return DEFAULT_LOCALE;
  }

  // ═════════════════════════════════════════════════
  //  TRANSLATION LOADING
  // ═════════════════════════════════════════════════

  /**
   * Load a locale file lazily.
   * @param {string} locale - Locale code
   * @returns {Promise<object>} Translations object
   */
  async function loadLocale(locale) {
    if (_loaded[locale]) return _translations[locale];

    try {
      const response = await fetch(`${LOCALE_API}/${locale}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      _translations[locale] = await response.json();
      _loaded[locale] = true;
      return _translations[locale];
    } catch (err) {
      console.warn(`[i18n] Failed to load locale "${locale}":`, err);
      // Fallback to default if loading fails
      if (locale !== DEFAULT_LOCALE) {
        return loadLocale(DEFAULT_LOCALE);
      }
      return {};
    }
  }

  // ═════════════════════════════════════════════════
  //  TRANSLATION FUNCTION
  // ═════════════════════════════════════════════════

  /**
   * Translate a key with optional interpolation.
   * @param {string} key - Dot-separated key path (e.g., 'sidebar.dashboard')
   * @param {object} [params={}] - Interpolation parameters
   * @returns {string} Translated string or key if not found
   *
   * @example
   *   t('common.greeting', { name: 'Carlos' })
   *   // → "Hola, Carlos" (ES) or "Mboraĩ, Carlos" (GU)
   */
  function t(key, params = {}) {
    const translations = _translations[_currentLocale] || {};
    const fallback = _translations[DEFAULT_LOCALE] || {};

    // Navigate dot path
    let value = _resolvePath(translations, key);
    if (value === undefined && _currentLocale !== DEFAULT_LOCALE) {
      value = _resolvePath(fallback, key);
    }

    if (value === undefined) {
      // Return key as fallback (missing translation indicator)
      return `[${key}]`;
    }

    // Interpolate: replace {param} placeholders
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (match, name) => {
        return params[name] !== undefined ? String(params[name]) : match;
      });
    }

    return value;
  }

  /**
   * Resolve a dot-separated path on an object.
   * @param {object} obj - Target object
   * @param {string} path - Dot path
   * @returns {*} Value or undefined
   */
  function _resolvePath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // ═════════════════════════════════════════════════
  //  LOCALE SWITCHING
  // ═════════════════════════════════════════════════

  /**
   * Switch to a new locale.
   * @param {string} locale - Target locale
   * @returns {Promise<void>}
   */
  async function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) {
      console.warn(`[i18n] Unsupported locale: "${locale}"`);
      return;
    }

    await loadLocale(locale);
    _currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);

    // Update HTML lang attribute
    document.documentElement.setAttribute('lang', locale);

    // Update lang selector UI
    _updateLangSelectorUI();

    // Re-render all i18n-marked elements
    _renderAll();

    // Emit event for other modules
    window.dispatchEvent(new CustomEvent('locale-changed', {
      detail: { locale, translations: _translations[locale] }
    }));

    // Announce to screen readers
    if (window.A11y && window.A11y.announce) {
      const langNames = { es: 'Español', gu: 'Guaraní' };
      window.A11y.announce(`Idioma cambiado a ${langNames[locale] || locale}`);
    }
  }

  /**
   * Get the current locale.
   * @returns {string}
   */
  function getLocale() {
    return _currentLocale;
  }

  /**
   * Get all supported locales.
   * @returns {string[]}
   */
  function getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
  }

  // ═════════════════════════════════════════════════
  //  DOM RENDERING
  // ═════════════════════════════════════════════════

  /**
   * Render all elements with data-i18n attribute.
   * data-i18n="key" → sets textContent
   * data-i18n-placeholder="key" → sets placeholder
   * data-i18n-title="key" → sets title
   * data-i18n-aria="key" → sets aria-label
   * data-i18n-html="key" → sets innerHTML (use cautiously)
   */
  function _renderAll() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated !== `[${key}]`) {
        el.textContent = translated;
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = t(key);
      if (translated !== `[${key}]`) {
        el.placeholder = translated;
      }
    });

    // Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translated = t(key);
      if (translated !== `[${key}]`) {
        el.title = translated;
      }
    });

    // ARIA labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translated = t(key);
      if (translated !== `[${key}]`) {
        el.setAttribute('aria-label', translated);
      }
    });

    // InnerHTML (careful — XSS risk if keys contain user data)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const translated = t(key);
      if (translated !== `[${key}]`) {
        el.innerHTML = translated;
      }
    });
  }

  // ═════════════════════════════════════════════════
  //  LANGUAGE SELECTOR UI
  // ═════════════════════════════════════════════════

  function _updateLangSelectorUI() {
    const selector = document.getElementById('lang-selector');
    if (!selector) return;

    selector.querySelectorAll('[data-locale]').forEach(btn => {
      const isActive = btn.dataset.locale === _currentLocale;
      btn.classList.toggle('bg-blue-600', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('bg-gray-800', !isActive);
      btn.classList.toggle('text-gray-400', !isActive);
      btn.classList.toggle('hover:bg-gray-700', !isActive);
      btn.setAttribute('aria-pressed', isActive);
    });
  }

  function _createLangSelector() {
    // Find the header bar (next to search or user info)
    const header = document.querySelector('.flex.items-center.gap-4');
    if (!header) return;

    const container = document.createElement('div');
    container.id = 'lang-selector';
    container.className = 'flex items-center gap-1 bg-gray-900 rounded-lg px-1 py-0.5';
    container.setAttribute('role', 'radiogroup');
    container.setAttribute('aria-label', 'Seleccionar idioma');

    const locales = [
      { code: 'es', label: 'ES', title: 'Español' },
      { code: 'gu', label: 'GU', title: 'Guaraní' },
    ];

    locales.forEach(({ code, label, title }) => {
      const btn = document.createElement('button');
      btn.dataset.locale = code;
      btn.textContent = label;
      btn.title = title;
      btn.className = 'text-xs font-bold px-2 py-1 rounded transition-colors';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', code === _currentLocale);
      btn.setAttribute('aria-label', title);
      btn.onclick = () => setLocale(code);
      container.appendChild(btn);
    });

    _updateLangSelectorUI();

    // Insert before the last child of header
    header.insertBefore(container, header.lastElementChild);
  }

  // ═════════════════════════════════════════════════
  //  PLURALIZATION
  // ═════════════════════════════════════════════════

  /**
   * Pluralized translation.
   * @param {string} key - Base key (e.g., 'orders.count')
   * @param {number} count - Count for pluralization
   * @returns {string} Pluralized string
   *
   * @example
   *   tp('orders.count', 5) → "5 órdenes" (ES) / "5 ta'angareko" (GU)
   *   tp('orders.count', 1) → "1 orden" (ES) / "1 ta'angareko" (GU)
   */
  function tp(key, count) {
    const suffix = count === 1 ? '_one' : '_other';
    const pluralKey = key + suffix;
    const translated = t(pluralKey, { count });
    // If plural key not found, try base key
    if (translated === `[${pluralKey}]`) {
      return t(key, { count });
    }
    return translated;
  }

  // ═════════════════════════════════════════════════
  //  DATE/NUMBER FORMATTING
  // ═════════════════════════════════════════════════

  /**
   * Format a date using the current locale.
   * @param {Date|string|number} date - Date to format
   * @param {object} [options] - Intl.DateTimeFormat options
   * @returns {string}
   */
  function formatDate(date, options = {}) {
    const d = new Date(date);
    const localeMap = { es: 'es-PY', gu: 'gn-PY' };
    const defaultOpts = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Intl.DateTimeFormat(localeMap[_currentLocale] || 'es-PY', { ...defaultOpts, ...options }).format(d);
  }

  /**
   * Format a number using the current locale.
   * @param {number} num - Number to format
   * @param {object} [options] - Intl.NumberFormat options
   * @returns {string}
   */
  function formatNumber(num, options = {}) {
    const localeMap = { es: 'es-PY', gu: 'gn-PY' };
    return new Intl.NumberFormat(localeMap[_currentLocale] || 'es-PY', options).format(num);
  }

  /**
   * Format currency in Guaraníes.
   * @param {number} amount - Amount in Gs
   * @returns {string}
   */
  function formatGuarani(amount) {
    return formatNumber(amount, { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 });
  }

  // ═════════════════════════════════════════════════
  //  INITIALIZATION
  // ═════════════════════════════════════════════════

  async function init() {
    _currentLocale = detectLocale();
    await loadLocale(_currentLocale);

    document.documentElement.setAttribute('lang', _currentLocale);
    _createLangSelector();
    _renderAll();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Expose to global scope ─────────────────────

  window.I18n = {
    t,
    tp,
    formatDate,
    formatNumber,
    formatGuarani,
    getLocale,
    setLocale,
    getSupportedLocales,
    renderAll: _renderAll,
    loadLocale,
  };

})();
