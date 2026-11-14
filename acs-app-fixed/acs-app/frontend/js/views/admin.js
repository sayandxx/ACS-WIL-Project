// Admin view: /admin (Administrator only)
// Stats, review queue (approve/reject) and recent decisions.

import {
  api, Session, escapeHtml, formatDate, campaignImage, imageTag, statusBadge, showToast,
} from '../api.js';

export default async function adminView(el, { navigate, isActive }) {
  el.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <span class="eyebrow">ADMINISTRATOR</span>
          <h1>Admin Panel</h1>
          <p>Review new submissions before they go public.</p>
        </div>
      </div>

      <div class="stat-cards" id="stats">
        <div class="stat-card highlight"><strong>–</strong><span>Waiting for review</span></div>
        <div class="stat-card"><strong>–</strong><span>Live campaigns</span></div>
        <div class="stat-card"><strong>–</strong><span>Live businesses</span></div>
        <div class="stat-card"><strong>–</strong><span>Registered users</span></div>
      </div>

      <div class="dash-grid admin-grid">
        <section class="panel">
          <h2>Review queue</h2>
          <p>Approved items appear on the home page straight away.</p>
          <div class="tabs" role="tablist" id="queueTabs"></div>
          <ul class="item-list" id="queue" aria-live="polite"><li class="empty-state">Loading…</li></ul>
        </section>

        <section class="panel">
          <h2>Recent decisions</h2>
          <p>Every approval and rejection is recorded.</p>
          <ul class="item-list" id="logs"><li class="empty-state">Loading…</li></ul>
        </section>
      </div>
    </div>
  `;

  const queue = el.querySelector('#queue');
  const tabs = el.querySelector('#queueTabs');
  const logs = el.querySelector('#logs');
  let pending = { campaigns: [], promotions: [] };
  let activeTab = 'campaigns';

  // Session expired or no longer an admin: back to login
  function authFailed(status) {
    if (status !== 401 && status !== 403) return false;
    Session.clear();
    navigate('/login?next=/admin', { replace: true });
    return true;
  }

  async function loadStats() {
    const { ok, status, data } = await api('/api/admin/stats');
    if (!isActive() || authFailed(status) || !ok) return;
    const values = [data.campaigns.Pending + data.promotions.Pending, data.campaigns.Approved, data.promotions.Approved, data.users];
    el.querySelectorAll('#stats .stat-card strong').forEach((s, i) => { s.textContent = values[i]; });
  }

  function renderTabs() {
    const labels = { campaigns: 'Campaigns', promotions: 'Businesses' };
    tabs.innerHTML = Object.keys(labels).map((key) => `
      <button type="button" class="tab" role="tab" data-tab="${key}" aria-selected="${key === activeTab}">
        ${labels[key]}<span class="count">${pending[key].length}</span>
      </button>`).join('');
  }

  function renderQueue() {
    const items = pending[activeTab];
    const isCampaign = activeTab === 'campaigns';
    if (items.length === 0) {
      queue.innerHTML = '<li class="empty-state"><strong>All caught up</strong>Nothing is waiting for review.</li>';
      return;
    }
    queue.innerHTML = items.map((item) => `
      <li class="item">
        ${isCampaign ? imageTag(campaignImage(item), 'item-thumb') : ''}
        <div class="item-body">
          <div class="item-meta">
            <span class="category">${escapeHtml(item.category.toUpperCase())}</span>
            <span>· by ${escapeHtml(isCampaign ? item.creator_name : item.owner_name)}</span>
            <span>· ${formatDate(item.created_at)}</span>
          </div>
          <h3>${escapeHtml(isCampaign ? item.title : item.business_name)}</h3>
          ${isCampaign ? `<p>${escapeHtml(item.short_description)}</p>` : ''}
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-green btn-sm" data-id="${item.id}" data-decision="Approved">Approve</button>
          <button type="button" class="btn btn-danger btn-sm" data-id="${item.id}" data-decision="Rejected">Reject</button>
        </div>
      </li>`).join('');
  }

  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    renderTabs();
    renderQueue();
  });

  queue.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-decision]');
    if (!button) return;
    button.closest('.item').querySelectorAll('button').forEach((b) => { b.disabled = true; });

    const { ok, status, data } = await api(`/api/admin/${activeTab}/${button.dataset.id}`, {
      method: 'PATCH',
      body: { decision: button.dataset.decision },
    });
    if (authFailed(status)) return;

    showToast(ok
      ? (button.dataset.decision === 'Approved' ? 'Approved — now live on the home page.' : 'Rejected.')
      : (data.message || 'Something went wrong.'), ok ? 'success' : 'error');
    refresh();
  });

  async function loadQueue() {
    const { ok, status, data } = await api('/api/admin/pending');
    if (!isActive() || authFailed(status)) return;
    if (!ok) {
      queue.innerHTML = `<li class="empty-state"><strong>Couldn't load the queue</strong>${escapeHtml(data.message)}</li>`;
      return;
    }
    pending = data;
    renderTabs();
    renderQueue();
  }

  async function loadLogs() {
    const { ok, status, data } = await api('/api/admin/logs');
    if (!isActive() || authFailed(status) || !ok) return;
    logs.innerHTML = data.logs.length === 0
      ? '<li class="empty-state">No decisions yet.</li>'
      : data.logs.map((log) => `
          <li class="item">
            <div class="item-body">
              <div class="item-meta">${statusBadge(log.decision)} <span>${log.target_type === 'Campaign' ? 'Campaign' : 'Business'}</span></div>
              <h3>${escapeHtml(log.target_name || '(deleted item)')}</h3>
              <p>${escapeHtml(log.admin_name)} · ${formatDate(log.created_at)}</p>
            </div>
          </li>`).join('');
  }

  function refresh() {
    loadStats();
    loadQueue();
    loadLogs();
  }

  refresh();
}
