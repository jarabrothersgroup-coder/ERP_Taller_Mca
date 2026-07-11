/* ─── Theme System — Dark/Light/Solar Mode ──────── */
/* CSS variables + toggle + tenant accent color + Solar Position Engine */

(function() {
  'use strict';

  const THEME_KEY = 'automotiveos_theme';
  const ACCENT_KEY = 'automotiveos_accent';

  // Coordenadas de Coronel Oviedo, Paraguay
  const LATITUDE = -25.4468;
  const LONGITUDE = -56.4397;

  // ─── Theme Definitions ───────────────────────

  const themes = {
    dark: {
      // ─── Base ───
      '--bg-primary': '#030712',
      '--bg-secondary': '#111827',
      '--bg-card': 'rgba(17,24,39,0.6)',
      '--bg-hover': 'rgba(59,130,246,0.1)',
      '--bg-input': '#1f2937',
      '--bg-modal': 'rgba(0,0,0,0.7)',
      // ─── Border ───
      '--border': '#1f2937',
      '--border-subtle': '#374151',
      '--border-strong': '#4b5563',
      // ─── Text ───
      '--text-primary': '#f9fafb',
      '--text-secondary': '#9ca3af',
      '--text-muted': '#6b7280',
      '--text-inverse': '#030712',
      // ─── Accent ───
      '--accent': '#3b82f6',
      '--accent-hover': '#2563eb',
      '--accent-subtle': 'rgba(59,130,246,0.15)',
      // ─── Status ───
      '--success': '#10b981',
      '--success-subtle': 'rgba(16,185,129,0.15)',
      '--warning': '#f59e0b',
      '--warning-subtle': 'rgba(245,158,11,0.15)',
      '--error': '#ef4444',
      '--error-subtle': 'rgba(239,68,68,0.15)',
      '--info': '#3b82f6',
      '--info-subtle': 'rgba(59,130,246,0.15)',
      // ─── Semantic aliases ───
      '--stat-value': '#60a5fa',
      '--stat-label': '#6b7280',
      '--badge-bg': 'rgba(59,130,246,0.15)',
      '--badge-text': '#60a5fa',
      '--shadow': '0 0 20px rgba(59,130,246,0.05)',
    },
    light: {
      // ─── Base ───
      '--bg-primary': '#f9fafb',
      '--bg-secondary': '#ffffff',
      '--bg-card': 'rgba(255,255,255,0.9)',
      '--bg-hover': 'rgba(59,130,246,0.05)',
      '--bg-input': '#f3f4f6',
      '--bg-modal': 'rgba(0,0,0,0.3)',
      // ─── Border ───
      '--border': '#e5e7eb',
      '--border-subtle': '#f3f4f6',
      '--border-strong': '#d1d5db',
      // ─── Text ───
      '--text-primary': '#111827',
      '--text-secondary': '#4b5563',
      '--text-muted': '#9ca3af',
      '--text-inverse': '#f9fafb',
      // ─── Accent ───
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--accent-subtle': 'rgba(37,99,235,0.08)',
      // ─── Status ───
      '--success': '#059669',
      '--success-subtle': 'rgba(5,150,105,0.08)',
      '--warning': '#d97706',
      '--warning-subtle': 'rgba(217,119,6,0.08)',
      '--error': '#dc2626',
      '--error-subtle': 'rgba(220,38,38,0.08)',
      '--info': '#2563eb',
      '--info-subtle': 'rgba(37,99,235,0.08)',
      // ─── Semantic aliases ───
      '--stat-value': '#2563eb',
      '--stat-label': '#6b7280',
      '--badge-bg': 'rgba(37,99,235,0.08)',
      '--badge-text': '#2563eb',
      '--shadow': '0 4px 20px rgba(0,0,0,0.08)',
    },
    'solar-glare': {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f3f4f6',
      '--bg-card': 'rgba(243,244,246,0.95)',
      '--bg-hover': 'rgba(0,0,0,0.08)',
      '--border': '#000000',
      '--text-primary': '#000000',
      '--text-secondary': '#111827',
      '--text-muted': '#374151',
      '--accent': '#047857',
      '--accent-hover': '#065f46',
      '--success': '#059669',
      '--warning': '#d97706',
      '--error': '#dc2626',
    },
    'artificial-warm': {
      '--bg-primary': '#faf6f0',
      '--bg-secondary': '#f4efe6',
      '--bg-card': 'rgba(244,239,230,0.95)',
      '--bg-hover': 'rgba(15,118,110,0.08)',
      '--border': '#e4dccf',
      '--text-primary': '#2d2a26',
      '--text-secondary': '#4a453f',
      '--text-muted': '#7f7467',
      '--accent': '#0f766e',
      '--accent-hover': '#0d9488',
      '--success': '#0d9488',
      '--warning': '#c2410c',
      '--error': '#b91c1c',
    },
    'deep-dark': {
      '--bg-primary': '#05070c',
      '--bg-secondary': '#0c101b',
      '--bg-card': 'rgba(12,16,27,0.8)',
      '--bg-hover': 'rgba(16,185,129,0.1)',
      '--border': '#111827',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#475569',
      '--accent': '#10b981',
      '--accent-hover': '#059669',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
    }
  };

  const accents = {
    blue: { '--accent': '#3b82f6', '--accent-hover': '#2563eb' },
    green: { '--accent': '#10b981', '--accent-hover': '#059669' },
    purple: { '--accent': '#8b5cf6', '--accent-hover': '#7c3aed' },
    red: { '--accent': '#ef4444', '--accent-hover': '#dc2626' },
    orange: { '--accent': '#f97316', '--accent-hover': '#ea580c' },
    teal: { '--accent': '#14b8a6', '--accent-hover': '#0d9488' },
  };

  // ─── Solar Position Engine ───────────────────

  function getSolarElevation() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (284 + dayOfYear));
    const hour = now.getHours() + now.getMinutes() / 60;
    const hourAngle = (hour - 12) * 15;

    const latRad = (LATITUDE * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const hrRad = (hourAngle * Math.PI) / 180;

    const sinElevation = Math.sin(latRad) * Math.sin(decRad) + 
                         Math.cos(latRad) * Math.cos(decRad) * Math.cos(hrRad);
    
    return (Math.asin(sinElevation) * 180) / Math.PI;
  }

function updateSolarTheme() {
    const currentMode = localStorage.getItem(THEME_KEY) || 'dark';
    if (currentMode !== 'solar') return;

    const elevation = getSolarElevation();
    let solarTheme = 'deep-dark';
    let label = 'Noche';
    let icon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';

    if (elevation > 45) {
      solarTheme = 'solar-glare';
      label = 'Sol Intenso';
      icon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    } else if (elevation >= 0) {
      solarTheme = 'artificial-warm';
      label = 'Luz Cálida';
      icon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    }

    applyThemeVariables(solarTheme);
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg> ' + label;
      toggle.setAttribute('aria-label', `Tema Solar Activo: ${label}`);
    }
  }

  // ─── Apply Theme ─────────────────────────────

  function applyThemeVariables(themeName) {
    const theme = themes[themeName] || themes.dark;
    const root = document.documentElement;

    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    document.body.style.background = theme['--bg-primary'];
  }

  function applyTheme(themeName) {
    const root = document.documentElement;
    localStorage.setItem(THEME_KEY, themeName);
    root.setAttribute('data-theme', themeName);

    if (themeName === 'solar') {
      updateSolarTheme();
    } else {
      applyThemeVariables(themeName);
      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.innerHTML = themeName === 'dark'
          ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'
          : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
        toggle.setAttribute('aria-label', `Cambiar a modo ${themeName === 'dark' ? 'claro' : 'oscuro'}`);
      }
    }
  }

  function applyAccent(accentName) {
    const accent = accents[accentName] || accents.blue;
    const root = document.documentElement;

    Object.entries(accent).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    localStorage.setItem(ACCENT_KEY, accentName);
  }

  // ─── Toggle Theme ────────────────────────────

  function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'dark';
    let next = 'light';
    if (current === 'light') {
      next = 'solar';
    } else if (current === 'solar') {
      next = 'dark';
    }
    applyTheme(next);

    if (window.A11y) {
      window.A11y.announce(`Tema cambiado a modo ${next}`);
    }
  }

  // ─── Create Theme Toggle Button ──────────────

  function createToggle() {
    if (document.getElementById('theme-toggle')) return;

    const header = document.querySelector('header .flex.items-center.gap-2');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'text-sm font-medium px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 transition flex items-center gap-1.5';
    btn.title = 'Cambiar tema';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', 'false');
    btn.addEventListener('click', toggleTheme);

    const clock = document.getElementById('clock');
    if (clock) {
      header.insertBefore(btn, clock);
    } else {
      header.appendChild(btn);
    }
  }

  // ─── CSS Variables Base ──────────────────────

  function injectBaseStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --bg-primary: #030712;
        --bg-secondary: #111827;
        --bg-card: rgba(17,24,39,0.6);
        --bg-hover: rgba(59,130,246,0.1);
        --border: #1f2937;
        --text-primary: #f9fafb;
        --text-secondary: #9ca3af;
        --text-muted: #6b7280;
        --accent: #3b82f6;
        --accent-hover: #2563eb;
        --success: #10b981;
        --warning: #f59e0b;
        --error: #ef4444;
      }
      /* Light theme overrides */
      [data-theme="light"] body { background: #f9fafb !important; }
      [data-theme="light"] #sidebar { background: #ffffff; border-color: #e5e7eb; }
      [data-theme="light"] header { background: rgba(255,255,255,0.5) !important; border-color: #e5e7eb !important; }
      [data-theme="light"] #modal-content,
      [data-theme="light"] .bg-gray-900 { background: #ffffff !important; border-color: #e5e7eb !important; }
      [data-theme="light"] .text-white { color: #111827 !important; }
      [data-theme="light"] .text-gray-400 { color: #6b7280 !important; }
      [data-theme="light"] .text-gray-500 { color: #4b5563 !important; }

      /* Solar Glare theme overrides */
      [data-theme="solar"] body { transition: background 0.3s ease, color 0.3s ease; }
      [data-theme="solar"] #sidebar,
      [data-theme="solar"] header,
      [data-theme="solar"] #modal-content { transition: background 0.3s ease, border-color 0.3s ease; }
    `;
    document.head.appendChild(style);
  }

  // ─── Initialize ──────────────────────────────

  function init() {
    injectBaseStyles();

    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    const savedAccent = localStorage.getItem(ACCENT_KEY) || 'blue';
    applyAccent(savedAccent);

    createToggle();

    // Actualizar tema solar cada 5 minutos
    setInterval(updateSolarTheme, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Expose ──────────────────────────────────
  window.ThemeSystem = {
    toggle: toggleTheme,
    setTheme: applyTheme,
    setAccent: applyAccent,
    getTheme: () => localStorage.getItem(THEME_KEY) || 'dark',
    getSolarElevation: getSolarElevation,
    updateSolarTheme: updateSolarTheme
  };

})();
