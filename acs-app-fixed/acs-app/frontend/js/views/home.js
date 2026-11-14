// Home view: hero, live causes (search + filter), live businesses, call to action.

import {
  api, Session, homeFor, escapeHtml, campaignImage, imageTag, CAMPAIGN_CATEGORIES,
} from '../api.js';

export default async function homeView(el) {
  const loggedIn = Session.isLoggedIn();
  const user = Session.user();
  const ctaHref = loggedIn ? homeFor(user) : '/register';
  const ctaText = loggedIn ? 'Go to My Dashboard ↗' : null;
  const businessCta = loggedIn && user.account_type === 'Business'
    ? { href: '/dashboard', text: 'Promote Your Business ↗' }
    : { href: loggedIn ? homeFor(user) : '/register', text: 'Join as a Business ↗' };

  el.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <span class="tag">TOGETHER FOR A BETTER TOMORROW</span>
        <h1>Small Actions.<br><span>Extraordinary Impact.</span></h1>
        <p>
          Discover meaningful causes, connect with changemakers,
          and support small businesses making a positive impact
          in our communities.
        </p>
        <div class="hero-buttons">
          <a href="${ctaHref}" class="btn btn-lime">${ctaText || 'Get Started ↗'}</a>
          <a href="/#causes" class="btn btn-outline">Explore Causes ↓</a>
        </div>
      </div>
    </section>

    <section class="stats">
      <div><strong>01</strong><p>Discover a Cause</p></div>
      <div><strong>02</strong><p>Connect with People</p></div>
      <div><strong>03</strong><p>Make a Difference</p></div>
    </section>

    <section class="section" id="causes">
      <div class="section-heading">
        <div>
          <span class="eyebrow">MAKE YOUR IMPACT</span>
          <h2>Causes That <span>Move Us.</span></h2>
          <p>Find something you believe in and make a difference.</p>
        </div>
      </div>

      <div class="filters" role="search">
        <input type="search" id="causeSearch" placeholder="Search causes…" aria-label="Search causes">
        <div id="categoryChips" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
      </div>

      <div class="card-grid" id="causeGrid" aria-live="polite">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
    </section>

    <section class="business-section" id="businesses">
      <div class="business-image">
        ${imageTag('https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200')}
      </div>
      <div class="business-content">
        <span class="eyebrow">SUPPORT LOCAL BUSINESS</span>
        <h2>Good Business.<br><span>Greater Impact.</span></h2>
        <p>
          Behind every small business is a big dream.
          Discover independent businesses, connect with local
          entrepreneurs, and help communities grow.
        </p>
        <div class="business-list" id="businessList" aria-live="polite"></div>
        <a href="${businessCta.href}" class="btn btn-green">${businessCta.text}</a>
      </div>
    </section>

    <section class="cta" id="about">
      <span class="eyebrow">BE PART OF THE CHANGE</span>
      <h2>Change Begins With <span>People Like You.</span></h2>
      <p>Join a community that believes small actions create big impact.</p>
      <a href="${ctaHref}" class="btn btn-lime">${ctaText || 'Create Your Account ↗'}</a>
    </section>
  `;

  const grid = el.querySelector('#causeGrid');
  const search = el.querySelector('#causeSearch');
  const chipBox = el.querySelector('#categoryChips');
  const businessList = el.querySelector('#businessList');
  let activeCategory = '';
  let searchTimer;
  let requestId = 0;

  ['All', ...CAMPAIGN_CATEGORIES].forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = name;
    chip.setAttribute('aria-pressed', name === 'All' ? 'true' : 'false');
    chip.addEventListener('click', () => {
      activeCategory = name === 'All' ? '' : name;
      chipBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
      loadCampaigns();
    });
    chipBox.appendChild(chip);
  });

  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadCampaigns, 300); // wait until typing pauses
  });

  async function loadCampaigns() {
    const mine = ++requestId; // ignore answers to older searches that arrive late
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    if (search.value.trim()) params.set('search', search.value.trim());

    const { ok, data } = await api(`/api/campaigns?${params}`);
    if (mine !== requestId) return;

    if (!ok) {
      grid.innerHTML = `<div class="empty-state"><strong>Couldn't load causes</strong>${escapeHtml(data.message)}</div>`;
      return;
    }
    if (data.campaigns.length === 0) {
      grid.innerHTML = '<div class="empty-state"><strong>No causes found</strong>Try another search or category.</div>';
      return;
    }
    grid.innerHTML = data.campaigns.map((c) => `
      <article class="card">
        ${imageTag(campaignImage(c), '', 'loading="lazy"')}
        <div class="card-content">
          <span class="category">${escapeHtml(c.category.toUpperCase())}</span>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.short_description)}</p>
          <div class="card-meta">By ${escapeHtml(c.creator_name)}</div>
          <a href="/causes/${c.id}">View Cause ↗</a>
        </div>
      </article>
    `).join('');
  }

  async function loadBusinesses() {
    const { ok, data } = await api('/api/promotions');
    businessList.innerHTML = ok
      ? data.promotions.map((p) => `
          <div class="business-tile">
            <strong>${escapeHtml(p.business_name)}</strong>
            <span>${escapeHtml(p.category)}</span>
          </div>`).join('')
      : '';
  }

  // Draw the page straight away; cards fill in as the data arrives
  loadCampaigns();
  loadBusinesses();

  return () => clearTimeout(searchTimer);
}
