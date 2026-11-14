// Register view: /register

import { api, Session, homeFor, showMessage, passwordProblem } from '../api.js';

export default async function registerView(el, { navigate }) {
  el.innerHTML = `
    <div class="register-layout">
      <section class="register-image">
        <div class="register-image-content">
          <span class="tag">A COMMUNITY FOR CHANGE</span>
          <p class="auth-hero-title">Good People.<br>Brighter Tomorrows.</p>
          <p>Join a community that supports meaningful causes, empowers local businesses, and creates positive change.</p>
        </div>
      </section>

      <section class="register-panel">
        <div class="register-box">
          <span class="eyebrow">JOIN THE MOVEMENT</span>
          <h1 class="auth-title">Create Your Account</h1>
          <p class="form-intro">Be part of a community making a difference.</p>

          <form id="registerForm" novalidate>
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" placeholder="Enter your full name" autocomplete="name" required>

            <label for="email">Email Address</label>
            <input type="email" id="email" placeholder="Enter your email address" autocomplete="email" required>

            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Create a password" autocomplete="new-password" aria-describedby="passwordHint" required>
            <small id="passwordHint" class="field-hint">At least 8 characters, with a letter and a number or symbol.</small>

            <label for="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" placeholder="Confirm your password" autocomplete="new-password" required>

            <label>Choose Account Type</label>
            <div class="account-options">
              <label class="account-option">
                <input type="radio" name="accountType" value="Individual" checked>
                <span>👤<strong>Individual</strong><small>Support causes</small></span>
              </label>
              <label class="account-option">
                <input type="radio" name="accountType" value="Business">
                <span>🏪<strong>Business</strong><small>Promote business</small></span>
              </label>
              <label class="account-option">
                <input type="radio" name="accountType" value="Organisation">
                <span>🤝<strong>Organisation</strong><small>Create campaigns</small></span>
              </label>
            </div>

            <label class="terms">
              <input type="checkbox" id="terms" required>
              <span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>
                and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></span>
            </label>

            <p id="formMessage" class="form-message" role="status" aria-live="polite"></p>
            <button type="submit" class="btn btn-green submit-btn">Create Account ↗</button>
          </form>

          <p class="auth-switch">Already have an account? <a href="/login">Log in</a></p>
        </div>
      </section>
    </div>
  `;

  const form = el.querySelector('#registerForm');
  const message = el.querySelector('#formMessage');
  const value = (id) => form.querySelector(`#${id}`).value;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = value('fullName').trim();
    const email = value('email').trim();
    const password = value('password');
    const confirmPassword = value('confirmPassword');
    const accountType = form.querySelector('input[name="accountType"]:checked').value;
    const terms = form.querySelector('#terms').checked;

    if (!name || !email || !password || !confirmPassword) return showMessage(message, 'Please complete all required fields.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(message, 'Please enter a valid email address.');
    const problem = passwordProblem(password);
    if (problem) return showMessage(message, problem);
    if (password !== confirmPassword) return showMessage(message, 'Passwords do not match.');
    if (!terms) return showMessage(message, 'Please accept the terms to continue.');

    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    button.textContent = 'Creating account…';

    const register = await api('/api/auth/register', {
      method: 'POST',
      body: { full_name: name, email, password, account_type: accountType },
    });

    if (!register.ok) {
      showMessage(message, register.data.message || 'Registration failed.');
      button.disabled = false;
      button.textContent = 'Create Account ↗';
      return;
    }

    showMessage(message, 'Account created! Signing you in…', 'success');

    // Log the new user straight in, so they don't type their details twice
    const login = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (login.ok) {
      Session.save(login.data.token, login.data.user);
      navigate(homeFor(login.data.user), { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  });
}
