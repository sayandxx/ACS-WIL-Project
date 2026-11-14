const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const promotionRoutes = require('./routes/promotions');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows your server to accept JSON payloads

// A simple health check, handy for testing the server is up
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/admin', adminRoutes);

// Unknown /api/... routes get a JSON 404 instead of an HTML page
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// Serve the frontend files (css, js), so the whole app runs at http://localhost:3002
const FRONTEND = path.join(__dirname, 'frontend');
app.use(express.static(FRONTEND));

// Single page app: any page address (/, /login, /causes/5, /dashboard...) gets the same
// index.html, and the frontend router shows the right view. Addresses that look like
// files (/js/missing.js) still get a normal 404, so typos in file paths are easy to spot.
app.use((req, res, next) => {
    if (req.method !== 'GET' || path.extname(req.path) !== '') return next();
    res.sendFile(path.join(FRONTEND, 'index.html'));
});

// Bad JSON in a request body gives a clear 400 instead of a crash
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Request body must be valid JSON.' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Something went wrong, please try again' });
});

module.exports = app;
