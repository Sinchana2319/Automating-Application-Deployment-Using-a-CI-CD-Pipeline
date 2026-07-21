// Shared auth utilities used across login/register pages

function showAlert(msg, type = 'error') {
  const box = document.getElementById('alert-box');
  if (!box) return;
  box.className = `alert ${type}`;
  box.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  const box = document.getElementById('alert-box');
  if (box) box.classList.add('hidden');
}

function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (loading) { text.classList.add('hidden'); loader.classList.remove('hidden'); }
  else { text.classList.remove('hidden'); loader.classList.add('hidden'); }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function getToken() { return localStorage.getItem('token'); }
function getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }

async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  return res;
}
