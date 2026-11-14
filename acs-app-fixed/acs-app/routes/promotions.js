const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cleanText, toId, BUSINESS_CATEGORIES } = require('./validate');

const SELECT_PROMOTION = `
    SELECT p.id, p.user_id, p.business_name, p.category, p.status, p.created_at,
           u.full_name AS owner_name
    FROM BUSINESS_PROMOTION p
    JOIN USER u ON u.id = p.user_id`;

// GET /api/promotions — approved business promotions anyone can see. Optional ?category=
router.get('/', async (req, res) => {
    try {
        const category = cleanText(req.query.category);
        let sql = `${SELECT_PROMOTION} WHERE p.status = 'Approved'`;
        const params = [];
        if (category) {
            sql += ' AND p.category = ?';
            params.push(category);
        }
        sql += ' ORDER BY p.created_at DESC, p.id DESC';

        const [promotions] = await db.query(sql, params);
        res.json({ promotions });
    } catch (error) {
        console.error('List promotions error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// GET /api/promotions/mine — the logged-in business's own promotions, any status
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const [promotions] = await db.query(
            `${SELECT_PROMOTION} WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC`,
            [req.user.id]
        );
        res.json({ promotions });
    } catch (error) {
        console.error('My promotions error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// POST /api/promotions — Business accounts submit a promotion. Starts as Pending.
router.post('/', requireAuth, requireRole('Business'), async (req, res) => {
    try {
        const business_name = cleanText(req.body.business_name);
        const category = cleanText(req.body.category);

        if (!business_name || !category) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }
        if (business_name.length > 255) {
            return res.status(400).json({ message: 'Business name is too long.' });
        }
        if (!BUSINESS_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: 'Please choose a valid category.' });
        }

        const [result] = await db.query(
            'INSERT INTO BUSINESS_PROMOTION (user_id, business_name, category) VALUES (?, ?, ?)',
            [req.user.id, business_name, category]
        );

        res.status(201).json({
            message: 'Promotion submitted. It will appear publicly once an administrator approves it.',
            promotionId: result.insertId
        });
    } catch (error) {
        console.error('Create promotion error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// DELETE /api/promotions/:id — owners can delete their own promotion
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (!id) return res.status(404).json({ message: 'Promotion not found' });

        const [result] = await db.query('DELETE FROM BUSINESS_PROMOTION WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Promotion not found' });
        }
        res.json({ message: 'Promotion deleted' });
    } catch (error) {
        console.error('Delete promotion error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

module.exports = router;
