// Smriti — by Dwani Academy
// Handles: file selection / drag-drop, per-file "developing photo" progress,
// cancel (single + all), a few uploads in parallel for speed, and a warning
// if someone tries to close the tab mid-upload.

const API_UPLOAD_URL = '/api/upload';
const MAX_CONCURRENT_UPLOADS = 3;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseBtn = document.getElementById('chooseBtn');
const fileGrid = document.getElementById('fileGrid');
const studentNameInput = document.getElementById('studentName');

const summaryBar = document.getElementById('summaryBar');
const summaryFill = document.getElementById('summaryFill');
const summaryText = document.getElementById('summaryText');
const uploadAllBtn = document.getElementById('uploadAllBtn');
const cancelAllBtn = document.getElementById('cancelAllBtn');
const leaveToast = document.getElementById('leaveToast');

// queue item shape: { id, file, status: 'pending'|'uploading'|'done'|'error'|'cancelled', progress, xhr, cardEl, washEl, statusEl }
let queue = [];
let activeUploads = 0;

// ---------- File selection ----------
chooseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (e.target === chooseBtn) return;
  fileInput.click();
});

fileInput.addEventListener('change', (e) => addFiles(e.target.files));

['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); })
);
dropZone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
  files.forEach(file => {
    const item = {
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      progress: 0,
      xhr: null,
    };
    queue.push(item);
    renderCard(item);
  });
  fileInput.value = ''; // allow re-selecting the same file if needed
  updateSummary();
}

// ---------- Card rendering ----------
function renderCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = item.id;

  const isVideo = item.file.type.startsWith('video/');
  const url = URL.createObjectURL(item.file);

  card.innerHTML = `
    <div class="card-photo">
      ${isVideo
        ? `<video src="${url}" muted playsinline></video>`
        : `<img src="${url}" alt="${escapeHtml(item.file.name)}" />`}
      <div class="develop-wash"></div>
    </div>
    <div class="card-caption">${escapeHtml(item.file.name)}</div>
    <button class="card-cancel" title="Remove">✕</button>
  `;

  fileGrid.appendChild(card);

  item.cardEl = card;
  item.washEl = card.querySelector('.develop-wash');
  card.querySelector('.card-cancel').addEventListener('click', () => cancelItem(item.id));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Summary bar ----------
function updateSummary() {
  if (queue.length === 0) {
    summaryBar.hidden = true;
    return;
  }
  summaryBar.hidden = false;

  const done = queue.filter(i => i.status === 'done').length;
  const total = queue.filter(i => i.status !== 'cancelled').length;
  const overallProgress = total === 0 ? 0 :
    queue.reduce((sum, i) => sum + (i.status === 'cancelled' ? 0 : i.progress), 0) / total;

  summaryFill.style.width = `${overallProgress}%`;
  summaryText.textContent = `${done} of ${total} uploaded`;

  const anyUploading = queue.some(i => i.status === 'uploading');
  const anyPending = queue.some(i => i.status === 'pending');
  uploadAllBtn.disabled = anyUploading || !anyPending;
  uploadAllBtn.textContent = anyUploading ? 'Sending…' : 'Send to the vault';

  toggleLeaveGuard(anyUploading);
}

// ---------- Upload orchestration ----------
uploadAllBtn.addEventListener('click', () => {
  queue.filter(i => i.status === 'pending').forEach(startUploadWhenFree);
});

cancelAllBtn.addEventListener('click', () => {
  queue.forEach(i => {
    if (i.status === 'pending' || i.status === 'uploading') cancelItem(i.id);
  });
});

function startUploadWhenFree(item) {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    // try again shortly
    setTimeout(() => {
      if (item.status === 'pending') startUploadWhenFree(item);
    }, 300);
    return;
  }
  uploadItem(item);
}

function uploadItem(item) {
  item.status = 'uploading';
  activeUploads++;
  updateSummary();

  const xhr = new XMLHttpRequest();
  item.xhr = xhr;

  const form = new FormData();
  form.append('file', item.file);
  form.append('studentName', studentNameInput.value.trim() || 'Unknown');

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    item.progress = Math.round((e.loaded / e.total) * 100);
    // "develop" the photo — wash recedes upward as progress increases
    item.washEl.style.transform = `scaleY(${1 - item.progress / 100})`;
    updateSummary();
  });

  xhr.addEventListener('load', () => {
    activeUploads--;
    if (xhr.status >= 200 && xhr.status < 300) {
      item.status = 'done';
      item.progress = 100;
      item.washEl.style.transform = 'scaleY(0)';
      item.cardEl.classList.add('done');
      markStatus(item, 'ok', '✓ Saved');
    } else {
      item.status = 'error';
      markStatus(item, 'error', 'Failed — tap to retry');
      item.cardEl.querySelector('.card-photo').addEventListener('click', () => retryItem(item), { once: true });
    }
    updateSummary();
  });

  xhr.addEventListener('error', () => {
    activeUploads--;
    item.status = 'error';
    markStatus(item, 'error', 'Failed — tap to retry');
    item.cardEl.querySelector('.card-photo').addEventListener('click', () => retryItem(item), { once: true });
    updateSummary();
  });

  xhr.addEventListener('abort', () => {
    activeUploads--;
    updateSummary();
  });

  xhr.open('POST', API_UPLOAD_URL);
  xhr.send(form);
}

function retryItem(item) {
  item.status = 'pending';
  item.progress = 0;
  item.washEl.style.transform = 'scaleY(1)';
  const badge = item.cardEl.querySelector('.card-status');
  if (badge) badge.remove();
  startUploadWhenFree(item);
}

function markStatus(item, kind, label) {
  let badge = item.cardEl.querySelector('.card-status');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'card-status';
    item.cardEl.appendChild(badge);
  }
  badge.className = `card-status ${kind}`;
  badge.textContent = label;
}

function cancelItem(id) {
  const item = queue.find(i => i.id === id);
  if (!item) return;

  if (item.status === 'uploading' && item.xhr) {
    item.xhr.abort();
  }
  item.status = 'cancelled';
  item.cardEl?.remove();
  queue = queue.filter(i => i.id !== id);
  updateSummary();
}

// ---------- Leave-page guard ----------
function toggleLeaveGuard(active) {
  window.__smritiUploadInProgress = active;
}

window.addEventListener('beforeunload', (e) => {
  if (window.__smritiUploadInProgress) {
    e.preventDefault();
    e.returnValue = ''; // required for the native browser confirmation dialog
  }
});

// Small in-page toast as a friendlier nudge alongside the native dialog
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.__smritiUploadInProgress) {
    leaveToast.classList.add('show');
  } else {
    leaveToast.classList.remove('show');
  }
});
