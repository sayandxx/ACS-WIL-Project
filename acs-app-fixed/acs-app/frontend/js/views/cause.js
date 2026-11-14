// Cause detail view: /causes/:id

import {
  api, Session, homeFor, escapeHtml, formatDate, campaignImage, imageTag, statusBadge,
} from '../api.js';

export default async function causeView(el, { params, isActive }) {
  el.innerHTML = '<div class="page"><article class="detail"><div class="skeleton" style="min-height:420px;"></div></article></div>';

  const { ok, data } = await api(`/api/campaigns/${encodeURIComponent(params.id)}`);
  if (!isActive()) return;
  const box = el.querySelector('.detail');

  if (!ok) {
    document.title = 'Cause not found | ACS';
    box.innerHTML = `
      <div class="empty-state">
        <h1 style="font-size:24px; margin-bottom:6px;">Cause not found</h1>
        It may have been removed or is still waiting for approval.
        <p style="margin-top:20px;"><a class="btn btn-green" href="/#causes">Browse causes</a></p>
      </div>`;
    return;
  }

  const c = data.campaign;
  document.title = `${c.title} | ACS`;
  const notPublic = c.status !== 'Approved';

  box.innerHTML = `
    <a href="/#causes" class="back-link">← All causes</a>
    ${imageTag(campaignImage(c), 'detail-hero')}
    <span class="category">${escapeHtml(c.category.toUpperCase())}</span>
    <h1>${escapeHtml(c.title)}</h1>
    <div class="item-meta">
      <span>By <strong>${escapeHtml(c.creator_name)}</strong></span>
      <span>· ${formatDate(c.created_at)}</span>
      ${notPublic ? statusBadge(c.status) : ''}
    </div>
    ${notPublic ? `<p class="form-message error" style="margin-top:14px;">Only you can see this — it is ${escapeHtml(c.status.toLowerCase())}.</p>` : ''}
    <p class="detail-body">${escapeHtml(c.short_description)}</p>
    ${Session.isLoggedIn()
      ? `<a class="btn btn-green" href="${homeFor(Session.user())}">Back to My Dashboard ↗</a>`
      : '<a class="btn btn-green" href="/register">Join ACS to Get Involved ↗</a>'}
  `;
}
