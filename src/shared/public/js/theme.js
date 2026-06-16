/* ─── Theme System — Dark/Light Mode ──────── */
/* CSS variables + toggle + tenant accent color  */

(function() {
  'use strict';

  const THEME_KEY = 'automotiveos_theme';
  const ACCENT_KEY = 'automotiveos_accent';

  // ─── Theme Definitions ───────────────────────

  const themes = {
    dark: {
      '--bg-primary': '#030712',
      '--bg-secondary': '#111827',
      '--bg-card': 'rgba(17,24,39,0.6)',
      '--bg-hover': 'rgba(59,130,246,0.1)',
      '--border': '#1f2937',
      '--text-primary': '#f9fafb',
      '--text-secondary': '#9ca3af',
      '--text-muted': '#6b7280',
      '--accent': '#3b82f6',
      '--accent-hover': '#2563eb',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
    },
    light: {
      '--bg-primary': '#f9fafb',
      '--bg-secondary': '#ffffff',
      '--bg-card': 'rgba(255,255,255,0.9)',
      '--bg-hover': 'rgba(59,130,246,0.05)',
      '--border': '#e5e7eb',
      '--text-primary': '#111827',
      '--text-secondary': '#4b5563',
      '--text-muted': '#9ca3af',
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--success': '#059669',
      '--warning': '#d97706',
      '--error': '#dc2626',
    },
  };

  const accents = {
    blue: { '--accent': '#3b82f6', '--accent-hover': '#2563eb' },
    green: { '--accent': '#10b981', '--accent-hover': '#059669' },
    purple: { '--accent': '#8b5cf6', '--accent-hover': '#7c3aed' },
    red: { '--accent': '#ef4444', '--accent-hover': '#dc2626' },
    orange: { '--accent': '#f97316', '--accent-hover': '#ea580c' },
    teal: { '--accent': '#14b8a6', '--accent-hover': '#0d9488' },
  };

  // ─── Apply Theme ─────────────────────────────

  function applyTheme(themeName) {
    const theme = themes[themeName] || themes.dark;
    const root = document.documentElement;

    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_KEY, themeName);

    // Update toggle icon
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.textContent = themeName === 'dark' ? '🌙' : '☀️';
      toggle.setAttribute('aria-label', `Cambiar a modo ${themeName === 'dark' ? 'claro' : 'oscuro'}`);
    }

    // Update body background
    document.body.style.background = theme['--bg-primary'];
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
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);

    // Announce to screen readers
    if (window.A11y) {
      window.A11y.announce(`Tema cambiado a modo ${next === 'dark' ? 'oscuro' : 'claro'}`);
    }
  }

  // ─── Create Theme Toggle Button ──────────────

  function createToggle() {
    if (document.getElementById('theme-toggle')) return;

    const header = document.querySelector('header .flex.items-center.gap-2');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'text-lg p-1 hover:opacity-80 transition';
    btn.title = 'Cambiar tema';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', 'false');
    btn.addEventListener('click', toggleTheme);

    // Insert before clock
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
    `;
    document.head.appendChild(style);
  }

  // ─── Initialize ──────────────────────────────

  function init() {
    injectBaseStyles();

    // Load saved theme
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    // Load saved accent
    const savedAccent = localStorage.getItem(ACCENT_KEY) || 'blue';
    applyAccent(savedAccent);

    createToggle();
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
    getTheme: () => document.documentElement.getAttribute('data-theme') || 'dark',
  };

})();
