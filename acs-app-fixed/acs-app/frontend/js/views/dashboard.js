// Dashboard view: /dashboard (Individual, Organisation, Business)
// Create campaigns or promotions and see everything you've submitted with its status.

import {
  api, Session, escapeHtml, formatDate, campaignImage, imageTag, statusBadge,
  showMessage, showToast, CAMPAIGN_CATEGORIES, BUSINESS_CATEGORIES,
} from '../api.js';

export default async function dashboardView(el, { navigate, isActive }) {
  const user = Session.user();
  const isBusiness = user.account_type === 'Business';
  const endpoint = isBusiness ? '/api/promotions' : '/api/campaigns';
  const noun = isBusiness ? 'promotion' : 'campaign';
  const options = (list) => list.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  el.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <span class="eyebrow">${escapeHtml(user.account_type.toUpperCase())} ACCOUNT</span>
          <h1>Welcome back, ${escapeHtml(user.full_name.split(' ')[0])}</h1>
          <p>${isBusiness
            ? 'Share your business with a community that supports local.'
            : 'Start a cause and bring people together around it.'}</p>
        </div>
      </div>

      <div class="dash-grid">
        <section class="panel">
          <h2>${isBusiness ? 'Promote your business' : 'Start a campaign'}</h2>
          <p>${isBusiness
            ? 'Once approved, your business appears on the ACS home page.'
            : 'Once approved, your campaign appears in Social Causes.'}</p>

          <form id="createForm" class="panel-form" novalidate>
            ${isBusiness ? `
              <div class="form-field">
                <label for="business_name">Business name</label>
                <input id="business_name" maxlength="255" required placeholder="e.g. Corner Café">
              </div>
              <div class="form-field">
                <label for="category">Category</label>
                <select id="category" required><option value="">Choose a category</option>${options(BUSINESS_CATEGORIES)}</select>
              </div>` : `
              <div class="form-field">
                <label for="title">Campaign title</label>
                <input id="title" maxlength="255" required placeholder="e.g. Beach Clean-up Day">
              </div>
              <div class="form-field">
                <label for="category">Category</label>
                <select id="category" required><option value="">Choose a category</option>${options(CAMPAIGN_CATEGORIES)}</select>
              </div>
              <div class="form-field">
                <label for="short_description">Description</label>
                <textarea id="short_description" maxlength="2000" required placeholder="What is the cause, and how can people help?"></textarea>
              </div>
              <div class="form-field">
                <label for="image_url">Image link <span style="font-weight:500; color:var(--muted);">(optional)</span></label>
                <input id="image_url" type="url" maxlength="255" placeholder="https://…">
                <p class="form-hint">Leave blank to use a picture that matches the category.</p>
              </div>`}
            <p class="form-message" id="formMessage" role="status" aria-live="polite" style="margin-top:16px;"></p>
            <button type="submit" class="btn btn-green">Submit for approval ↗</button>
          </form>
        </section>

        <section class="panel">
          <h2>${isBusiness ? 'My promotions' : 'My campaigns'}</h2>
          <p>New submissions are reviewed by an administrator before they go public.</p>
          <div class="tabs" role="tablist" id="statusTabs"></div>
          <ul class="item-list" id="myItems" aria-live="polite"><li class="empty-state">Loading…</li></ul>
        </section>
      </div>
    </div>
  `;

  const form = el.querySelector('#createForm');
  const list = el.querySelector('#myItems');
  const tabs = el.querySelector('#statusTabs');
  const message = el.querySelector('#formMessage');
  let items = [];
  let activeStatus = 'All';

  const sessionExpired = () => navigate('/login?next=/dashboard', { replace: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (id) => form.querySelector(`#${id}`).value.trim();
    const body = isBusiness
      ? { business_name: value('business_name'), category: value('category') }
      : { title: value('title'), category: value('category'), short_description: value('short_description'), image_url: value('image_url') };

    if (Object.entries(body).some(([key, v]) => key !== 'image_url' && !v)) {
      showMessage(message, 'Please complete all required fields.');
      return;
    }

    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const { ok, status, data } = await api(endpoint, { method: 'POST', body });
    button.disabled = false;

    if (status === 401) return sessionExpired();
    if (!ok) return showMessage(message, data.message || 'Something went wrong, please try again');

    form.reset();
    message.textContent = '';
    message.className = 'form-message';
    showToast('Submitted! An administrator will review it soon.');
    loadItems();
  });

  function renderTabs() {
    const counts = { All: items.length, Pending: 0, Approved: 0, Rejected: 0 };
    items.forEach((i) => { counts[i.status] += 1; });
    tabs.innerHTML = Object.keys(counts).map((s) => `
      <button type="button" class="tab" role="tab" data-status="${s}" aria-selected="${s === activeStatus}">
        ${s}<span class="count">${counts[s]}</span>
      </button>`).join('');
  }

  function renderItems() {
    const shown = activeStatus === 'All' ? items : items.filter((i) => i.status === activeStatus);
    if (shown.length === 0) {
      list.innerHTML = items.length === 0
        ? `<li class="empty-state"><strong>Nothing here yet</strong>Use the form to submit your first ${noun}.</li>`
        : `<li class="empty-state">No ${activeStatus.toLowerCase()} items.</li>`;
      return;
    }
    list.innerHTML = shown.map((item) => `
      <li class="item">
        ${isBusiness ? '' : imageTag(campaignImage(item), 'item-thumb')}
        <div class="item-body">
          <div class="item-meta">${statusBadge(item.status)} <span>${escapeHtml(item.category)}</span> <span>· ${formatDate(item.created_at)}</span></div>
          <h3>${escapeHtml(isBusiness ? item.business_name : item.title)}</h3>
          ${isBusiness ? '' : `<p>${escapeHtml(item.short_description)}</p>`}
        </div>
        <div class="item-actions">
          ${isBusiness ? '' : `<a class="btn btn-outline-green btn-sm" href="/causes/${item.id}">View</a>`}
          <button type="button" class="btn btn-danger btn-sm" data-delete="${item.id}">Delete</button>
        </div>
      </li>`).join('');
  }

  // One listener for all tabs and delete buttons (they're redrawn often)
  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    activeStatus = tab.dataset.status;
    renderTabs();
    renderItems();
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete]');
    if (!button || !confirm('Delete this permanently? This cannot be undone.')) return;
    const { ok, status, data } = await api(`${endpoint}/${button.dataset.delete}`, { method: 'DELETE' });
    if (status === 401) return sessionExpired();
    if (ok) {
      showToast('Deleted.');
      loadItems();
    } else {
      showToast(data.message || 'Could not delete.', 'error');
    }
  });

  async function loadItems() {
    const { ok, status, data } = await api(`${endpoint}/mine`);
    if (!isActive()) return;
    if (status === 401) return sessionExpired();
    if (!ok) {
      list.innerHTML = `<li class="empty-state"><strong>Couldn't load your submissions</strong>${escapeHtml(data.message)}</li>`;
      return;
    }
    items = isBusiness ? data.promotions : data.campaigns;
    renderTabs();
    renderItems();
  }

  loadItems();
}
