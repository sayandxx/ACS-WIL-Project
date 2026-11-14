const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { cleanText, isValidUrl, toId, CAMPAIGN_CATEGORIES } = require('./validate');

// Who can create campaigns
const CAMPAIGN_CREATORS = ['Individual', 'Organisation'];

const SELECT_CAMPAIGN = `
    SELECT c.id, c.user_id, c.title, c.category, c.short_description, c.image_url,
           c.status, c.created_at, u.full_name AS creator_name
    FROM CAMPAIGN c
    JOIN USER u ON u.id = c.user_id`;

// GET /api/campaigns — approved campaigns anyone can see. Optional ?category= and ?search=
router.get('/', async (req, res) => {
    try {
        const category = cleanText(req.query.category);
        const search = cleanText(req.query.search);

        let sql = `${SELECT_CAMPAIGN} WHERE c.status = 'Approved'`;
        const params = [];
        if (category) {
            sql += ' AND c.category = ?';
            params.push(category);
        }
        if (search) {
            sql += ' AND (c.title LIKE ? OR c.short_description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY c.created_at DESC, c.id DESC';

        const [campaigns] = await db.query(sql, params);
        res.json({ campaigns });
    } catch (error) {
        console.error('List campaigns error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// GET /api/campaigns/mine — the logged-in user's own campaigns, any status
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const [campaigns] = await db.query(
            `${SELECT_CAMPAIGN} WHERE c.user_id = ? ORDER BY c.created_at DESC, c.id DESC`,
            [req.user.id]
        );
        res.json({ campaigns });
    } catch (error) {
        console.error('My campaigns error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// GET /api/campaigns/:id — one campaign. Pending/rejected ones are only visible to their owner or an admin.
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (!id) return res.status(404).json({ message: 'Campaign not found' });

        const [rows] = await db.query(`${SELECT_CAMPAIGN} WHERE c.id = ?`, [id]);
        const campaign = rows[0];
        const canSee = campaign && (
            campaign.status === 'Approved' ||
            (req.user && (req.user.id === campaign.user_id || req.user.account_type === 'Administrator'))
        );
        if (!canSee) return res.status(404).json({ message: 'Campaign not found' });

        res.json({ campaign });
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// POST /api/campaigns — create a campaign. It starts as Pending until an admin approves it.
router.post('/', requireAuth, requireRole(...CAMPAIGN_CREATORS), async (req, res) => {
    try {
        const title = cleanText(req.body.title);
        const category = cleanText(req.body.category);
        const short_description = cleanText(req.body.short_description);
        const image_url = cleanText(req.body.image_url);

        if (!title || !category || !short_description) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }
        if (title.length > 255) {
            return res.status(400).json({ message: 'Title is too long.' });
        }
        if (!CAMPAIGN_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: 'Please choose a valid category.' });
        }
        if (short_description.length > 2000) {
            return res.status(400).json({ message: 'Description must be 2000 characters or fewer.' });
        }
        if (image_url && !isValidUrl(image_url)) {
            return res.status(400).json({ message: 'Image link must be a valid web address (http or https).' });
        }

        const [result] = await db.query(
            'INSERT INTO CAMPAIGN (user_id, title, category, short_description, image_url) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, title, category, short_description, image_url || null]
        );

        res.status(201).json({
            message: 'Campaign submitted. It will appear publicly once an administrator approves it.',
            campaignId: result.insertId
        });
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// DELETE /api/campaigns/:id — owners can delete their own campaign
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (!id) return res.status(404).json({ message: 'Campaign not found' });

        const [result] = await db.query('DELETE FROM CAMPAIGN WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Campaign not found' });
        }
        res.json({ message: 'Campaign deleted' });
    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

module.exports = router;
