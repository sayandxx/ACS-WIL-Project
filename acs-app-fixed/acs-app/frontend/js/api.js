// Shared helpers used across the app: talking to the backend, remembering who is logged in,
// and small display utilities. Other files import what they need from here.

export const TOKEN_KEY = 'acs_app_token';
export const USER_KEY = 'acs_app_user';

export const Session = {
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() {
    return Boolean(this.token() && this.user());
  },
};

// Calls the backend and returns { ok, status, data }. Adds the login token automatically.
// The backend serves this app, so API addresses are relative to the same site.
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = Session.token();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: { message: 'Failed to connect to the server. Is the backend running?' } };
  }

  const data = await response.json().catch(() => ({}));

  // Token expired or invalid: forget it so the user can sign in again
  if (response.status === 401 && token) {
    Session.clear();
  }
  return { ok: response.ok, status: response.status, data };
}

// Where each account type goes after logging in
export function homeFor(user) {
  return user && user.account_type === 'Administrator' ? '/admin' : '/dashboard';
}

// Makes text safe to put inside HTML, so user content can never inject code
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A fallback picture for campaigns without their own image
const CATEGORY_IMAGES = {
  Environment: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900',
  Education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900',
  Community: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=900',
  Health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900',
  'Animal Welfare': 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=900',
};
export const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=900';

export function campaignImage(campaign) {
  return campaign.image_url || CATEGORY_IMAGES[campaign.category] || DEFAULT_IMAGE;
}

// An <img> that swaps to the default picture once if its own fails to load
export function imageTag(src, className = '', extra = '') {
  return `<img${className ? ` class="${className}"` : ''} src="${escapeHtml(src)}" alt="" ${extra}
    onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}'">`;
}

// Same password rules as the server (routes/validate.js), so people see the problem straight away.
// The server still checks again, because anyone can skip the browser.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'qwerty12', 'qwerty123', 'qwertyuiop', '1q2w3e4r', 'abc12345', 'abcd1234',
  'iloveyou', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'sunshine1',
  'football1', 'baseball1', 'admin123', 'administrator', 'changeme', 'trustno1',
]);

export function passwordProblem(password) {
  if (password.length < 8) return 'Password must contain at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password) || !/[^A-Za-z]/.test(password)) {
    return 'Password must include at least one letter and at least one number or symbol.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That password is too common. Please choose a different one.';
  return null;
}

export const CAMPAIGN_CATEGORIES = ['Environment', 'Education', 'Community', 'Health', 'Animal Welfare', 'Other'];
export const BUSINESS_CATEGORIES = ['Food and drink', 'Retail', 'Services', 'Health and wellbeing', 'Arts and crafts', 'Other'];

// Shows a message in an element using the existing .form-message styles
export function showMessage(el, text, type = 'error') {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
}

export function statusBadge(status) {
  return `<span class="badge badge-${escapeHtml(status).toLowerCase()}">${escapeHtml(status)}</span>`;
}

// A small pop-up message at the bottom of the screen
let toastTimer;
export function showToast(text, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
