// Auth guard - admin only
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user) { window.location.href = '/login.html'; }
if (user && user.role !== 'admin') { window.location.href = '/dashboard.html'; }

// API helper
async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  return res;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Page navigation
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const navItem = document.querySelector(`[data-page="${name}"]`);
  if (navItem) navItem.classList.add('active');
  const titles = { overview: 'Admin Overview', 'all-requests': 'All Requests', clients: 'Client Management', categories: 'Service Categories' };
  document.getElementById('page-title').textContent = titles[name] || name;
  if (name === 'overview') loadAdminOverview();
  if (name === 'all-requests') loadAllRequests();
  if (name === 'clients') loadClients();
  if (name === 'categories') loadCategories();
  document.getElementById('sidebar').classList.remove('open');
}

// Helpers
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
function formatDateTime(d) { return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

function statusBadge(s) {
  const labels = { pending:'Pending', in_progress:'In Progress', on_hold:'On Hold', completed:'Completed', cancelled:'Cancelled' };
  const icons = { pending:'fa-clock', in_progress:'fa-spinner', on_hold:'fa-pause', completed:'fa-check-circle', cancelled:'fa-times-circle' };
  return `<span class="status-badge status-${s}"><i class="fas ${icons[s]||'fa-circle'}"></i> ${labels[s]||s}</span>`;
}
function priorityBadge(p) {
  const icons = { low:'fa-arrow-down', medium:'fa-minus', high:'fa-arrow-up', urgent:'fa-exclamation' };
  return `<span class="priority-badge priority-${p}"><i class="fas ${icons[p]||'fa-minus'}"></i> ${p.charAt(0).toUpperCase()+p.slice(1)}</span>`;
}
function setBtn(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Set admin info
function setAdminInfo() {
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('user-name-sidebar').textContent = user.name;
  document.getElementById('user-avatar-sidebar').textContent = initials;
}

// ===== ADMIN OVERVIEW =====
async function loadAdminOverview() {
  try {
    const res = await api('/api/admin/stats');
    if (!res) return;
    const s = await res.json();
    document.getElementById('a-total-clients').textContent = s.totalClients;
    document.getElementById('a-total-requests').textContent = s.totalRequests;
    document.getElementById('a-pending').textContent = s.pending;
    document.getElementById('a-progress').textContent = s.in_progress;
    document.getElementById('a-completed').textContent = s.completed;
    document.getElementById('a-categories').textContent = s.categories;
    if (s.pending > 0) document.getElementById('pending-badge-admin').textContent = s.pending;

    // Recent requests
    const rRes = await api('/api/admin/requests');
    if (!rRes) return;
    const requests = await rRes.json();
    const recent = requests.slice(0, 6);
    const list = document.getElementById('admin-recent-list');

    if (recent.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No requests yet</h3><p>Requests will appear here once clients submit them.</p></div>`;
      return;
    }

    list.innerHTML = `<div class="admin-recent-list">` +
      recent.map(r => `
        <div class="request-row">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.85rem;flex-shrink:0">
            ${r.client_name.charAt(0).toUpperCase()}
          </div>
          <div class="req-info">
            <div class="req-title-text">${escHtml(r.title)}</div>
            <div class="req-meta-small">${escHtml(r.client_name)}${r.company ? ` · ${escHtml(r.company)}` : ''} · ${formatDate(r.created_at)}</div>
          </div>
          ${priorityBadge(r.priority)}
          ${statusBadge(r.status)}
          <button class="btn-edit-status" onclick="openStatusModal(${r.id},'${escHtml(r.title)}','${r.status}')">
            <i class="fas fa-edit"></i> Update
          </button>
        </div>`).join('') + `</div>`;
  } catch (e) {
    console.error(e);
  }
}

// ===== ALL REQUESTS =====
async function loadAllRequests() {
  const status = document.getElementById('a-filter-status')?.value || '';
  const priority = document.getElementById('a-filter-priority')?.value || '';
  let url = '/api/admin/requests?';
  if (status) url += `status=${status}&`;
  if (priority) url += `priority=${priority}&`;

  const list = document.getElementById('admin-requests-list');
  list.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

  try {
    const res = await api(url);
    if (!res) return;
    const requests = await res.json();

    if (requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No requests found</h3><p>Try adjusting your filters.</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="card">
        <div class="requests-table-wrap">
          <table class="requests-table">
            <thead><tr><th>#</th><th>Client</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              ${requests.map(r => `
                <tr>
                  <td><small style="color:#94a3b8">#${r.id}</small></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:0.6rem">
                      <div class="client-avatar">${r.client_name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style="font-weight:600;font-size:0.88rem">${escHtml(r.client_name)}</div>
                        ${r.company ? `<div style="font-size:0.76rem;color:#94a3b8">${escHtml(r.company)}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td><strong>${escHtml(r.title)}</strong></td>
                  <td>${escHtml(r.category_name)}</td>
                  <td>${priorityBadge(r.priority)}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td>${formatDate(r.created_at)}</td>
                  <td>
                    <button class="btn-edit-status" onclick="openStatusModal(${r.id},'${escHtml(r.title).replace(/'/g,"\\'")}','${r.status}')">
                      <i class="fas fa-edit"></i> Update
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load requests.</p></div>`;
  }
}

function resetAdminFilters() {
  document.getElementById('a-filter-status').value = '';
  document.getElementById('a-filter-priority').value = '';
  loadAllRequests();
}

// ===== STATUS MODAL =====
function openStatusModal(id, title, currentStatus) {
  document.getElementById('modal-request-id').value = id;
  document.getElementById('modal-request-title').textContent = title;
  document.getElementById('new-status').value = currentStatus;
  document.getElementById('admin-notes').value = '';
  document.getElementById('status-alert').classList.add('hidden');
  document.getElementById('status-modal').classList.remove('hidden');
}

async function submitStatusUpdate() {
  const id = document.getElementById('modal-request-id').value;
  const status = document.getElementById('new-status').value;
  const notes = document.getElementById('admin-notes').value.trim();
  const btn = document.getElementById('status-update-btn');
  const alertEl = document.getElementById('status-alert');

  setBtn(btn, true);
  alertEl.classList.add('hidden');

  try {
    const res = await api(`/api/admin/requests/${id}/status`, {
      method: 'PUT', body: JSON.stringify({ status, notes })
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      alertEl.className = 'alert error';
      alertEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.error}`;
      alertEl.classList.remove('hidden');
      return;
    }
    alertEl.className = 'alert success';
    alertEl.innerHTML = `<i class="fas fa-check-circle"></i> Status updated successfully!`;
    alertEl.classList.remove('hidden');
    setTimeout(() => {
      closeModal('status-modal');
      loadAdminOverview();
      // Refresh current page if on requests
      const activePage = document.querySelector('.page.active');
      if (activePage?.id === 'page-all-requests') loadAllRequests();
    }, 1200);
  } catch {
    alertEl.className = 'alert error';
    alertEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Network error.`;
    alertEl.classList.remove('hidden');
  } finally { setBtn(btn, false); }
}

// ===== CLIENTS =====
async function loadClients() {
  const list = document.getElementById('clients-list');
  list.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;
  try {
    const res = await api('/api/admin/clients');
    if (!res) return;
    const clients = await res.json();

    if (clients.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><h3>No clients yet</h3><p>Clients will appear here after registration.</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="card">
        <div class="clients-table-wrap">
          <table class="clients-table">
            <thead><tr><th>Client</th><th>Email</th><th>Company</th><th>Phone</th><th>Requests</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${clients.map(c => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:0.7rem">
                      <div class="client-avatar">${c.name.charAt(0).toUpperCase()}</div>
                      <strong>${escHtml(c.name)}</strong>
                    </div>
                  </td>
                  <td>${escHtml(c.email)}</td>
                  <td>${c.company ? escHtml(c.company) : '<span style="color:#94a3b8">—</span>'}</td>
                  <td>${c.phone ? escHtml(c.phone) : '<span style="color:#94a3b8">—</span>'}</td>
                  <td><span style="font-weight:700;color:#6366f1">${c.request_count}</span></td>
                  <td>${formatDate(c.created_at)}</td>
                  <td><span class="account-${c.status}">${c.status.charAt(0).toUpperCase()+c.status.slice(1)}</span></td>
                  <td>
                    <button class="btn-toggle-status ${c.status==='suspended'?'activate':''}"
                      onclick="toggleClientStatus(${c.id},'${c.status==='active'?'suspended':'active'}',this)">
                      <i class="fas ${c.status==='active'?'fa-ban':'fa-check'}"></i>
                      ${c.status==='active'?'Suspend':'Activate'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load clients.</p></div>`;
  }
}

async function toggleClientStatus(id, newStatus, btn) {
  btn.disabled = true;
  try {
    const res = await api(`/api/admin/clients/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
    if (!res) return;
    const data = await res.json();
    if (res.ok) loadClients();
    else alert(data.error || 'Failed to update status.');
  } catch { alert('Network error.'); }
  finally { btn.disabled = false; }
}

// ===== CATEGORIES =====
async function loadCategories() {
  const list = document.getElementById('categories-list');
  list.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;
  try {
    const res = await api('/api/admin/categories');
    if (!res) return;
    const cats = await res.json();

    if (cats.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-tags"></i><h3>No categories yet</h3></div>`;
      return;
    }

    list.innerHTML = `<div class="categories-grid">` +
      cats.map(c => `
        <div class="category-card">
          <div class="cat-icon-wrap"><i class="${c.icon || 'fas fa-cog'}"></i></div>
          <h3>${escHtml(c.name)}</h3>
          <p>${c.description ? escHtml(c.description) : '<em style="color:#94a3b8">No description</em>'}</p>
          <div class="cat-footer">
            <span class="cat-status-${c.status}">${c.status.charAt(0).toUpperCase()+c.status.slice(1)}</span>
            <div class="cat-actions">
              <button class="btn-cat-edit" onclick="openCategoryModal(${c.id},'${escHtml(c.name).replace(/'/g,"\\'")}','${escHtml(c.description||'').replace(/'/g,"\\'")}','${c.icon||'fas fa-cog'}')">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="btn-del" onclick="deleteCategory(${c.id})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>`).join('') + `</div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load categories.</p></div>`;
  }
}

function openCategoryModal(id, name, desc, icon) {
  document.getElementById('cat-edit-id').value = id || '';
  document.getElementById('cat-name').value = name || '';
  document.getElementById('cat-desc').value = desc || '';
  document.getElementById('cat-icon').value = icon || '';
  document.getElementById('cat-name-error').textContent = '';
  document.getElementById('cat-alert').classList.add('hidden');
  document.getElementById('cat-modal-title').innerHTML = id
    ? '<i class="fas fa-edit"></i> Edit Category'
    : '<i class="fas fa-plus"></i> Add Category';
  document.getElementById('cat-modal').classList.remove('hidden');
}

async function submitCategory() {
  const id = document.getElementById('cat-edit-id').value;
  const name = document.getElementById('cat-name').value.trim();
  const description = document.getElementById('cat-desc').value.trim();
  const icon = document.getElementById('cat-icon').value.trim() || 'fas fa-cog';
  const alertEl = document.getElementById('cat-alert');
  const btn = document.getElementById('cat-submit-btn');

  document.getElementById('cat-name-error').textContent = '';
  if (!name) { document.getElementById('cat-name-error').textContent = 'Category name is required.'; return; }

  setBtn(btn, true);
  alertEl.classList.add('hidden');

  try {
    const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, body: JSON.stringify({ name, description, icon }) });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      alertEl.className = 'alert error';
      alertEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.error}`;
      alertEl.classList.remove('hidden');
      return;
    }
    alertEl.className = 'alert success';
    alertEl.innerHTML = `<i class="fas fa-check-circle"></i> Category saved!`;
    alertEl.classList.remove('hidden');
    setTimeout(() => { closeModal('cat-modal'); loadCategories(); }, 1000);
  } catch {
    alertEl.className = 'alert error';
    alertEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Network error.`;
    alertEl.classList.remove('hidden');
  } finally { setBtn(btn, false); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? If it has existing requests, it will be deactivated instead.')) return;
  try {
    const res = await api(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (res.ok) loadCategories();
    else alert(data.error || 'Failed to delete.');
  } catch { alert('Network error.'); }
}

// Close modals on overlay click
document.getElementById('status-modal')?.addEventListener('click', function(e) { if (e.target===this) closeModal('status-modal'); });
document.getElementById('cat-modal')?.addEventListener('click', function(e) { if (e.target===this) closeModal('cat-modal'); });

// Init
setAdminInfo();
loadAdminOverview();
