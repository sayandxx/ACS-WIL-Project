// A small limit on wrong passwords (FB-05).
//
// After MAX_FAILURES wrong passwords for the same email from the same address (IP),
// further login attempts for that email from that address get 429 until the window ends.
// A correct login clears the count. Counting per email + IP means one person guessing
// can't lock the real owner out from their own computer.
//
// The counts live in memory, which is fine for one server. They reset when the server restarts.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const attempts = new Map(); // key -> { count, firstAt }

function keyFor(req, email) {
    return `${req.ip}|${String(email || '').trim().toLowerCase()}`;
}

function removeExpired(now) {
    for (const [key, entry] of attempts) {
        if (now - entry.firstAt >= WINDOW_MS) attempts.delete(key);
    }
}

// Middleware: stop the request early if this email + IP is locked
function checkLoginLimit(req, res, next) {
    const now = Date.now();
    if (attempts.size > 1000) removeExpired(now);

    const entry = attempts.get(keyFor(req, req.body && req.body.email));
    if (entry && now - entry.firstAt < WINDOW_MS && entry.count >= MAX_FAILURES) {
        const retryAfter = Math.ceil((entry.firstAt + WINDOW_MS - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
            message: `Too many wrong passwords. Please wait ${Math.ceil(retryAfter / 60)} minutes and try again.`
        });
    }
    next();
}

function recordFailure(req, email) {
    const now = Date.now();
    const key = keyFor(req, email);
    const entry = attempts.get(key);
    if (!entry || now - entry.firstAt >= WINDOW_MS) {
        attempts.set(key, { count: 1, firstAt: now });
    } else {
        entry.count += 1;
    }
}

function recordSuccess(req, email) {
    attempts.delete(keyFor(req, email));
}

// Used by the tests so each test starts with no failed attempts
function resetLoginLimits() {
    attempts.clear();
}

module.exports = { checkLoginLimit, recordFailure, recordSuccess, resetLoginLimits, MAX_FAILURES };
