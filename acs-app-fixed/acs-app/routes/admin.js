const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toId } = require('./validate');

// Every route in this file needs a logged-in Administrator
router.use(requireAuth, requireRole('Administrator'));

const DECISIONS = ['Approved', 'Rejected'];

// GET /api/admin/stats — counts for the admin dashboard
router.get('/stats', async (req, res) => {
    try {
        const [[users]] = await db.query('SELECT COUNT(*) AS total FROM USER');
        const [campaignRows] = await db.query('SELECT status, COUNT(*) AS total FROM CAMPAIGN GROUP BY status');
        const [promotionRows] = await db.query('SELECT status, COUNT(*) AS total FROM BUSINESS_PROMOTION GROUP BY status');

        const byStatus = (rows) => {
            const counts = { Pending: 0, Approved: 0, Rejected: 0 };
            rows.forEach((r) => { counts[r.status] = Number(r.total); });
            return counts;
        };

        res.json({
            users: Number(users.total),
            campaigns: byStatus(campaignRows),
            promotions: byStatus(promotionRows)
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// GET /api/admin/pending — everything waiting for a decision, oldest first
router.get('/pending', async (req, res) => {
    try {
        const [campaigns] = await db.query(
            `SELECT c.id, c.title, c.category, c.short_description, c.image_url, c.created_at,
                    u.full_name AS creator_name, u.account_type AS creator_type
             FROM CAMPAIGN c JOIN USER u ON u.id = c.user_id
             WHERE c.status = 'Pending' ORDER BY c.created_at, c.id`
        );
        const [promotions] = await db.query(
            `SELECT p.id, p.business_name, p.category, p.created_at, u.full_name AS owner_name
             FROM BUSINESS_PROMOTION p JOIN USER u ON u.id = p.user_id
             WHERE p.status = 'Pending' ORDER BY p.created_at, p.id`
        );
        res.json({ campaigns, promotions });
    } catch (error) {
        console.error('Admin pending error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

// Shared logic for approving/rejecting. Updates the item and writes a log row together,
// using a transaction so we never end up with one change saved without the other.
function moderate(table, targetType) {
    return async (req, res) => {
        const id = toId(req.params.id);
        const decision = req.body.decision;

        if (!id) return res.status(404).json({ message: 'Item not found' });
        if (!DECISIONS.includes(decision)) {
            return res.status(400).json({ message: 'Decision must be Approved or Rejected.' });
        }

        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            const [rows] = await conn.query(`SELECT status FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
            if (rows.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Item not found' });
            }
            if (rows[0].status !== 'Pending') {
                await conn.rollback();
                return res.status(409).json({ message: `This item has already been ${rows[0].status.toLowerCase()}.` });
            }

            await conn.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [decision, id]);
            await conn.query(
                'INSERT INTO MODERATION_LOG (admin_id, target_type, target_id, decision) VALUES (?, ?, ?, ?)',
                [req.user.id, targetType, id, decision]
            );

            await conn.commit();
            res.json({ message: `Item ${decision.toLowerCase()}`, status: decision });
        } catch (error) {
            if (conn) await conn.rollback().catch(() => {});
            console.error('Moderation error:', error);
            res.status(500).json({ message: 'Something went wrong, please try again' });
        } finally {
            if (conn) conn.release();
        }
    };
}

// PATCH /api/admin/campaigns/:id   body: { "decision": "Approved" | "Rejected" }
router.patch('/campaigns/:id', moderate('CAMPAIGN', 'Campaign'));

// PATCH /api/admin/promotions/:id  body: { "decision": "Approved" | "Rejected" }
router.patch('/promotions/:id', moderate('BUSINESS_PROMOTION', 'BusinessPromotion'));

// GET /api/admin/logs — the 50 most recent moderation decisions
router.get('/logs', async (req, res) => {
    try {
        const [logs] = await db.query(
            `SELECT m.id, m.target_type, m.target_id, m.decision, m.created_at,
                    u.full_name AS admin_name,
                    COALESCE(c.title, p.business_name) AS target_name
             FROM MODERATION_LOG m
             JOIN USER u ON u.id = m.admin_id
             LEFT JOIN CAMPAIGN c ON m.target_type = 'Campaign' AND c.id = m.target_id
             LEFT JOIN BUSINESS_PROMOTION p ON m.target_type = 'BusinessPromotion' AND p.id = m.target_id
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT 50`
        );
        res.json({ logs });
    } catch (error) {
        console.error('Admin logs error:', error);
        res.status(500).json({ message: 'Something went wrong, please try again' });
    }
});

module.exports = router;
