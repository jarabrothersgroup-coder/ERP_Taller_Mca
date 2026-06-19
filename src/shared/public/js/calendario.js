/**
 * Calendario — Visual Calendar Module (Enhanced).
 *
 * Frontend module for:
 *   - Week view with drag-and-drop appointments
 *   - Full backend integration (CRUD via scheduling API)
 *   - Create/edit/cancel appointments via modal
 *   - Week navigation
 *   - Service type selection (RAPIDO/PESADO)
 *   - Availability check
 *
 * @module js/calendario
 */

/* global api, esc */

// ─── State ──────────────────────────────────
let _calState = {
  currentWeekStart: _calGetWeekStart(new Date()),
  appointments: [],
  loading: false,
};

function _calGetWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _calFormatDate(date) {
  return date.toISOString().split('T')[0];
}

// ─── Calendar View ──────────────────────────

function renderCalendario(container) {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  container.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">📅 Calendario de Turnos</h3>
          <p class="text-xs text-gray-500" id="cal-week-label">Semana actual</p>
        </div>
        <div class="flex gap-2">
          <button onclick="calChangeWeek(-1)" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">← Anterior</button>
          <button onclick="calGoToToday()" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Hoy</button>
          <button onclick="calChangeWeek(1)" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">Siguiente →</button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="flex gap-4 text-xs text-gray-500">
        <span>📋 <span id="cal-total">0</span> turnos</span>
        <span>✅ <span id="cal-confirmed">0</span> confirmados</span>
        <span>⏳ <span id="cal-pending">0</span> pendientes</span>
      </div>

      <!-- Week Header -->
      <div class="grid grid-cols-7 gap-2">
        ${days.map((d, i) => {
          const date = new Date(_calState.currentWeekStart);
          date.setDate(date.getDate() + i);
          const isToday = date.toDateString() === new Date().toDateString();
          return `<div class="text-center ${isToday ? 'text-blue-400 font-bold' : 'text-gray-500'} font-semibold text-sm py-2">${d} ${date.getDate()}</div>`;
        }).join('')}
      </div>

      <!-- Calendar Grid -->
      <div id="cal-grid" class="grid grid-cols-7 gap-2"></div>

      <!-- Loading Indicator -->
      <div id="cal-loading" class="hidden text-center py-4">
        <span class="inline-block animate-spin mr-2">⟳</span> Cargando turnos...
      </div>
    </div>

    <!-- Appointment Modal -->
    <div id="cal-modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 modal-content">
        <h3 class="text-lg font-bold text-white mb-4" id="cal-modal-title">Nuevo Turno</h3>
        <form id="cal-form" class="space-y-4">
          <input type="hidden" id="cal-modal-date">
          <input type="hidden" id="cal-modal-edit-id">
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cliente *</label>
            <input type="text" id="cal-modal-client" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Teléfono *</label>
            <input type="tel" id="cal-modal-phone" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Vehículo (Chapa) *</label>
            <input type="text" id="cal-modal-vehicle" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Marca</label>
              <input type="text" id="cal-modal-brand" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Toyota">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Modelo</label>
              <input type="text" id="cal-modal-model" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Corolla">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Servicio *</label>
            <select id="cal-modal-service" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="RAPIDO">Rápido (1h)</option>
              <option value="PESADO">Pesado (4h)</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Hora *</label>
            <select id="cal-modal-time" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
              ${_calTimeSlots().map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Notas</label>
            <textarea id="cal-modal-notes" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Diagnóstico previo, observaciones..."></textarea>
          </div>
          <div id="cal-availability-msg" class="hidden text-xs rounded-lg p-2"></div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition" id="cal-submit-btn">Guardar</button>
            <button type="button" onclick="calCloseModal()" class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Cancelar</button>
          </div>
          <button type="button" id="cal-cancel-btn" onclick="calCancelAppointment()" class="hidden w-full py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/40 transition">Cancelar Turno</button>
        </form>
      </div>
    </div>
  `;

  // Check availability on time/date change
  document.getElementById('cal-modal-time')?.addEventListener('change', _calCheckAvailability);

  // Load appointments
  _calLoadAppointments();

  // Form submit
  document.getElementById('cal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _calSaveAppointment();
  });
}

function _calTimeSlots() {
  const slots = [];
  for (let h = 7; h <= 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

function _calRenderGrid() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const weekLabel = document.getElementById('cal-week-label');
  if (weekLabel) {
    const end = new Date(_calState.currentWeekStart);
    end.setDate(end.getDate() + 6);
    weekLabel.textContent = `${_calState.currentWeekStart.getDate()}/${_calState.currentWeekStart.getMonth() + 1} — ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  }

  // Update stats
  const confirmed = _calState.appointments.filter(a => a.estado === 'CONFIRMADO').length;
  const pending = _calState.appointments.filter(a => a.estado === 'RESERVADO').length;
  const totalEl = document.getElementById('cal-total');
  const confirmedEl = document.getElementById('cal-confirmed');
  const pendingEl = document.getElementById('cal-pending');
  if (totalEl) totalEl.textContent = _calState.appointments.length;
  if (confirmedEl) confirmedEl.textContent = confirmed;
  if (pendingEl) pendingEl.textContent = pending;

  for (let i = 0; i < 7; i++) {
    const date = new Date(_calState.currentWeekStart);
    date.setDate(date.getDate() + i);

    const isToday = date.toDateString() === new Date().toDateString();
    const apts = _calGetAppointmentsForDate(date);

    const dayDiv = document.createElement('div');
    dayDiv.className = `bg-gray-900/60 rounded-xl p-3 min-h-[140px] border ${isToday ? 'border-blue-500/50' : 'border-gray-800'}`;
    dayDiv.ondragover = (e) => e.preventDefault();
    dayDiv.ondrop = (e) => _calHandleDrop(e, date);

    const estadoColors = {
      'RESERVADO': 'bg-yellow-600/20 border-yellow-500/30',
      'CONFIRMADO': 'bg-green-600/20 border-green-500/30',
      'PROCESADO_EN_ERP': 'bg-blue-600/20 border-blue-500/30',
      'AUSENTE': 'bg-gray-600/20 border-gray-500/30',
      'CANCELADO': 'bg-red-600/20 border-red-500/30',
    };

    dayDiv.innerHTML = `
      <div class="space-y-1" id="cal-day-${i}">
        ${apts.map(apt => `
          <div class="${estadoColors[apt.estado] || 'bg-blue-600/20 border-blue-500/30'} border rounded px-2 py-1.5 text-xs cursor-grab hover:opacity-80 transition"
               draggable="true"
               ondragstart="calDragStart(event, '${esc(apt.id)}')"
               onclick="calEditAppointment('${esc(apt.id)}')">
            <div class="flex items-center justify-between">
              <span class="text-white font-medium">${esc(apt.hora || '09:00')}</span>
              <span class="text-[10px] px-1 rounded ${apt.estado === 'CONFIRMADO' ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}">${esc(apt.estado || 'RESERVADO')}</span>
            </div>
            <div class="text-gray-300 mt-0.5 truncate">${esc(apt.clienteNombre || '')}</div>
            <div class="text-gray-500 text-[10px] truncate">${esc(apt.vehiculoChapa || '')}</div>
          </div>
        `).join('')}
      </div>
      <button onclick="calOpenModal('${_calFormatDate(date)}')" class="mt-2 text-xs text-gray-600 hover:text-white transition">+ Agregar</button>
    `;

    grid.appendChild(dayDiv);
  }
}

function _calGetAppointmentsForDate(date) {
  return _calState.appointments.filter(apt => {
    const aptDate = new Date(apt.fechaTurno);
    return aptDate.toDateString() === date.toDateString();
  });
}

// ─── Drag & Drop ────────────────────────────

let _calDraggedId = null;

function calDragStart(e, id) {
  _calDraggedId = id;
  e.dataTransfer.effectAllowed = 'move';
}

async function _calHandleDrop(e, newDate) {
  e.preventDefault();
  if (!_calDraggedId) return;

  const apt = _calState.appointments.find(a => a.id === _calDraggedId);
  if (apt) {
    // Update via API
    try {
      await api(`/scheduling/appointments/${apt.id}`, {
        method: 'PATCH',
        body: { fechaTurno: _calFormatDate(newDate) },
      });
      apt.fechaTurno = _calFormatDate(newDate);
      _calRenderGrid();
    } catch (err) {
      console.error('[Calendario] Error moving appointment:', err);
    }
  }
  _calDraggedId = null;
}

// ─── Modal ──────────────────────────────────

function calOpenModal(dateStr, aptData = null) {
  document.getElementById('cal-modal-date').value = dateStr;
  document.getElementById('cal-modal-edit-id').value = aptData?.id || '';
  document.getElementById('cal-modal-title').textContent = aptData ? 'Editar Turno' : 'Nuevo Turno';
  document.getElementById('cal-submit-btn').textContent = aptData ? 'Actualizar' : 'Guardar';
  document.getElementById('cal-cancel-btn').classList.toggle('hidden', !aptData);

  if (aptData) {
    document.getElementById('cal-modal-client').value = aptData.clienteNombre || '';
    document.getElementById('cal-modal-phone').value = aptData.clientePhone || '';
    document.getElementById('cal-modal-vehicle').value = aptData.vehiculoChapa || '';
    document.getElementById('cal-modal-brand').value = aptData.vehiculoMarca || '';
    document.getElementById('cal-modal-model').value = aptData.vehiculoModelo || '';
    document.getElementById('cal-modal-service').value = aptData.tipoServicio || 'RAPIDO';
    document.getElementById('cal-modal-time').value = aptData.horaTurno || '09:00';
    document.getElementById('cal-modal-notes').value = aptData.notas || '';
  } else {
    document.getElementById('cal-modal-client').value = '';
    document.getElementById('cal-modal-phone').value = '';
    document.getElementById('cal-modal-vehicle').value = '';
    document.getElementById('cal-modal-brand').value = '';
    document.getElementById('cal-modal-model').value = '';
    document.getElementById('cal-modal-service').value = 'RAPIDO';
    document.getElementById('cal-modal-time').value = '09:00';
    document.getElementById('cal-modal-notes').value = '';
  }

  document.getElementById('cal-modal').classList.remove('hidden');
  document.getElementById('cal-modal').classList.add('flex');
}

function calEditAppointment(id) {
  const apt = _calState.appointments.find(a => a.id === id);
  if (apt) {
    calOpenModal(apt.fechaTurno, apt);
  }
}

function calCloseModal() {
  document.getElementById('cal-modal').classList.add('hidden');
  document.getElementById('cal-modal').classList.remove('flex');
  document.getElementById('cal-availability-msg')?.classList.add('hidden');
}

async function _calCheckAvailability() {
  const date = document.getElementById('cal-modal-date')?.value;
  const time = document.getElementById('cal-modal-time')?.value;
  const service = document.getElementById('cal-modal-service')?.value;
  const msgEl = document.getElementById('cal-availability-msg');
  if (!date || !time || !service || !msgEl) return;

  try {
    const result = await api('/scheduling/check-availability', {
      method: 'POST',
      body: { fecha: date, hora: time, tipoServicio: service },
    });

    msgEl.classList.remove('hidden');
    if (result?.available) {
      msgEl.className = 'text-xs rounded-lg p-2 bg-green-900/30 text-green-400 border border-green-800/50';
      msgEl.textContent = '✅ Horario disponible';
    } else {
      msgEl.className = 'text-xs rounded-lg p-2 bg-red-900/30 text-red-400 border border-red-800/50';
      msgEl.textContent = `❌ ${result?.message || 'Horario no disponible'}`;
    }
  } catch (err) {
    msgEl.classList.add('hidden');
  }
}

async function _calSaveAppointment() {
  const editId = document.getElementById('cal-modal-edit-id')?.value;

  const data = {
    clienteNombre: document.getElementById('cal-modal-client')?.value,
    clientePhone: document.getElementById('cal-modal-phone')?.value,
    vehiculoChapa: document.getElementById('cal-modal-vehicle')?.value,
    vehiculoMarca: document.getElementById('cal-modal-brand')?.value || 'N/A',
    vehiculoModelo: document.getElementById('cal-modal-model')?.value || 'N/A',
    fechaTurno: document.getElementById('cal-modal-date')?.value,
    horaTurno: document.getElementById('cal-modal-time')?.value,
    tipoServicio: document.getElementById('cal-modal-service')?.value,
    notas: document.getElementById('cal-modal-notes')?.value,
  };

  try {
    if (editId) {
      // Update existing
      await api(`/scheduling/appointments/${editId}`, {
        method: 'PATCH',
        body: data,
      });
    } else {
      // Create new
      await api('/scheduling/appointments', {
        method: 'POST',
        body: data,
      });
    }

    calCloseModal();
    await _calLoadAppointments();
  } catch (err) {
    console.error('[Calendario] Error saving appointment:', err);
    alert('Error al guardar el turno. Intente nuevamente.');
  }
}

async function calCancelAppointment() {
  const editId = document.getElementById('cal-modal-edit-id')?.value;
  if (!editId) return;

  if (!confirm('¿Cancelar este turno?')) return;

  try {
    await api(`/scheduling/appointments/${editId}`, {
      method: 'PATCH',
      body: { estado: 'CANCELADO' },
    });
    calCloseModal();
    await _calLoadAppointments();
  } catch (err) {
    console.error('[Calendario] Error canceling appointment:', err);
  }
}

// ─── Navigation ─────────────────────────────

function calChangeWeek(direction) {
  _calState.currentWeekStart.setDate(_calState.currentWeekStart.getDate() + (direction * 7));
  _calRenderGrid();
}

function calGoToToday() {
  _calState.currentWeekStart = _calGetWeekStart(new Date());
  _calRenderGrid();
}

// ─── Data Loading ───────────────────────────

async function _calLoadAppointments() {
  const loadingEl = document.getElementById('cal-loading');
  loadingEl?.classList.remove('hidden');
  _calState.loading = true;

  try {
    const data = await api('/scheduling/appointments');
    if (Array.isArray(data)) {
      _calState.appointments = data;
    }
    _calRenderGrid();
  } catch (err) {
    console.error('[Calendario] Error loading appointments:', err);
  } finally {
    _calState.loading = false;
    loadingEl?.classList.add('hidden');
  }
}
