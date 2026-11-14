// Entry point: lists every page address and which view draws it, then starts the router.

import { startRouter } from './router.js';
import { renderNav } from './nav.js';
import homeView from './views/home.js';
import causeView from './views/cause.js';
import loginView from './views/login.js';
import registerView from './views/register.js';
import dashboardView from './views/dashboard.js';
import adminView from './views/admin.js';
import notFoundView from './views/notFound.js';
import { termsView, privacyView } from './views/policies.js';

const routes = [
  { path: '/', view: homeView },
  { path: '/causes/:id', view: causeView, title: 'Cause' },
  { path: '/login', view: loginView, title: 'Log in', guestOnly: true },
  { path: '/register', view: registerView, title: 'Create Account', guestOnly: true },
  { path: '/dashboard', view: dashboardView, title: 'My Dashboard', roles: ['Individual', 'Organisation', 'Business'] },
  { path: '/admin', view: adminView, title: 'Admin Panel', roles: ['Administrator'] },
  { path: '/terms', view: termsView, title: 'Terms of Service' },
  { path: '/privacy', view: privacyView, title: 'Privacy Policy' },
  { path: '*', view: notFoundView, title: 'Page not found' },
];

startRouter(routes, { afterRender: renderNav });
