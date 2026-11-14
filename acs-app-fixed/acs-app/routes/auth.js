const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { createToken, requireAuth } = require('../middleware/auth');
const { cleanText, isValidEmail, passwordProblem } = require('./validate');
const { checkLoginLimit, recordFailure, recordSuccess } = require('../middleware/loginLimiter');

// Account types people can choose when signing up.
// Administrator is left out on purpose: admins are created directly in the database.
const SIGNUP_ACCOUNT_TYPES = ['Individual', 'Business', 'Organisation'];

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const full_name = cleanText(req.body.full_name);
        const email = cleanText(req.body.email).toLowerCase();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const account_type = cleanText(req.body.account_type);

        // 1. Validate required fields
        if (!full_name || !email || !password || !account_type) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }

        // 1b. Validate the values themselves
        if (full_name.length > 255) {
            return res.status(400).json({ message: 'Full name is too long.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        if (!SIGNUP_ACCOUNT_TYPES.includes(account_type)) {
            return res.status(400).json({ message: 'Please choose a valid account type.' });
        }

        // 2. Validate the password (length, a number or symbol, not a common password)
        const problem = passwordProblem(password);
        if (problem) {
            return res.status(400).json({ message: problem });
        }

        // 3. Check if email already exists (case-insensitive check)
        const [existingUsers] = await db.query('SELECT id FROM USER WHERE LOWER(email) = LOWER(?)', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }

        // 4. Hash the password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // 5. Insert the new user into the database
        const [result] = await db.query(
            'INSERT INTO USER (full_name, email, password_hash, account_type) VALUES (?, ?, ?, ?)',
            [full_name, email, password_hash, account_type]
        );

        res.status(201).json({
            message: 'Account created successfully',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// POST /api/auth/login
router.post('/login', checkLoginLimit, async (req, res) => {
    try {
        const email = cleanText(req.body.email);
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        // 1. Check for empty fields
        if (!email || !password) {
            return res.status(400).json({ message: 'Please complete both fields.' });
        }

        // 2. Find the user by email (case-insensitive)
        const [users] = await db.query('SELECT * FROM USER WHERE LOWER(email) = LOWER(?)', [email]);

        // 3. Generic error if email is not found
        if (users.length === 0) {
            recordFailure(req, email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];

        // 4. Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            recordFailure(req, email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        recordSuccess(req, email);

        // 5. Success: send back a token the frontend keeps to stay logged in
        res.status(200).json({
            message: 'Logged in successfully',
            token: createToken(user),
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                account_type: user.account_type
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// GET /api/auth/me — returns the logged-in user (used by the frontend on page load)
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, full_name, email, account_type, created_at FROM USER WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: 'Please log in to continue.' });
        }
        res.json({ user: users[0] });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// POST /api/auth/logout — makes the current login token (and any older ones) stop working.
// Bumping token_version means every token issued before now is rejected by requireAuth (FB-01).
// Note: this logs the user out on every device, not just this browser.
router.post('/logout', requireAuth, async (req, res) => {
    try {
        await db.query('UPDATE USER SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
        res.json({ message: 'Logged out' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

module.exports = router;
