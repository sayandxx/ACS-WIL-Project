# ACS app

The ACS Social Awareness Web Application, built as a **single page app**: the browser loads the site once, and moving between pages swaps the content instantly instead of loading a new page.

ACS app is its own project. It uses its own database (`acs_app`) and port (`3002`), so it runs alongside the main project (port 3000) and testproject (port 3001) without affecting either.

## Prerequisites
- Node.js (LTS)
- MySQL or MariaDB on port 3306 (XAMPP works: start **MySQL** in the control panel)

## Setup
1. Run `npm install`.
2. Create the database: **Import** `database/schema.sql` in phpMyAdmin (or run it in MySQL Workbench). This creates `acs_app`.
   - Already have an `acs_app` database from before the November 2026 fixes? Either drop it and import `schema.sql` again, or run `database/migrations/001_add_token_version.sql` once. Without the new `token_version` column, logging in will fail.
3. Copy `.env.example` to `.env`. Leave `DB_PASSWORD=` empty for XAMPP's default root user, and set your own `JWT_SECRET`.
4. Run `npm start`.
5. Open **http://localhost:3002**.

## Test accounts
All use the password **Password123!**

| Email | Account type |
|---|---|
| jane.citizen@example.com | Individual |
| cafe.owner@example.com | Business |
| greenteam@example.org | Organisation |
| admin.test@example.com | Administrator |

## Page addresses
| Address | Who | What |
|---|---|---|
| `/` | Everyone | Approved causes (search + filter) and businesses |
| `/causes/:id` | Everyone | One cause in detail |
| `/register`, `/login` | Visitors | Sign up / log in (logged-in users are sent to their dashboard) |
| `/dashboard` | Individual, Organisation, Business | Submit campaigns or promotions, see their status |
| `/terms`, `/privacy` | Everyone | Terms of Service and Privacy Policy |
| `/admin` | Administrator | Approve or reject submissions, see history |
| anything else | Everyone | "Page not found" |

## How the single page app works
- The server sends the same `frontend/index.html` for every page address. Real files (`/css/...`, `/js/...`) are served as normal, and a missing file is a real 404.
- `frontend/js/router.js` reads the address bar and draws the matching view into `<main id="app">`. Clicking a link changes the address with `history.pushState`, so Back, Forward, bookmarks and refresh all work.
- Each page is a **view** in `frontend/js/views/`. A view is a function that receives an element and fills it.
- Routes and their access rules are listed in `frontend/js/main.js`. To add a page: write a view, then add one line there.

```
frontend/
  index.html          the one page (navbar, <main id="app">, footer)
  css/style.css       the team's original design
  css/app.css         styles for the newer features
  js/main.js          the list of routes; starts the router
  js/router.js        address → view, link handling, access rules
  js/nav.js           navbar login state
  js/api.js           backend calls, login session, helpers
  js/views/           home, cause, login, register, dashboard, admin, notFound
```

## API
| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public (returns a token) |
| GET | `/api/auth/me` | Logged in |
| POST | `/api/auth/logout` | Logged in (the token, and any older ones, stop working) |
| GET | `/api/campaigns` (`?category=`, `?search=`) | Public, approved only |
| GET | `/api/campaigns/mine` | Logged in |
| GET | `/api/campaigns/:id` | Public if approved; owner/admin otherwise |
| POST | `/api/campaigns` | Individual, Organisation |
| DELETE | `/api/campaigns/:id` | Owner |
| GET | `/api/promotions` | Public, approved only |
| GET | `/api/promotions/mine` | Logged in |
| POST | `/api/promotions` | Business |
| DELETE | `/api/promotions/:id` | Owner |
| GET | `/api/admin/stats`, `/api/admin/pending`, `/api/admin/logs` | Administrator |
| PATCH | `/api/admin/campaigns/:id`, `/api/admin/promotions/:id` | Administrator (`{"decision":"Approved"}` or `"Rejected"`) |

Logged-in requests send the token as `Authorization: Bearer <token>`.

## Security rules (from the final prototype bug report)
- **Logout** (FB-01): logging out calls `/api/auth/logout`, which bumps the user's `token_version`. Every request checks it, so a copied token stops working straight away. This logs the user out on all their devices.
- **Passwords** (FB-02): at least 8 characters, a letter plus a number or symbol, and not on a short list of common passwords. Checked in the browser and on the server (`routes/validate.js`).
- **Other tabs** (FB-03): logging in or out in one tab updates every open tab without a click.
- **Login links** (FB-04): `?next=` only accepts addresses on this site, including tricks like `/\evil.com`.
- **Wrong passwords** (FB-05): after 5 wrong passwords for one email from one IP address, that login is blocked for 15 minutes (`middleware/loginLimiter.js`). The counts are kept in memory.
- **Categories** (FB-06): campaigns and promotions only accept the categories listed in the design document.
- **Policies** (FB-07): `/terms` and `/privacy` are linked from the sign-up form.

## Database note
`schema.sql` includes a `CAMPAIGN_SUPPORTER` table (who has joined which cause) with sample rows. It is ready for a "join a cause" feature but nothing in the app uses it yet.

## Tests
1. Copy `.env.test.example` to `.env.test` and fill in your database login. `DB_NAME` must end in `_test` (the tests refuse to run otherwise, so they can't wipe real data).
2. Run `npm test` (110 tests).

## Packaging for submission
Zip the `acs-app` folder **without** `node_modules`, `coverage`, `.env` and `.env.test`. Whoever unzips it runs `npm install` for their own computer (Windows, Mac or Linux) and makes their own `.env` from `.env.example`.
