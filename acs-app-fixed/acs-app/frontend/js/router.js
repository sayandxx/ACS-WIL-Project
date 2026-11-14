// The router: decides which view to show for the address in the browser's address bar.
//
// How a single page app works:
// 1. The server always sends the same index.html.
// 2. This router reads the address (e.g. /causes/5) and draws the matching view into <main id="app">.
// 3. Clicking a link changes the address with history.pushState instead of loading a new page,
//    then draws the new view. Back/Forward fire "popstate", and we draw again.

import { Session, homeFor, TOKEN_KEY, USER_KEY } from './api.js';

let routes = [];
let current = { cleanup: null, token: 0 };
let onAfterRender = () => {};

// Turns "/causes/:id" into a regex and returns the params when the path matches
function matchRoute(pathname) {
  for (const route of routes) {
    if (route.path === '*') continue; // the catch-all is used only when nothing else matches
    const names = [];
    const pattern = route.path.replace(/:([a-z]+)/gi, (_, name) => {
      names.push(name);
      return '([^/]+)';
    });
    const match = pathname.match(new RegExp(`^${pattern}/?$`));
    if (match) {
      const params = {};
      names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      return { route, params };
    }
  }
  return { route: routes.find((r) => r.path === '*'), params: {} };
}

// Only our own pages (e.g. "/dashboard"), never another website.
// Browsers treat a backslash like a slash, so "/\evil.com" means the same as "//evil.com" (FB-04).
// They also silently drop tabs and newlines, so those are rejected too. As a final check the
// address is resolved the way the browser would, and must stay on this site.
export function isSafeInternalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  if (value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !url.pathname.startsWith('/api');
  } catch {
    return false;
  }
}

// Change the page. replace = true swaps the current history entry instead of adding one.
export function navigate(url, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  render();
}

function scrollToHash(hash) {
  const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  return false;
}

async function render() {
  const { pathname, search, hash } = window.location;
  const { route, params } = matchRoute(pathname);
  const user = Session.user();

  // Access rules, checked before anything is drawn
  if (route.guestOnly && Session.isLoggedIn()) {
    return navigate(homeFor(user), { replace: true });
  }
  if (route.roles) {
    if (!Session.isLoggedIn()) {
      return navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
    }
    if (!route.roles.includes(user.account_type)) {
      return navigate(homeFor(user), { replace: true });
    }
  }

  // Tidy up the previous view (timers, listeners)
  if (typeof current.cleanup === 'function') current.cleanup();
  const token = ++current.token;
  const isActive = () => token === current.token;

  // Each view gets a fresh element, so a slow, older view can never draw over a newer one
  const app = document.getElementById('app');
  const viewEl = document.createElement('div');
  viewEl.className = 'view';
  app.replaceChildren(viewEl);
  document.title = route.title ? `${route.title} | ACS` : 'ACS | People. Causes. Change.';

  onAfterRender({ pathname });

  const ctx = {
    params,
    query: new URLSearchParams(search),
    isActive,
    // A view that redirects after it has been replaced must not drag the user away
    navigate: (url, opts) => { if (isActive()) navigate(url, opts); },
  };

  const cleanup = await route.view(viewEl, ctx);
  if (!isActive()) {
    if (typeof cleanup === 'function') cleanup();
    return;
  }
  current.cleanup = cleanup;

  // Scroll: to the #section if the address has one, otherwise to the top
  if (!scrollToHash(hash)) window.scrollTo(0, 0);

  // Move keyboard/screen-reader focus to the new view's heading
  const heading = viewEl.querySelector('h1, h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

// Intercept clicks on normal links to our own pages
function handleClick(event) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // let "open in new tab" work

  const link = event.target.closest('a[href]');
  if (!link || link.target || link.hasAttribute('download') || link.dataset.external !== undefined) return;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith('/api')) return;

  event.preventDefault();

  // Same page, just a #section: scroll there without redrawing
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
    history.pushState(null, '', url.hash);
    scrollToHash(url.hash);
    return;
  }
  navigate(url.pathname + url.search + url.hash);
}

export function startRouter(routeList, { afterRender } = {}) {
  routes = routeList;
  if (afterRender) onAfterRender = afterRender;
  document.addEventListener('click', handleClick);
  window.addEventListener('popstate', render);

  // Logging in or out in another tab changes localStorage there, and the browser tells
  // every other tab with a "storage" event. Redraw so this tab matches straight away (FB-03).
  // event.key is null when the other tab cleared all storage.
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === TOKEN_KEY || event.key === USER_KEY) render();
  });

  render();
}
