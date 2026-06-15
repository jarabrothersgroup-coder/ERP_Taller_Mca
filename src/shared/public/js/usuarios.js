function renderUsers(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Gestiona los perfiles del taller</p>
      <button id="add-user-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Usuario</button>
    </div>
    <div id="users-table-wrap" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Email</th>
            <th class="text-left px-4 py-3">Rol</th>
            <th class="text-left px-4 py-3">Estado</th>
            <th class="text-right px-4 py-3">Acciones</th>
          </tr></thead>
          <tbody id="users-tbody"><tr><td colspan="5" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchUsers();
}

async function fetchUsers() {
  try {
    const profiles = await api('/api/profiles');
    state.cachedProfiles = profiles || [];
    renderUsersTable();
  } catch {
    document.querySelector('#users-tbody').innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Error al cargar</td></tr>';
  }
}

function renderUsersTable() {
  const tbody = document.querySelector('#users-tbody');
  if (!state.cachedProfiles.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Sin usuarios registrados</td></tr>';
    return;
  }
  tbody.innerHTML = state.cachedProfiles.map(p => `
    <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
      <td class="px-4 py-3 font-medium">${esc(p.full_name)}</td>
      <td class="px-4 py-3 text-gray-400">${esc(p.email)}</td>
      <td class="px-4 py-3"><span class="status-badge ${roleBadge(p.role)}">${p.role}</span></td>
      <td class="px-4 py-3">${p.is_active ? '<span class="text-green-400 text-xs">● Activo</span>' : '<span class="text-red-400 text-xs">● Inactivo</span>'}</td>
      <td class="px-4 py-3 text-right">
        <button class="edit-user-btn text-blue-400 hover:text-blue-300 text-xs mr-2" data-id="${p.id}">Editar</button>
        <button class="delete-user-btn text-red-400 hover:text-red-300 text-xs" data-id="${p.id}">${p.is_active ? 'Desactivar' : '—'}</button>
      </td>
    </tr>`).join('');
}


function showUserModal(profile) {
  const isEdit = !!profile;
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">${isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="user-form" class="space-y-4">
      <input type="hidden" id="user-id" value="${isEdit ? profile.id : ''}">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre Completo</label>
        <input id="user-name" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" value="${isEdit ? esc(profile.full_name) : ''}" required>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
        <input id="user-email" type="email" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" value="${isEdit ? esc(profile.email) : ''}" required>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Rol</label>
        <select id="user-role" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          <option value="mechanic" ${isEdit && profile.role === 'mechanic' ? 'selected' : ''}>Mecánico</option>
          <option value="manager" ${isEdit && profile.role === 'manager' ? 'selected' : ''}>Supervisor</option>
          <option value="admin" ${isEdit && profile.role === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="user" ${isEdit && profile.role === 'user' ? 'selected' : ''}>Usuario</option>
        </select>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">${isEdit ? 'Guardar Cambios' : 'Crear Usuario'}</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="user-form-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.querySelector('#user-id')?.value || '';
  const name = document.querySelector('#user-name')?.value?.trim();
  const email = document.querySelector('#user-email')?.value?.trim();
  const role = document.querySelector('#user-role')?.value;
  if (!name || !email) { showUserFormError('Completa todos los campos'); return; }
  try {
    if (id) {
      await api(`/api/profiles/${id}`, { method: 'PATCH', body: { fullName: name, email, role } });
    } else {
      await api('/api/profiles', { method: 'POST', body: { fullName: name, email, role } });
    }
    closeModal();
    fetchUsers();
  } catch (err) {
    showUserFormError(err.message);
  }
}

function showUserFormError(msg) {
  const el = document.querySelector('#user-form-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function closeModal() {
  dom.modalOverlay.classList.add('hidden');
  dom.modalContent.innerHTML = '';
  state.subscribedOrderId = null;
}

