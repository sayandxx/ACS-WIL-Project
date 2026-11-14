// Draws the right side of the navbar for the current login state,
// and highlights the link for the page you're on.

import { Session, homeFor, escapeHtml, api } from './api.js';
import { navigate } from './router.js';

export function renderNav({ pathname }) {
  const slot = document.getElementById('navActions');
  const user = Session.user();

  if (Session.isLoggedIn()) {
    const firstName = user.full_name.split(' ')[0];
    const isAdmin = user.account_type === 'Administrator';
    slot.innerHTML = `
      <a href="${homeFor(user)}" class="nav-link-strong">${isAdmin ? 'Admin Panel' : 'My Dashboard'}</a>
      <span class="user-chip" title="${escapeHtml(user.email || '')}">
        <span class="user-avatar">${escapeHtml(firstName.charAt(0).toUpperCase())}</span>
        ${escapeHtml(firstName)}
      </span>
      <button type="button" class="btn btn-outline-green" id="logoutBtn">Log out</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      // Tell the server first so the token stops working there too (FB-01).
      // Even if the server can't be reached, still forget the login in this browser.
      await api('/api/auth/logout', { method: 'POST' });
      Session.clear();
      navigate('/');
    });
  } else {
    slot.innerHTML = `
      <a href="/login" class="nav-link-strong">Log in</a>
      <a href="/register" class="btn btn-green">Join ACS ↗</a>
    `;
  }

  // Mark the current page for screen readers (and styling)
  document.querySelectorAll('#mainNav a, #navActions a').forEach((a) => {
    const linkPath = new URL(a.href).pathname;
    const isHere = linkPath === pathname && !new URL(a.href).hash;
    if (isHere) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
