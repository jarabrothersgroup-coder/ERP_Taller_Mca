/**
 * Analytics Dashboard — KPIs, trends, charts, and report builder.
 *
 * Features:
 *   - 4 KPI cards (revenue, OTs, avg value, completion rate)
 *   - Trend charts (revenue + OTs daily)
 *   - OT status distribution (pie chart)
 *   - Top mechanics table
 *   - Custom report builder with CSV export
 *   - Date range selector
 *
 * @module js/analytics-dashboard
 */

/* global api, esc, authHeaders, Chart */

// ─── State ──────────────────────────────────
let _analyticsState = {
  range: { from: "", to: "" },
  kpis: [],
  revenueTrend: [],
  otTrend: [],
  distribution: [],
  mechanics: [],
  charts: {},
};

// ─── Analytics View ─────────────────────────

function renderAnalyticsView(container) {
  // Default range: last 30 days
  const today = new Date();
  const from = new Date(today.getTime() - 30 * 86400000);
  _analyticsState.range = {
    from: from.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  };

  container.innerHTML = `
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 class="text-lg font-bold text-white"><svg class="w-5 h-5 inline-block -mt-0.5 mr-1.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>Analytics</h3>
          <p class="text-xs text-gray-500">KPIs, tendencias y reportes del taller</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <input id="analytics-from" type="date" value="${_analyticsState.range.from}" class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <span class="text-gray-600">—</span>
            <input id="analytics-to" type="date" value="${_analyticsState.range.to}" class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          </div>
          <button onclick="analyticsRefresh()" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Actualizar</button>
          <button onclick="analyticsExportCSV()" class="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> CSV</button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div id="analytics-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Revenue Trend -->
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Ingresos Diarios</h4>
          <div class="h-48"><canvas id="analytics-revenue-chart"></canvas></div>
        </div>

        <!-- OT Trend -->
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>OTs por Día</h4>
          <div class="h-48"><canvas id="analytics-ot-chart"></canvas></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Status Distribution -->
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>Distribución de Estados</h4>
          <div class="h-48"><canvas id="analytics-status-chart"></canvas></div>
        </div>

        <!-- Top Mechanics -->
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"/></svg>Top Mecánicos</h4>
          <div id="analytics-mechanics-list" class="space-y-2"></div>
        </div>
      </div>

      <!-- Report Builder -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-3"><svg class="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Generador de Reportes</h4>
        <div class="flex items-center gap-3 flex-wrap">
          <select id="analytics-report-type" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="summary">Resumen General</option>
            <option value="revenue">Ingresos</option>
            <option value="ots">Órdenes de Trabajo</option>
            <option value="mechanics">Mecánicos</option>
            <option value="status">Distribución Estados</option>
          </select>
          <button onclick="analyticsGenerateReport()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Generar</button>
          <button onclick="analyticsExportReportCSV()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Exportar CSV</button>
        </div>
        <div id="analytics-report-result" class="mt-3 hidden"></div>
      </div>
    </div>
  `;

  // Set date change listeners
  document.getElementById("analytics-from")?.addEventListener("change", (e) => {
    _analyticsState.range.from = e.target.value;
  });
  document.getElementById("analytics-to")?.addEventListener("change", (e) => {
    _analyticsState.range.to = e.target.value;
  });

  analyticsLoadAll();
}

// ─── Data Loading ───────────────────────────

async function analyticsLoadAll() {
  const { from, to } = _analyticsState.range;
  const params = `from=${from}&to=${to}`;

  try {
    const [kpisRes, revenueRes, otRes, distRes, mechRes] = await Promise.all([
      api(`/analytics/kpis?${params}`),
      api(`/analytics/trends/revenue?${params}`),
      api(`/analytics/trends/ots?${params}`),
      api(`/analytics/distribution?${params}`),
      api(`/analytics/mechanics?${params}`),
    ]);

    _analyticsState.kpis = kpisRes?.kpis || [];
    _analyticsState.revenueTrend = revenueRes?.trend || [];
    _analyticsState.otTrend = otRes?.trend || [];
    _analyticsState.distribution = distRes?.distribution || [];
    _analyticsState.mechanics = mechRes?.mechanics || [];

    renderKPIs();
    renderRevenueChart();
    renderOTChart();
    renderStatusChart();
    renderMechanics();
  } catch (err) {
    console.error("[Analytics] Error loading:", err);
  }
}

function analyticsRefresh() {
  const fromEl = document.getElementById("analytics-from");
  const toEl = document.getElementById("analytics-to");
  if (fromEl) _analyticsState.range.from = fromEl.value;
  if (toEl) _analyticsState.range.to = toEl.value;
  analyticsLoadAll();
}

// ─── KPI Rendering ─────────────────────────

function renderKPIs() {
  const container = document.getElementById("analytics-kpis");
  if (!container) return;

  const kpis = _analyticsState.kpis;
  const icons = ['<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>', '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>', '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'];
  const colors = ["text-green-400", "text-blue-400", "text-yellow-400", "text-purple-400"];

  container.innerHTML = kpis.map((kpi, i) => `
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500 uppercase tracking-wider">${kpi.label}</span>
        <span class="text-lg">${icons[i] || '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'}</span>
      </div>
      <div class="text-2xl font-bold ${colors[i] || "text-white"}">
        ${kpi.unit === "Gs." ? "Gs. " : ""}${typeof kpi.value === "number" ? kpi.value.toLocaleString("es-PY") : kpi.value}${kpi.unit === "%" ? "%" : ""}
      </div>
      ${kpi.change !== undefined ? `
        <div class="flex items-center gap-1 mt-1">
          <span class="text-xs ${kpi.trend === "up" ? "text-green-400" : kpi.trend === "down" ? "text-red-400" : "text-gray-500"}">
            ${kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "—"} ${Math.abs(kpi.change)}%
          </span>
          <span class="text-[10px] text-gray-600">vs período anterior</span>
        </div>
      ` : ""}
    </div>
  `).join("");
}

// ─── Chart Rendering ────────────────────────

function renderRevenueChart() {
  const canvas = document.getElementById("analytics-revenue-chart");
  if (!canvas || typeof Chart === "undefined") return;

  // Destroy existing chart
  if (_analyticsState.charts.revenue) _analyticsState.charts.revenue.destroy();

  const data = _analyticsState.revenueTrend;
  _analyticsState.charts.revenue = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((d) => d.date?.substring(5) || ""),
      datasets: [{
        label: "Ingresos (Gs.)",
        data: data.map((d) => d.value),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7280", font: { size: 10 } } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7280", font: { size: 10 }, callback: (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v } },
      },
    },
  });
}

function renderOTChart() {
  const canvas = document.getElementById("analytics-ot-chart");
  if (!canvas || typeof Chart === "undefined") return;

  if (_analyticsState.charts.ot) _analyticsState.charts.ot.destroy();

  const data = _analyticsState.otTrend;
  _analyticsState.charts.ot = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map((d) => d.date?.substring(5) || ""),
      datasets: [{
        label: "OTs",
        data: data.map((d) => d.value),
        backgroundColor: "rgba(34,197,94,0.6)",
        borderColor: "#22c55e",
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 10 } } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7280", font: { size: 10 }, stepSize: 1 } },
      },
    },
  });
}

function renderStatusChart() {
  const canvas = document.getElementById("analytics-status-chart");
  if (!canvas || typeof Chart === "undefined") return;

  if (_analyticsState.charts.status) _analyticsState.charts.status.destroy();

  const data = _analyticsState.distribution;
  const statusColors = {
    Recepcionado: "#3b82f6",
    Presupuestado: "#eab308",
    En_Proceso: "#f97316",
    Control_Calidad: "#a855f7",
    Listo: "#22c55e",
    Finalizado: "#6b7280",
  };

  _analyticsState.charts.status = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.status),
      datasets: [{
        data: data.map((d) => d.count),
        backgroundColor: data.map((d) => statusColors[d.status] || "#6b7280"),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#9ca3af", font: { size: 10 }, boxWidth: 12, padding: 8 },
        },
      },
    },
  });
}

// ─── Mechanics List ─────────────────────────

function renderMechanics() {
  const container = document.getElementById("analytics-mechanics-list");
  if (!container) return;

  const mechanics = _analyticsState.mechanics;
  if (!mechanics.length) {
    container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Sin datos</p>';
    return;
  }

  const maxOTs = Math.max(...mechanics.map((m) => m.otCount));

  container.innerHTML = mechanics.map((m, i) => `
    <div class="flex items-center gap-3 py-2">
      <span class="text-xs text-gray-600 w-4">${i + 1}.</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm text-white truncate">${esc(m.name)}</span>
          <span class="text-xs text-gray-500">${m.otCount} OTs</span>
        </div>
        <div class="h-1.5 bg-gray-800 rounded-full">
          <div class="h-1.5 bg-blue-500 rounded-full" style="width: ${(m.otCount / maxOTs) * 100}%"></div>
        </div>
      </div>
      <span class="text-xs text-gray-500 flex-shrink-0">Gs. ${m.revenue?.toLocaleString("es-PY") || "0"}</span>
    </div>
  `).join("");
}

// ─── Report Builder ─────────────────────────

async function analyticsGenerateReport() {
  const type = document.getElementById("analytics-report-type")?.value;
  const { from, to } = _analyticsState.range;
  const resultEl = document.getElementById("analytics-report-result");
  if (!resultEl) return;

  try {
    const result = await api("/analytics/report", {
      method: "POST",
      body: { type, from, to },
    });

    resultEl.classList.remove("hidden");

    if (result.kpis) {
      resultEl.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${result.kpis.map((kpi) => `
            <div class="bg-gray-800/50 rounded-lg p-3">
              <p class="text-xs text-gray-500">${kpi.label}</p>
              <p class="text-lg font-bold text-white">${kpi.unit === "Gs." ? "Gs. " : ""}${kpi.value.toLocaleString("es-PY")}${kpi.unit === "%" ? "%" : ""}</p>
            </div>
          `).join("")}
        </div>
      `;
    } else if (result.trend) {
      resultEl.innerHTML = `<p class="text-sm text-gray-400">${result.trend.length} datos generados</p>`;
    } else if (result.mechanics) {
      resultEl.innerHTML = `<p class="text-sm text-gray-400">${result.mechanics.length} mecánicos en reporte</p>`;
    } else if (result.distribution) {
      resultEl.innerHTML = `<p class="text-sm text-gray-400">${result.distribution.length} estados en distribución</p>`;
    }
  } catch (err) {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `<p class="text-sm text-red-400">Error: ${err.message}</p>`;
  }
}

async function analyticsExportReportCSV() {
  const type = document.getElementById("analytics-report-type")?.value;
  const { from, to } = _analyticsState.range;

  try {
    const response = await fetch(`/analytics/report/csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ type, from, to }),
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${type}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error exportando: ${err.message}`, 'error');
  }
}

async function analyticsExportCSV() {
  const { from, to } = _analyticsState.range;

  try {
    const response = await fetch(`/analytics/report/csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ type: "revenue", from, to }),
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingresos-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error exportando: ${err.message}`, 'error');
  }
}

// ─── Exports ────────────────────────────────

window.renderAnalyticsView = renderAnalyticsView;
window.analyticsRefresh = analyticsRefresh;
window.analyticsGenerateReport = analyticsGenerateReport;
window.analyticsExportReportCSV = analyticsExportReportCSV;
window.analyticsExportCSV = analyticsExportCSV;
