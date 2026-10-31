const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, account_type } = req.body;

        // 1. Validate required fields
        if (!full_name || !email || !password || !account_type) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }

        // 2. Validate password length (minimum 8 characters)
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
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
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check for empty fields
        if (!email || !password) {
            return res.status(400).json({ message: 'Please complete both fields.' });
        }

        // 2. Find the user by email
        const [users] = await db.query('SELECT * FROM USER WHERE email = ?', [email]);
        
        // 3. Generic error if email is not found
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];

        // 4. Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 5. Success
        res.status(200).json({
            message: 'Logged in successfully',
            user: {
                id: user.id,
                full_name: user.full_name,
                account_type: user.account_type
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

module.exports = router;