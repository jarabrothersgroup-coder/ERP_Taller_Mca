/**
 * Mobile Responsive Utilities — Sprint 40.
 *
 * Provides:
 *   - Touch gesture support for DVI Canvas (pinch-zoom, pan)
 *   - Mobile-optimized interactions
 *   - Responsive helper functions
 *
 * @module js/mobile
 */

/* global api, esc, _dviState */

// ─── Touch Gesture State ────────────────────

const _touchState = {
  lastTouchDistance: 0,
  lastTouchCenter: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  canvasOffset: { x: 0, y: 0 },
  scale: 1,
  minScale: 0.5,
  maxScale: 3,
};

// ─── DVI Canvas Touch Gestures ──────────────

/**
 * Initialize touch gestures for DVI Canvas.
 * Supports: pinch-zoom, pan (two-finger), single-finger drawing.
 */
function initDVITouchGestures() {
  const canvas = document.getElementById('dvi-markup-canvas');
  if (!canvas) return;

  // Prevent default touch behaviors on canvas
  canvas.style.touchAction = 'none';

  // Single touch — drawing
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (_dviState.currentTool === 'freehand') {
        _dviState.isDrawing = true;
        _dviState.startX = x;
        _dviState.startY = y;
        _dviState.ctx.beginPath();
        _dviState.ctx.moveTo(x, y);
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (_dviState.isDrawing && _dviState.currentTool === 'freehand') {
        _dviState.ctx.lineTo(x, y);
        _dviState.ctx.strokeStyle = '#3b82f6';
        _dviState.ctx.lineWidth = 3;
        _dviState.ctx.stroke();
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      _dviState.isDrawing = false;
    }
  });

  // Two-finger gestures — pinch-zoom and pan
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      _touchState.lastTouchDistance = getTouchDistance(e.touches);
      _touchState.lastTouchCenter = getTouchCenter(e.touches);
      _touchState.isPanning = true;
      _touchState.panStart = { ..._touchState.lastTouchCenter };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();

      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);

      // Pinch-zoom
      if (_touchState.lastTouchDistance > 0) {
        const scaleDelta = newDistance / _touchState.lastTouchDistance;
        _touchState.scale = Math.min(
          _touchState.maxScale,
          Math.max(_touchState.minScale, _touchState.scale * scaleDelta),
        );
        applyCanvasTransform();
      }

      // Pan
      if (_touchState.isPanning) {
        const dx = newCenter.x - _touchState.panStart.x;
        const dy = newCenter.y - _touchState.panStart.y;
        _touchState.canvasOffset.x += dx;
        _touchState.canvasOffset.y += dy;
        _touchState.panStart = { ...newCenter };
        applyCanvasTransform();
      }

      _touchState.lastTouchDistance = newDistance;
      _touchState.lastTouchCenter = newCenter;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      _touchState.isPanning = false;
      _touchState.lastTouchDistance = 0;
    }
  });
}

/**
 * Get distance between two touch points.
 */
function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get center point between two touch points.
 */
function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

/**
 * Apply canvas transform (scale + translate).
 */
function applyCanvasTransform() {
  const canvas = document.getElementById('dvi-markup-canvas');
  const img = document.getElementById('dvi-markup-image');
  if (!canvas || !img) return;

  const transform = `translate(${_touchState.canvasOffset.x}px, ${_touchState.canvasOffset.y}px) scale(${_touchState.scale})`;
  canvas.style.transform = transform;
  img.style.transform = transform;
}

/**
 * Reset canvas transform to default.
 */
function resetCanvasTransform() {
  _touchState.scale = 1;
  _touchState.canvasOffset = { x: 0, y: 0 };
  applyCanvasTransform();
}

// ─── Mobile Helpers ─────────────────────────

/**
 * Check if device is mobile (touch + small screen).
 */
function isMobileDevice() {
  return (
    'ontouchstart' in window
    || navigator.maxTouchPoints > 0
  );
}

/**
 * Get responsive breakpoint.
 */
function getResponsiveBreakpoint() {
  const width = window.innerWidth;
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

/**
 * Check if sidebar should be collapsed.
 */
function shouldCollapseSidebar() {
  return window.innerWidth < 768;
}

/**
 * Adjust font size for mobile.
 */
function getMobileFontSize(baseSize) {
  const breakpoint = getResponsiveBreakpoint();
  if (breakpoint === 'xs') return Math.max(baseSize * 0.85, 12);
  if (breakpoint === 'sm') return Math.max(baseSize * 0.9, 13);
  return baseSize;
}

/**
 * Get touch-friendly spacing.
 */
function getTouchSpacing() {
  return isMobileDevice() ? 12 : 8;
}

/**
 * Get touch-friendly button size.
 */
function getTouchButtonSize() {
  return isMobileDevice() ? 44 : 36;
}

// ─── Exports ────────────────────────────────

window.initDVITouchGestures = initDVITouchGestures;
window.resetCanvasTransform = resetCanvasTransform;
window.isMobileDevice = isMobileDevice;
window.getResponsiveBreakpoint = getResponsiveBreakpoint;
window.shouldCollapseSidebar = shouldCollapseSidebar;
window.getMobileFontSize = getMobileFontSize;
window.getTouchSpacing = getTouchSpacing;
window.getTouchButtonSize = getTouchButtonSize;
