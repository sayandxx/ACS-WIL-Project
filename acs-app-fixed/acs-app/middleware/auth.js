const jwt = require('jsonwebtoken');
const db = require('../config/db');

// The example secret from .env.example. Fine on your own computer, never on a real server.
const EXAMPLE_SECRETS = ['wilprogramacsapp1', 'change-me-to-a-long-random-secret'];

// The secret used to sign login tokens. Set JWT_SECRET in your .env file.
// In development we fall back to a fixed value so the app still runs, but warn about it.
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        if (!secret || secret.length < 32 || EXAMPLE_SECRETS.includes(secret)) {
            throw new Error('JWT_SECRET must be set to a long random value (32+ characters) in production.');
        }
        return secret;
    }
    if (secret) return secret;
    if (!getSecret.warned) {
        console.warn('JWT_SECRET is not set in .env, using an insecure development secret.');
        getSecret.warned = true;
    }
    return 'dev-only-secret-change-me';
}

// Creates a login token that lasts 8 hours.
// "tv" is the user's token_version. Logging out bumps the version in the database,
// so every token issued before that stops working straight away (FB-01).
function createToken(user) {
    return jwt.sign(
        { id: user.id, account_type: user.account_type, tv: user.token_version || 0 },
        getSecret(),
        { expiresIn: '8h' }
    );
}

// Reads "Authorization: Bearer <token>" and returns the user inside it, or null.
// The token must be correctly signed AND still match the user's token_version in the database,
// so a token copied before logging out is rejected.
async function readUser(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    let payload;
    try {
        payload = jwt.verify(token, getSecret());
    } catch {
        return null;
    }

    const [rows] = await db.query('SELECT token_version, account_type FROM USER WHERE id = ?', [payload.id]);
    if (rows.length === 0) return null;
    if (Number(rows[0].token_version) !== Number(payload.tv || 0)) return null;

    // Use the account type from the database, not just the token
    return { ...payload, account_type: rows[0].account_type };
}

// Blocks the request unless the user is logged in
async function requireAuth(req, res, next) {
    try {
        const user = await readUser(req);
        if (!user) {
            return res.status(401).json({ message: 'Please log in to continue.' });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
}

// Lets the request through either way, but attaches the user if logged in
async function optionalAuth(req, res, next) {
    try {
        req.user = await readUser(req);
        next();
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
}

// Blocks the request unless the logged-in user has one of the given account types
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.account_type)) {
            return res.status(403).json({ message: 'Your account type cannot do this.' });
        }
        next();
    };
}

module.exports = { createToken, requireAuth, optionalAuth, requireRole };
