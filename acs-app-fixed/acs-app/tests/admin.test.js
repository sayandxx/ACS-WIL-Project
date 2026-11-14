const db = require('../config/db');
const { resetDatabase } = require('./helpers/testDb');
const { app, request, loginAs, auth } = require('./helpers/api');

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await db.end();
});

describe('admin access control', () => {
    test.each(['/api/admin/stats', '/api/admin/pending', '/api/admin/logs'])(
        '%s needs a login',
        async (url) => {
            const res = await request(app).get(url);
            expect(res.status).toBe(401);
        }
    );

    test.each(['individual', 'business', 'organisation'])(
        'a %s account is refused',
        async (who) => {
            const token = await loginAs(who);
            const res = await request(app).get('/api/admin/pending').set(auth(token));
            expect(res.status).toBe(403);
        }
    );

    test('a normal user cannot approve their own campaign', async () => {
        const token = await loginAs('organisation');
        const res = await request(app)
            .patch('/api/admin/campaigns/4')
            .set(auth(token))
            .send({ decision: 'Approved' });

        expect(res.status).toBe(403);
        const [rows] = await db.query('SELECT status FROM CAMPAIGN WHERE id = 4');
        expect(rows[0].status).toBe('Pending');
    });
});

describe('GET /api/admin/stats and /pending', () => {
    test('stats count users and items by status', async () => {
        const token = await loginAs('admin');
        const res = await request(app).get('/api/admin/stats').set(auth(token));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            users: 4,
            campaigns: { Pending: 1, Approved: 3, Rejected: 1 },
            promotions: { Pending: 1, Approved: 1, Rejected: 0 },
        });
    });

    test('pending lists only items waiting for a decision', async () => {
        const token = await loginAs('admin');
        const res = await request(app).get('/api/admin/pending').set(auth(token));

        expect(res.status).toBe(200);
        expect(res.body.campaigns.map((c) => c.title)).toEqual(['Beach Clean-up Day']);
        expect(res.body.promotions.map((p) => p.business_name)).toEqual(['Spring Garden Sale']);
        expect(res.body.campaigns[0].creator_name).toBe('Green Team');
    });
});

describe('PATCH /api/admin/campaigns/:id', () => {
    test('approving makes the campaign public and writes a log entry', async () => {
        const token = await loginAs('admin');
        const res = await request(app)
            .patch('/api/admin/campaigns/4')
            .set(auth(token))
            .send({ decision: 'Approved' });

        expect(res.status).toBe(200);

        const publicList = await request(app).get('/api/campaigns');
        expect(publicList.body.campaigns.map((c) => c.title)).toContain('Beach Clean-up Day');

        const [logs] = await db.query('SELECT * FROM MODERATION_LOG');
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({ admin_id: 4, target_type: 'Campaign', target_id: 4, decision: 'Approved' });
    });

    test('rejecting keeps it hidden', async () => {
        const token = await loginAs('admin');
        await request(app).patch('/api/admin/campaigns/4').set(auth(token)).send({ decision: 'Rejected' });

        const [rows] = await db.query('SELECT status FROM CAMPAIGN WHERE id = 4');
        expect(rows[0].status).toBe('Rejected');
        const publicList = await request(app).get('/api/campaigns');
        expect(publicList.body.campaigns.map((c) => c.title)).not.toContain('Beach Clean-up Day');
    });

    test('an item can only be decided once', async () => {
        const token = await loginAs('admin');
        const res = await request(app).patch('/api/admin/campaigns/1').set(auth(token)).send({ decision: 'Rejected' });

        expect(res.status).toBe(409); // campaign 1 is already Approved
        const [logs] = await db.query('SELECT id FROM MODERATION_LOG');
        expect(logs).toHaveLength(0);
    });

    test('rejects an invalid decision', async () => {
        const token = await loginAs('admin');
        const res = await request(app).patch('/api/admin/campaigns/4').set(auth(token)).send({ decision: 'Maybe' });
        expect(res.status).toBe(400);
    });

    test('unknown campaign returns 404', async () => {
        const token = await loginAs('admin');
        const res = await request(app).patch('/api/admin/campaigns/999').set(auth(token)).send({ decision: 'Approved' });
        expect(res.status).toBe(404);
    });
});

describe('PATCH /api/admin/promotions/:id', () => {
    test('approving a promotion makes it public and logs it', async () => {
        const token = await loginAs('admin');
        const res = await request(app)
            .patch('/api/admin/promotions/2')
            .set(auth(token))
            .send({ decision: 'Approved' });

        expect(res.status).toBe(200);
        const publicList = await request(app).get('/api/promotions');
        expect(publicList.body.promotions.map((p) => p.business_name)).toContain('Spring Garden Sale');

        const [logs] = await db.query('SELECT target_type FROM MODERATION_LOG');
        expect(logs[0].target_type).toBe('BusinessPromotion');
    });
});

describe('GET /api/admin/logs', () => {
    test('shows decisions with the admin and item names', async () => {
        const token = await loginAs('admin');
        await request(app).patch('/api/admin/campaigns/4').set(auth(token)).send({ decision: 'Approved' });
        await request(app).patch('/api/admin/promotions/2').set(auth(token)).send({ decision: 'Rejected' });

        const res = await request(app).get('/api/admin/logs').set(auth(token));

        expect(res.status).toBe(200);
        expect(res.body.logs).toHaveLength(2);
        const names = res.body.logs.map((l) => l.target_name).sort();
        expect(names).toEqual(['Beach Clean-up Day', 'Spring Garden Sale']);
        res.body.logs.forEach((l) => expect(l.admin_name).toBe('Admin Test'));
    });
});

describe('full journey', () => {
    test('organisation submits → admin approves → public sees it', async () => {
        const org = await loginAs('organisation');
        const created = await request(app).post('/api/campaigns').set(auth(org)).send({
            title: 'Tree Planting Weekend',
            category: 'Environment',
            short_description: 'Planting 500 native trees.',
        });
        expect(created.status).toBe(201);

        const admin = await loginAs('admin');
        const pending = await request(app).get('/api/admin/pending').set(auth(admin));
        expect(pending.body.campaigns.map((c) => c.id)).toContain(created.body.campaignId);

        const decided = await request(app)
            .patch(`/api/admin/campaigns/${created.body.campaignId}`)
            .set(auth(admin))
            .send({ decision: 'Approved' });
        expect(decided.status).toBe(200);

        const publicView = await request(app).get(`/api/campaigns/${created.body.campaignId}`);
        expect(publicView.status).toBe(200);
        expect(publicView.body.campaign.title).toBe('Tree Planting Weekend');
    });
});
