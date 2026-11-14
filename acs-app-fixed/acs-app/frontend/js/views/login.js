// Login view: /login (optionally /login?next=/dashboard)

import { api, Session, homeFor, showMessage } from '../api.js';
import { isSafeInternalPath } from '../router.js';

export default async function loginView(el, { query, navigate }) {
  const next = isSafeInternalPath(query.get('next')) ? query.get('next') : null;

  el.innerHTML = `
    <div class="register-layout">
      <section class="register-image login-image">
        <div class="register-image-content">
          <span class="tag">WELCOME BACK</span>
          <p class="auth-hero-title">Pick Up Where<br>You Left Off.</p>
          <p>Check on your campaigns, share your business, and keep making a difference in your community.</p>
        </div>
      </section>

      <section class="register-panel">
        <div class="register-box">
          <span class="eyebrow">GOOD TO SEE YOU</span>
          <h1 class="auth-title">Log in to ACS</h1>
          <p class="form-intro">Enter your details to access your dashboard.</p>

          <form id="loginForm" class="auth-form" novalidate>
            <label for="email">Email Address</label>
            <input type="email" id="email" placeholder="Enter your email address" autocomplete="email" required>

            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password" autocomplete="current-password" required>

            <p id="message" class="form-message" role="status" aria-live="polite" style="margin-top:16px;"></p>
            <button type="submit" class="btn btn-green submit-btn">Log in ↗</button>
          </form>

          <p class="auth-switch">Don't have an account? <a href="/register">Create one</a></p>

          <div class="demo-accounts">
            <strong>Testing?</strong> The sample accounts from <code>schema.sql</code> all use the password
            <strong>Password123!</strong> — for example <strong>admin.test@example.com</strong> (Administrator),
            <strong>greenteam@example.org</strong> (Organisation) or <strong>cafe.owner@example.com</strong> (Business).
          </div>
        </div>
      </section>
    </div>
  `;

  const form = el.querySelector('#loginForm');
  const message = el.querySelector('#message');
  if (next) showMessage(message, 'Please log in to continue.');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;

    if (!email || !password) {
      showMessage(message, 'Please fill in all fields.');
      return;
    }

    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    button.textContent = 'Logging in…';

    const { ok, data } = await api('/api/auth/login', { method: 'POST', body: { email, password } });

    if (ok) {
      Session.save(data.token, data.user);
      navigate(next || homeFor(data.user), { replace: true });
    } else {
      showMessage(message, data.message || 'Invalid email or password.');
      button.disabled = false;
      button.textContent = 'Log in ↗';
    }
  });
}
