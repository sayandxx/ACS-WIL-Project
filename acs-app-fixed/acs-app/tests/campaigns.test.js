const db = require('../config/db');
const { resetDatabase } = require('./helpers/testDb');
const { app, request, loginAs, auth } = require('./helpers/api');

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await db.end();
});

// Seed data: campaigns 1-3 Approved, 4 Pending (Green Team), 5 Rejected (Jane)

const newCampaign = {
    title: 'River Clean-up',
    category: 'Environment',
    short_description: 'Volunteers clearing rubbish from the river bank.',
    image_url: 'https://example.com/river.jpg',
};

describe('GET /api/campaigns (public list)', () => {
    test('shows only approved campaigns, with the creator name', async () => {
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.campaigns).toHaveLength(3);
        res.body.campaigns.forEach((c) => expect(c.status).toBe('Approved'));
        expect(res.body.campaigns.map((c) => c.title)).not.toContain('Beach Clean-up Day');
        expect(res.body.campaigns[0].creator_name).toEqual(expect.any(String));
    });

    test('filters by category', async () => {
        const res = await request(app).get('/api/campaigns?category=Education');

        expect(res.body.campaigns).toHaveLength(1);
        expect(res.body.campaigns[0].title).toBe('Education for All');
    });

    test('searches title and description', async () => {
        const res = await request(app).get('/api/campaigns?search=support');

        // "Community support network." matches the description of Stronger Together
        expect(res.body.campaigns.map((c) => c.title)).toEqual(['Stronger Together']);
    });
});

describe('GET /api/campaigns/:id', () => {
    test('anyone can view an approved campaign', async () => {
        const res = await request(app).get('/api/campaigns/1');
        expect(res.status).toBe(200);
        expect(res.body.campaign.title).toBe('Greener Communities');
    });

    test('a pending campaign is hidden from the public', async () => {
        const res = await request(app).get('/api/campaigns/4');
        expect(res.status).toBe(404);
    });

    test('the owner can view their own pending campaign', async () => {
        const token = await loginAs('organisation');
        const res = await request(app).get('/api/campaigns/4').set(auth(token));
        expect(res.status).toBe(200);
        expect(res.body.campaign.status).toBe('Pending');
    });

    test('an admin can view a pending campaign', async () => {
        const token = await loginAs('admin');
        const res = await request(app).get('/api/campaigns/4').set(auth(token));
        expect(res.status).toBe(200);
    });

    test('another user cannot view someone else\'s pending campaign', async () => {
        const token = await loginAs('individual');
        const res = await request(app).get('/api/campaigns/4').set(auth(token));
        expect(res.status).toBe(404);
    });

    test('a non-numeric id returns 404', async () => {
        const res = await request(app).get('/api/campaigns/abc');
        expect(res.status).toBe(404);
    });
});

describe('POST /api/campaigns', () => {
    test('an organisation can submit a campaign, and it starts as Pending', async () => {
        const token = await loginAs('organisation');
        const res = await request(app).post('/api/campaigns').set(auth(token)).send(newCampaign);

        expect(res.status).toBe(201);
        const [rows] = await db.query('SELECT * FROM CAMPAIGN WHERE id = ?', [res.body.campaignId]);
        expect(rows[0]).toMatchObject({ user_id: 3, title: 'River Clean-up', status: 'Pending' });
    });

    test('a new campaign is not public until approved', async () => {
        const token = await loginAs('individual');
        await request(app).post('/api/campaigns').set(auth(token)).send(newCampaign);

        const res = await request(app).get('/api/campaigns');
        expect(res.body.campaigns.map((c) => c.title)).not.toContain('River Clean-up');
    });

    test('image link is optional', async () => {
        const token = await loginAs('individual');
        const { image_url, ...noImage } = newCampaign;
        const res = await request(app).post('/api/campaigns').set(auth(token)).send(noImage);
        expect(res.status).toBe(201);
    });

    test('you must be logged in', async () => {
        const res = await request(app).post('/api/campaigns').send(newCampaign);
        expect(res.status).toBe(401);
    });

    test('business accounts cannot create campaigns', async () => {
        const token = await loginAs('business');
        const res = await request(app).post('/api/campaigns').set(auth(token)).send(newCampaign);
        expect(res.status).toBe(403);
    });

    test.each(['title', 'category', 'short_description'])('rejects a missing %s', async (field) => {
        const token = await loginAs('organisation');
        const body = { ...newCampaign };
        delete body[field];
        const res = await request(app).post('/api/campaigns').set(auth(token)).send(body);
        expect(res.status).toBe(400);
    });

    // FB-06: only the categories from the design document are accepted
    test('rejects a category that is not in the list', async () => {
        const token = await loginAs('organisation');
        const res = await request(app)
            .post('/api/campaigns')
            .set(auth(token))
            .send({ ...newCampaign, category: 'Totally Made Up' });
        expect(res.status).toBe(400);
        const [rows] = await db.query('SELECT id FROM CAMPAIGN WHERE title = ?', [newCampaign.title]);
        expect(rows).toHaveLength(0);
    });

    test.each(['Environment', 'Education', 'Community', 'Health', 'Animal Welfare', 'Other'])(
        'accepts the category %s',
        async (category) => {
            const token = await loginAs('organisation');
            const res = await request(app).post('/api/campaigns').set(auth(token)).send({ ...newCampaign, category });
            expect(res.status).toBe(201);
        }
    );

    test('rejects an image link that is not a web address', async () => {
        const token = await loginAs('organisation');
        const res = await request(app)
            .post('/api/campaigns')
            .set(auth(token))
            .send({ ...newCampaign, image_url: 'javascript:alert(1)' });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/campaigns/mine', () => {
    test('shows all of my campaigns including pending and rejected', async () => {
        const token = await loginAs('individual');
        const res = await request(app).get('/api/campaigns/mine').set(auth(token));

        expect(res.status).toBe(200);
        const statuses = res.body.campaigns.map((c) => c.status).sort();
        expect(statuses).toEqual(['Approved', 'Rejected']); // Stronger Together + Winter Coat Drive
        res.body.campaigns.forEach((c) => expect(c.user_id).toBe(1));
    });
});

describe('DELETE /api/campaigns/:id', () => {
    test('the owner can delete their campaign', async () => {
        const token = await loginAs('organisation');
        const res = await request(app).delete('/api/campaigns/4').set(auth(token));

        expect(res.status).toBe(200);
        const [rows] = await db.query('SELECT id FROM CAMPAIGN WHERE id = 4');
        expect(rows).toHaveLength(0);
    });

    test('nobody else can delete it', async () => {
        const token = await loginAs('individual');
        const res = await request(app).delete('/api/campaigns/4').set(auth(token));

        expect(res.status).toBe(404);
        const [rows] = await db.query('SELECT id FROM CAMPAIGN WHERE id = 4');
        expect(rows).toHaveLength(1);
    });
});
