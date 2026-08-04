const loginView = document.getElementById('loginView');
const galleryView = document.getElementById('galleryView');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const adminGrid = document.getElementById('adminGrid');
const countBadge = document.getElementById('countBadge');
const refreshBtn = document.getElementById('refreshBtn');

let adminPassword = sessionStorage.getItem('smriti_admin_pw') || '';

if (adminPassword) tryLoadGallery();

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
refreshBtn.addEventListener('click', loadFiles);

async function login() {
  const pw = passwordInput.value;
  if (!pw) return;
  loginError.textContent = '';

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });

  if (res.ok) {
    adminPassword = pw;
    sessionStorage.setItem('smriti_admin_pw', pw);
    showGallery();
    loadFiles();
  } else {
    loginError.textContent = 'Wrong password — try again.';
  }
}

function tryLoadGallery() {
  showGallery();
  loadFiles();
}

function showGallery() {
  loginView.hidden = true;
  galleryView.hidden = false;
}

async function loadFiles() {
  adminGrid.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  const res = await fetch('/api/admin/files', {
    headers: { 'x-admin-password': adminPassword },
  });

  if (res.status === 401) {
    sessionStorage.removeItem('smriti_admin_pw');
    loginView.hidden = false;
    galleryView.hidden = true;
    loginError.textContent = 'Session expired — log in again.';
    return;
  }

  const data = await res.json();
  if (!data.ok) {
    adminGrid.innerHTML = `<p style="color:var(--coral)">${data.message}</p>`;
    return;
  }

  countBadge.textContent = `${data.files.length} file${data.files.length === 1 ? '' : 's'}`;
  renderFiles(data.files);
}

function renderFiles(files) {
  if (files.length === 0) {
    adminGrid.innerHTML = '<p style="color:var(--muted)">Nothing uploaded yet.</p>';
    return;
  }

  adminGrid.innerHTML = files.map(f => {
    const isImage = f.mimeType?.startsWith('image/');
    const thumb = f.thumbnailLink || '';
    const uploader = (f.description || '').replace('Uploaded by: ', '');
    return `
      <div class="admin-card">
        ${thumb
          ? `<img class="admin-thumb" src="${thumb}" alt="${escapeHtml(f.name)}" loading="lazy" />`
          : `<div class="admin-thumb" style="display:flex;align-items:center;justify-content:center;font-size:28px;">${isImage ? '🖼️' : '🎞️'}</div>`}
        <div class="admin-meta">
          <div class="admin-name">${escapeHtml(f.name)}</div>
          <div class="admin-sub">${escapeHtml(uploader || 'Unknown uploader')}</div>
          <a class="admin-link" href="${f.webViewLink}" target="_blank" rel="noopener">Open in Drive →</a>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
