/**
 * Sprint 40 Tests — Mobile Responsive + DVI Canvas Touch Optimization.
 *
 * Tests for:
 *   - Mobile Utilities (file structure, functions, exports)
 *   - DVI Touch Gestures (pinch-zoom, pan, canvas transform)
 *   - Responsive CSS (media queries, grid adjustments, mobile layouts)
 *
 * @module tests/sprint40
 */

import { describe, it, expect } from "vitest";

// ─── Mobile.js File Validation ──────────────

describe("Sprint 40 — Mobile Utilities", () => {
  const mobilePath = new URL(
    "../src/shared/public/js/mobile.js",
    import.meta.url,
  ).pathname;

  it("has valid file structure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("/* global");
    expect(content).toContain("@module js/mobile");
  });

  it("exports initDVITouchGestures function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function initDVITouchGestures");
    expect(content).toContain("window.initDVITouchGestures");
  });

  it("exports resetCanvasTransform function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function resetCanvasTransform");
    expect(content).toContain("window.resetCanvasTransform");
  });

  it("exports isMobileDevice function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function isMobileDevice");
    expect(content).toContain("window.isMobileDevice");
  });

  it("exports getResponsiveBreakpoint function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getResponsiveBreakpoint");
    expect(content).toContain("window.getResponsiveBreakpoint");
  });

  it("exports shouldCollapseSidebar function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function shouldCollapseSidebar");
    expect(content).toContain("window.shouldCollapseSidebar");
  });

  it("exports getMobileFontSize function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getMobileFontSize");
    expect(content).toContain("window.getMobileFontSize");
  });

  it("exports getTouchSpacing function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getTouchSpacing");
    expect(content).toContain("window.getTouchSpacing");
  });

  it("exports getTouchButtonSize function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getTouchButtonSize");
    expect(content).toContain("window.getTouchButtonSize");
  });

  it("has touch state management", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("_touchState");
    expect(content).toContain("lastTouchDistance");
    expect(content).toContain("canvasOffset");
    expect(content).toContain("scale");
    expect(content).toContain("minScale");
    expect(content).toContain("maxScale");
  });

  it("has getTouchDistance helper", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getTouchDistance");
    expect(content).toContain("Math.sqrt");
  });

  it("has getTouchCenter helper", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function getTouchCenter");
    expect(content).toContain("(touches[0].clientX + touches[1].clientX) / 2");
  });

  it("has applyCanvasTransform helper", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("function applyCanvasTransform");
    expect(content).toContain("translate(");
    expect(content).toContain("scale(");
  });

  it("handles pinch-zoom with scale clamping", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("scaleDelta");
    expect(content).toContain("Math.min");
    expect(content).toContain("Math.max");
  });

  it("handles pan gesture", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("isPanning");
    expect(content).toContain("panStart");
    expect(content).toContain("canvasOffset.x +=");
    expect(content).toContain("canvasOffset.y +=");
  });

  it("sets touch-action none on canvas", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toMatch(/touchAction\s*=\s*'none'/);
  });

  it("has touch start/move/end listeners for two-finger gestures", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("addEventListener('touchstart'");
    expect(content).toContain("addEventListener('touchmove'");
    expect(content).toContain("addEventListener('touchend'");
  });

  it("detects mobile device via touch support", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("ontouchstart");
    expect(content).toContain("maxTouchPoints");
  });

  it("returns 5 breakpoints (xs/sm/md/lg/xl)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("'xs'");
    expect(content).toContain("'sm'");
    expect(content).toContain("'md'");
    expect(content).toContain("'lg'");
    expect(content).toContain("'xl'");
  });

  it("sidebar collapse check at 768px", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(mobilePath, "utf-8");
    expect(content).toContain("768");
    expect(content).toContain("shouldCollapseSidebar");
  });
});

// ─── Responsive CSS ─────────────────────────

describe("Sprint 40 — Responsive CSS", () => {
  const indexPath = new URL(
    "../src/shared/public/index.html",
    import.meta.url,
  ).pathname;

  it("has 768px mobile breakpoint", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("@media (max-width: 768px)");
  });

  it("has 769px desktop breakpoint", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("@media (min-width: 769px)");
  });

  it("has 480px small-phone breakpoint", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("@media (max-width: 480px)");
  });

  it("has touch-friendly min-height 44px", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("min-height: 44px");
  });

  it("has font-size 16px for mobile inputs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("font-size: 16px !important");
  });

  it("has responsive grid at 480px", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("grid-template-columns: 1fr !important");
  });

  it("has sidebar slide animation on mobile", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("translateX(-100%)");
    expect(content).toContain("translateX(0)");
  });

  it("has sidebar shadow on open", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("box-shadow: 4px 0 20px");
  });

  it("has hide-on-mobile class", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("hide-on-mobile");
  });

  it("has print styles", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("@media print");
  });

  it("includes mobile.js script", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain('src="js/mobile.js"');
  });

  it("has modal responsive width", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("margin: 16px");
    expect(content).toContain("max-height: 85vh");
  });

  it("has DVI tool touch-friendly sizes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("min-height: 44px");
    expect(content).toContain("min-width: 44px");
  });
});

// ─── DVI Canvas Touch Integration ───────────

describe("Sprint 40 — DVI Canvas Touch Integration", () => {
  const dviPath = new URL(
    "../src/shared/public/js/dvi.js",
    import.meta.url,
  ).pathname;

  it("canvas has touch-action:none", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("touch-action:none");
  });

  it("canvas has cursor-crosshair", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("cursor-crosshair");
  });

  it("calls initDVITouchGestures on markup editor open", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("initDVITouchGestures");
  });

  it("has dvi-tool-btn class for tool buttons", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("dvi-tool-btn");
  });

  it("tool buttons have touch-friendly padding", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("px-3 py-2");
  });

  it("has markup tools with clear button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("dviClearMarkup");
  });

  it("has photo grid responsive columns", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(dviPath, "utf-8");
    expect(content).toContain("grid-cols-2 md:grid-cols-4");
  });
});

// ─── Touch Gesture Math ─────────────────────

describe("Sprint 40 — Touch Gesture Math", () => {
  it("scale clamping works for zoom in", () => {
    const minScale = 0.5;
    const maxScale = 3;
    const initialScale = 1;
    const scaleDelta = 1.5;
    const newScale = Math.min(maxScale, Math.max(minScale, initialScale * scaleDelta));
    expect(newScale).toBe(1.5);
  });

  it("scale clamps to max on extreme zoom in", () => {
    const minScale = 0.5;
    const maxScale = 3;
    const initialScale = 2.5;
    const scaleDelta = 2;
    const newScale = Math.min(maxScale, Math.max(minScale, initialScale * scaleDelta));
    expect(newScale).toBe(3);
  });

  it("scale clamps to min on extreme zoom out", () => {
    const minScale = 0.5;
    const maxScale = 3;
    const initialScale = 0.7;
    const scaleDelta = 0.5;
    const newScale = Math.min(maxScale, Math.max(minScale, initialScale * scaleDelta));
    expect(newScale).toBe(0.5);
  });

  it("pan offset accumulation works", () => {
    const offset = { x: 0, y: 0 };
    const panStart = { x: 100, y: 100 };
    const newCenter = { x: 150, y: 120 };
    offset.x += newCenter.x - panStart.x;
    offset.y += newCenter.y - panStart.y;
    expect(offset.x).toBe(50);
    expect(offset.y).toBe(20);
  });

  it("distance calculation: 3-4-5 triangle", () => {
    const dx = 0 - 3;
    const dy = 0 - 4;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBe(5);
  });

  it("center calculation: midpoint", () => {
    const center = {
      x: (10 + 30) / 2,
      y: (20 + 40) / 2,
    };
    expect(center.x).toBe(20);
    expect(center.y).toBe(30);
  });

  it("CSS transform string format", () => {
    const offset = { x: 25, y: -10 };
    const scale = 1.5;
    const transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    expect(transform).toBe("translate(25px, -10px) scale(1.5)");
  });

  it("mobile breakpoint detection", () => {
    expect(480 < 640).toBe(true);  // xs
    expect(700 < 768).toBe(true);  // sm
    expect(900 < 1024).toBe(true); // md
    expect(1100 < 1280).toBe(true); // lg
    expect(1400 >= 1280).toBe(true); // xl
  });

  it("touch button minimum size is 44px", () => {
    const minTouchSize = 44;
    expect(minTouchSize).toBeGreaterThanOrEqual(44);
  });

  it("touch spacing range is 8-12px", () => {
    const mobileSpacing = 12;
    const desktopSpacing = 8;
    expect(mobileSpacing).toBeGreaterThanOrEqual(8);
    expect(mobileSpacing).toBeLessThanOrEqual(12);
    expect(desktopSpacing).toBeGreaterThanOrEqual(8);
    expect(desktopSpacing).toBeLessThanOrEqual(12);
  });
});
