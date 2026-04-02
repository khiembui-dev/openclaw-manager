/**
 * OpenClaw Manager - Global Frontend JavaScript
 * API helper, toast notifications, modal management, job polling
 */

// CSRF token
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

/**
 * API helper - sends JSON requests with CSRF token.
 */
async function api(url, options = {}) {
  const { method = 'GET', body } = options;

  const fetchOpts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'same-origin',
  };

  if (body && method !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

/**
 * Show a toast notification.
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Open a modal by ID.
 */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

/**
 * Close a modal by ID.
 */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

/**
 * Poll a job's status and update UI elements.
 */
function pollJobStatus(jobId, barId, statusId, logId, onSuccess, onError) {
  const interval = setInterval(async () => {
    try {
      const job = await api(`/api/jobs/${jobId}`);

      if (barId) {
        const bar = document.getElementById(barId);
        if (bar) bar.style.width = (job.progress || 0) + '%';
      }

      if (statusId) {
        const status = document.getElementById(statusId);
        if (status) status.textContent = job.message || 'Đang xử lý...';
      }

      if (logId && job.log) {
        const log = document.getElementById(logId);
        if (log) {
          log.textContent = job.log;
          log.scrollTop = log.scrollHeight;
        }
      }

      if (job.status === 'success') {
        clearInterval(interval);
        if (onSuccess) onSuccess(job);
      } else if (job.status === 'failed') {
        clearInterval(interval);
        if (onError) onError(job.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, 2000);

  return interval;
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format bytes.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Mobile sidebar toggle.
 */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}
