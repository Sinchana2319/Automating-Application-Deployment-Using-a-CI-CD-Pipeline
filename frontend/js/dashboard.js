// Auth guard
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user) { window.location.href = '/login.html'; }
if (user && user.role === 'admin') { window.location.href = '/admin.html'; }

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

// Show page
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const navItem = document.querySelector(`[data-page="${name}"]`);
  if (navItem) navItem.classList.add('active');
  const titles = { overview: 'Overview', requests: 'My Requests', 'new-request': 'New Request', profile: 'My Profile' };
  document.getElementById('page-title').textContent = titles[name] || name;
  // Load data per page
  if (name === 'overview') loadOverview();
  if (name === 'requests') loadRequests();
  if (name === 'new-request') loadCategories();
  if (name === 'profile') loadProfile();
  document.getElementById('sidebar').classList.remove('open');
}

// Status badge HTML
function statusBadge(status) {
  const labels = { pending: 'Pending', in_progress: 'In Progress', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled' };
  const icons = { pending: 'fa-clock', in_progress: 'fa-spinner', on_hold: 'fa-pause', completed: 'fa-check-circle', cancelled: 'fa-times-circle' };
  return `<span class="status-badge status-${status}"><i class="fas ${icons[status] || 'fa-circle'}"></i> ${labels[status] || status}</span>`;
}

function priorityBadge(p) {
  const icons = { low: 'fa-arrow-down', medium: 'fa-minus', high: 'fa-arrow-up', urgent: 'fa-exclamation' };
  return `<span class="priority-badge priority-${p}"><i class="fas ${icons[p] || 'fa-minus'}"></i> ${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(d) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Set user info
function setUserInfo() {
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('user-name-sidebar').textContent = user.name;
  document.getElementById('user-name-top').textContent = user.name;
  document.getElementById('user-avatar-sidebar').textContent = initials;
  document.getElementById('user-avatar-top').textContent = initials;
  document.getElementById('welcome-msg').textContent = `Welcome back, ${user.name.split(' ')[0]}! 👋`;
}

// LOAD OVERVIEW
async function loadOverview() {
  try {
    const res = await api('/api/services/stats');
    if (!res) return;
    const stats = await res.json();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-progress').textContent = stats.in_progress;
    document.getElementById('stat-completed').textContent = stats.completed;
    if (stats.pending > 0) document.getElementById('pending-badge').textContent = stats.pending;

    const res2 = await api('/api/services/requests');
    if (!res2) return;
    const requests = await res2.json();
    const recent = requests.slice(0, 5);
    const list = document.getElementById('recent-requests-list');

    if (recent.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No requests yet</h3><p>Submit your first service request to get started.</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="requests-table-wrap">
        <table class="requests-table">
          <thead><tr><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            ${recent.map(r => `
              <tr>
                <td><strong>${escHtml(r.title)}</strong></td>
                <td><i class="${r.category_icon}" style="color:#6366f1;margin-right:6px"></i>${escHtml(r.category_name)}</td>
                <td>${priorityBadge(r.priority)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${formatDate(r.created_at)}</td>
                <td><button class="btn-view" onclick="viewRequest(${r.id})"><i class="fas fa-eye"></i> View</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    document.getElementById('recent-requests-list').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load data.</p></div>`;
  }
}

// LOAD REQUESTS
async function loadRequests() {
  const status = document.getElementById('filter-status')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  let url = '/api/services/requests?';
  if (status) url += `status=${status}&`;
  if (priority) url += `priority=${priority}&`;

  const list = document.getElementById('requests-list');
  list.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

  try {
    const res = await api(url);
    if (!res) return;
    const requests = await res.json();

    if (requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No requests found</h3><p>Try adjusting your filters or submit a new request.</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="card">
        <div class="requests-table-wrap">
          <table class="requests-table">
            <thead><tr><th>#</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              ${requests.map(r => `
                <tr>
                  <td><small style="color:#94a3b8">#${r.id}</small></td>
                  <td><strong>${escHtml(r.title)}</strong></td>
                  <td><i class="${r.category_icon}" style="color:#6366f1;margin-right:6px"></i>${escHtml(r.category_name)}</td>
                  <td>${priorityBadge(r.priority)}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td>${formatDate(r.created_at)}</td>
                  <td><button class="btn-view" onclick="viewRequest(${r.id})"><i class="fas fa-eye"></i> View</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load requests.</p></div>`;
  }
}

function resetFilters() {
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-priority').value = '';
  loadRequests();
}

// LOAD CATEGORIES for new request form
async function loadCategories() {
  try {
    const res = await api('/api/services/categories');
    if (!res) return;
    const cats = await res.json();
    const sel = document.getElementById('req-category');
    sel.innerHTML = `<option value="">Select a service category...</option>` +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch {}
}

// SUBMIT NEW REQUEST
document.getElementById('new-request-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormErrors();

  const category_id = document.getElementById('req-category').value;
  const title = document.getElementById('req-title').value.trim();
  const description = document.getElementById('req-description').value.trim();
  const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
  let valid = true;

  if (!category_id) { document.getElementById('cat-error').textContent = 'Please select a category.'; valid = false; }
  if (!title) { document.getElementById('title-error').textContent = 'Title is required.'; valid = false; }
  if (!valid) return;

  const btn = document.getElementById('req-submit-btn');
  setBtn(btn, true);

  try {
    const res = await api('/api/services/requests', {
      method: 'POST', body: JSON.stringify({ category_id, title, description, priority })
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) { showFormAlert(data.error || 'Failed to submit.', 'error'); return; }
    showFormAlert('Request submitted successfully! Redirecting...', 'success');
    document.getElementById('new-request-form').reset();
    setTimeout(() => showPage('requests'), 1500);
  } catch {
    showFormAlert('Network error. Please try again.', 'error');
  } finally { setBtn(btn, false); }
});

// Priority selector visual
document.querySelectorAll('.priority-opt').forEach(opt => {
  opt.addEventListener('click', function() {
    document.querySelectorAll('.priority-opt').forEach(o => o.classList.remove('selected'));
    this.classList.add('selected');
  });
});

// VIEW REQUEST DETAIL MODAL
async function viewRequest(id) {
  const modal = document.getElementById('request-modal');
  const body = document.getElementById('modal-body');
  modal.classList.remove('hidden');
  body.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

  try {
    const res = await api(`/api/services/requests/${id}`);
    if (!res) return;
    const r = await res.json();
    if (!res.ok) { body.innerHTML = `<p style="color:red">${r.error}</p>`; return; }

    document.getElementById('modal-title').textContent = `Request #${r.id}`;

    body.innerHTML = `
      <div class="request-detail-header">
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:0.5rem">${escHtml(r.title)}</h3>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">${statusBadge(r.status)} ${priorityBadge(r.priority)}</div>
        </div>
      </div>
      <div class="request-meta">
        <div class="request-meta-item"><label>Category</label><span><i class="${r.category_icon}" style="color:#6366f1;margin-right:4px"></i>${escHtml(r.category_name)}</span></div>
        <div class="request-meta-item"><label>Submitted</label><span>${formatDateTime(r.created_at)}</span></div>
        <div class="request-meta-item"><label>Last Updated</label><span>${formatDateTime(r.updated_at)}</span></div>
        <div class="request-meta-item"><label>Status</label><span>${statusBadge(r.status)}</span></div>
      </div>
      ${r.description ? `<div class="request-desc"><strong>Description:</strong><br>${escHtml(r.description)}</div>` : ''}
      ${r.notes ? `<div class="request-desc" style="border-left:3px solid #6366f1;padding-left:1rem"><strong>Admin Notes:</strong><br>${escHtml(r.notes)}</div>` : ''}
      <div class="updates-timeline">
        <div class="updates-title"><i class="fas fa-history" style="color:#6366f1;margin-right:6px"></i>Activity Timeline</div>
        ${r.updates.map(u => `
          <div class="update-item">
            <div class="update-dot"></div>
            <div class="update-content">
              <div class="update-msg">${escHtml(u.message)}</div>
              <div class="update-by">By ${escHtml(u.updated_by_name)} (${u.updated_by_role}) · ${formatDateTime(u.created_at)}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load request details.</p></div>`;
  }
}

function closeModal() {
  document.getElementById('request-modal').classList.add('hidden');
}
document.getElementById('request-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// LOAD PROFILE
async function loadProfile() {
  try {
    const res = await api('/api/auth/me');
    if (!res) return;
    const u = await res.json();
    const initials = u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = u.name;
    document.getElementById('profile-email').innerHTML = `<i class="fas fa-envelope"></i> ${escHtml(u.email)}`;
    document.getElementById('profile-company').innerHTML = `<i class="fas fa-building"></i> ${u.company || 'Not specified'}`;
    document.getElementById('profile-phone').innerHTML = `<i class="fas fa-phone"></i> ${u.phone || 'Not specified'}`;
    document.getElementById('profile-joined').innerHTML = `<i class="fas fa-calendar"></i> Joined ${formatDate(u.created_at)}`;

    const sRes = await api('/api/services/stats');
    if (!sRes) return;
    const stats = await sRes.json();
    document.getElementById('ps-total').textContent = stats.total;
    document.getElementById('ps-pending').textContent = stats.pending;
    document.getElementById('ps-progress').textContent = stats.in_progress;
    document.getElementById('ps-completed').textContent = stats.completed;
  } catch {}
}

// Helpers
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  const a = document.getElementById('form-alert');
  if (a) a.classList.add('hidden');
}
function showFormAlert(msg, type) {
  const a = document.getElementById('form-alert');
  if (!a) return;
  a.className = `alert ${type}`;
  a.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-circle'}"></i> ${msg}`;
  a.classList.remove('hidden');
}
function setBtn(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
}

// Init
setUserInfo();
loadOverview();
