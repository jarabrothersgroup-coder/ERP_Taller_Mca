/* ─── Nómina / Payroll ───────────────────── */
/* Sprint 13 — Expose existing backend payroll endpoints */

function renderPayroll(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400">Comisiones de mecánicos, punto de equilibrio y cálculo mensual</p>
        <button id="payroll-calc-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Calcular Nómina</button>
      </div>

      <!-- Break-Even Card -->
      <div class="bg-gray-900/60 rounded-xl p-6 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Punto de Equilibrio</h3>
        <div id="payroll-breakeven" class="space-y-4">
          <div class="text-center text-gray-500 text-sm py-4">Cargando...</div>
        </div>
      </div>

      <!-- Calculation Result -->
      <div id="payroll-result" class="bg-gray-900/60 rounded-xl p-6 border border-gray-800 card-glow hidden">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Resultado del Cálculo</h3>
        <div id="payroll-result-content"></div>
      </div>
    </div>`;
  loadPayrollBreakEven();
}

async function loadPayrollBreakEven() {
  const el = document.getElementById('payroll-breakeven');
  if (!el) return;
  try {
    const data = await api('/api/v1/finance/dashboard/break-even');
    if (!data || data.error) {
      el.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">No hay datos de equilibrio</div>';
      return;
    }
    const pct = Number(data.percentage || 0).toFixed(1);
    const current = Number(data.currentRevenue || 0);
    const threshold = Number(data.threshold || 0);
    const remaining = Number(data.remaining || 0);
    const barColor = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500';

    el.innerHTML = `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="text-xs text-gray-500 uppercase">Ingresos Netos</div>
          <div class="text-lg font-bold text-white mt-1">₲ ${fmt(current)}</div>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="text-xs text-gray-500 uppercase">Umbral (Gastos Fijos)</div>
          <div class="text-lg font-bold text-white mt-1">₲ ${fmt(threshold)}</div>
        </div>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-500">Progreso al punto de equilibrio</span>
          <span class="text-sm font-bold ${pct >= 100 ? 'text-green-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400'}">${pct}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-3">
          <div class="${barColor} h-3 rounded-full progress-bar" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        ${remaining > 0 ? `<p class="text-xs text-gray-500 mt-2">Faltan ₲ ${fmt(remaining)} para alcanzar el punto de equilibrio</p>` : '<p class="text-xs text-green-400 mt-2">¡Punto de equilibrio alcanzado!</p>'}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="text-center text-red-400 text-sm py-4">${esc(e.message)}</div>`;
  }
}

async function calcularNomina() {
  const btn = document.getElementById('payroll-calc-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Calculando...'; }
  try {
    const now = new Date();
    const data = await api('/api/v1/finance/payroll/calculate', {
      method: 'POST',
      body: { month: now.getMonth() + 1, year: now.getFullYear() },
    });
    const resultEl = document.getElementById('payroll-result');
    const contentEl = document.getElementById('payroll-result-content');
    if (resultEl && contentEl) {
      resultEl.classList.remove('hidden');
      const pct = Number(data.percentage || 0).toFixed(1);
      contentEl.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <div class="text-xs text-gray-500">Comisiones Creadas</div>
            <div class="text-lg font-bold text-blue-400">${data.commissionsCreated || 0}</div>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <div class="text-xs text-gray-500">Equilibrio</div>
            <div class="text-lg font-bold ${pct >= 100 ? 'text-green-400' : 'text-yellow-400'}">${pct}%</div>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <div class="text-xs text-gray-500">Neto Labor</div>
            <div class="text-lg font-bold text-white">₲ ${fmt(data.netLaborRevenue || 0)}</div>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <div class="text-xs text-gray-500">Gastos Fijos</div>
            <div class="text-lg font-bold text-white">₲ ${fmt(data.totalFixedExpenses || 0)}</div>
          </div>
        </div>
        <p class="text-xs text-gray-500">Asiento contable NÓMINA generado automáticamente.</p>`;
      // Refresh break-even
      loadPayrollBreakEven();
    }
  } catch (e) {
    alert('Error al calcular nómina: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Calcular Nómina'; }
  }
}
