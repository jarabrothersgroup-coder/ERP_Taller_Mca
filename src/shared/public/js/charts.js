/* ─── Lightweight Chart Rendering ──────────────── */
/* Canvas-based sparklines and mini-charts (zero deps) */

(function() {
  'use strict';

  /**
   * Draw a sparkline on a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} data - Array of values
   * @param {object} opts - Options: { color, lineWidth, fill, width, height }
   */
  function drawSparkline(canvas, data, opts = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !data || data.length < 2) return;

    const color = opts.color || '#3b82f6';
    const lineWidth = opts.lineWidth || 2;
    const fill = opts.fill !== false;
    const w = opts.width || canvas.width || 200;
    const h = opts.height || canvas.height || 60;

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;

    ctx.clearRect(0, 0, w, h);

    // Draw fill
    if (fill) {
      ctx.beginPath();
      ctx.moveTo(padding, h - padding);
      for (let i = 0; i < data.length; i++) {
        const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
        const y = h - padding - ((data[i] - min) / range) * (h - 2 * padding);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w - padding, h - padding);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(1, color + '05');
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < data.length; i++) {
      const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
      const y = h - padding - ((data[i] - min) / range) * (h - 2 * padding);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw end dot
    const lastX = w - padding;
    const lastY = h - padding - ((data[data.length - 1] - min) / range) * (h - 2 * padding);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Draw a horizontal bar chart.
   * @param {HTMLElement} container
   * @param {Array<{label: string, value: number, color?: string}>} items
   * @param {object} opts - Options: { maxWidth, barHeight, showLabels }
   */
  function drawBarChart(container, items, opts = {}) {
    const maxWidth = opts.maxWidth || 400;
    const barHeight = opts.barHeight || 24;
    const showLabels = opts.showLabels !== false;
    const maxValue = Math.max(...items.map(i => i.value), 1);

    container.innerHTML = items.map(item => {
      const pct = (item.value / maxValue) * 100;
      const color = item.color || '#3b82f6';
      return `
        <div class="flex items-center gap-3 mb-2">
          ${showLabels ? `<span class="text-xs text-gray-400 w-24 truncate">${esc(item.label)}</span>` : ''}
          <div class="flex-1 bg-gray-800 rounded-full h-${barHeight / 4}" style="height: ${barHeight}px">
            <div class="rounded-full transition-all duration-500" style="width: ${pct}%; height: 100%; background: ${color}"></div>
          </div>
          <span class="text-xs text-gray-400 font-mono w-16 text-right">${fmt(item.value)}</span>
        </div>`;
    }).join('');
  }

  /**
   * Draw a donut/pie chart using CSS conic-gradient.
   * @param {HTMLElement} container
   * @param {Array<{label: string, value: number, color: string}>} slices
   * @param {object} opts - Options: { size, thickness }
   */
  function drawDonutChart(container, slices, opts = {}) {
    const size = opts.size || 120;
    const thickness = opts.thickness || 20;
    const total = slices.reduce((s, i) => s + i.value, 0) || 1;

    let gradientParts = [];
    let cumulativePct = 0;
    for (const slice of slices) {
      const pct = (slice.value / total) * 100;
      gradientParts.push(`${slice.color} ${cumulativePct}% ${cumulativePct + pct}%`);
      cumulativePct += pct;
    }

    const gradient = `conic-gradient(${gradientParts.join(', ')})`;
    const innerSize = size - thickness * 2;

    container.innerHTML = `
      <div class="relative inline-block" style="width: ${size}px; height: ${size}px">
        <div class="rounded-full" style="width: ${size}px; height: ${size}px; background: ${gradient}"></div>
        <div class="absolute rounded-full bg-gray-900 flex items-center justify-center" style="width: ${innerSize}px; height: ${innerSize}px; top: ${thickness}px; left: ${thickness}px">
          <span class="text-lg font-bold text-white">${total}</span>
        </div>
      </div>
      <div class="mt-3 space-y-1">
        ${slices.map(s => `
          <div class="flex items-center gap-2 text-xs">
            <span class="w-3 h-3 rounded-full" style="background: ${s.color}"></span>
            <span class="text-gray-400">${esc(s.label)}</span>
            <span class="text-white font-mono ml-auto">${s.value}</span>
          </div>
        `).join('')}
      </div>`;
  }

  // ─── Exports ────────────────────────────────
  window.drawSparkline = drawSparkline;
  window.drawBarChart = drawBarChart;
  window.drawDonutChart = drawDonutChart;
})();
