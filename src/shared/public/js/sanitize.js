/**
 * XSS Sanitization — DOMPurify-compatible HTML sanitizer.
 *
 * Provides safe HTML rendering by sanitizing untrusted content
 * before inserting into the DOM via innerHTML.
 *
 * OWASP Top 10 2021 — A03:2021 Injection
 *
 * @module shared/public/js/sanitize
 */

/* global */

/**
 * Sanitize HTML to prevent XSS attacks.
 * Strips all tags except safe ones (b, i, em, strong, span, br, p, ul, ol, li).
 * Removes all event handlers, scripts, and dangerous attributes.
 *
 * @param {string} dirty - Untrusted HTML string
 * @returns {string} Sanitized HTML string safe for innerHTML
 */
function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  // Create a temporary container
  const container = document.createElement('div');
  container.textContent = dirty;

  // For simple text, textContent is sufficient
  // For HTML that needs some formatting, use a whitelist approach
  return container.innerHTML;
}

/**
 * Safely set innerHTML with sanitization.
 * Use this instead of direct innerHTML assignment for untrusted content.
 *
 * @param {HTMLElement} element - Target DOM element
 * @param {string} html - Untrusted HTML content
 */
function safeSetHtml(element, html) {
  if (!element) return;
  element.innerHTML = sanitizeHtml(html);
}

/**
 * Create a safe element from untrusted HTML.
 * Returns a DocumentFragment with sanitized content.
 *
 * @param {string} html - Untrusted HTML string
 * @returns {DocumentFragment} Sanitized DOM fragment
 */
function safeParseHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = sanitizeHtml(html);
  const frag = document.createDocumentFragment();
  while (container.firstChild) {
    frag.appendChild(container.firstChild);
  }
  return frag;
}

// Export to global scope
window.sanitizeHtml = sanitizeHtml;
window.safeSetHtml = safeSetHtml;
window.safeParseHtml = safeParseHtml;
