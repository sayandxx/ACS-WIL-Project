const db = require('../config/db');
const { resetDatabase } = require('./helpers/testDb');
const { app, request, loginAs, auth } = require('./helpers/api');

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await db.end();
});

// Seed data: promotion 1 Approved (Corner Café), 2 Pending (Spring Garden Sale), both by Cafe Owner (user 2)

describe('GET /api/promotions (public list)', () => {
    test('shows only approved promotions', async () => {
        const res = await request(app).get('/api/promotions');

        expect(res.status).toBe(200);
        expect(res.body.promotions).toHaveLength(1);
        expect(res.body.promotions[0]).toMatchObject({ business_name: 'Corner Café', status: 'Approved' });
    });

    test('filters by category', async () => {
        const res = await request(app).get('/api/promotions?category=Retail');
        expect(res.body.promotions).toHaveLength(0); // the Retail one is still pending
    });
});

describe('POST /api/promotions', () => {
    test('a business can submit a promotion, and it starts as Pending', async () => {
        const token = await loginAs('business');
        const res = await request(app)
            .post('/api/promotions')
            .set(auth(token))
            .send({ business_name: 'Corner Café Bakery', category: 'Food and drink' });

        expect(res.status).toBe(201);
        const [rows] = await db.query('SELECT * FROM BUSINESS_PROMOTION WHERE id = ?', [res.body.promotionId]);
        expect(rows[0]).toMatchObject({ user_id: 2, status: 'Pending' });
    });

    test('only business accounts can submit promotions', async () => {
        for (const who of ['individual', 'organisation', 'admin']) {
            const token = await loginAs(who);
            const res = await request(app)
                .post('/api/promotions')
                .set(auth(token))
                .send({ business_name: 'Not a business', category: 'Retail' });
            expect(res.status).toBe(403);
        }
    });

    // FB-06: only the business categories from the design document are accepted
    test('rejects a category that is not in the list', async () => {
        const token = await loginAs('business');
        const res = await request(app)
            .post('/api/promotions')
            .set(auth(token))
            .send({ business_name: 'Odd Shop', category: 'Totally Made Up' });
        expect(res.status).toBe(400);
    });

    test('you must be logged in', async () => {
        const res = await request(app).post('/api/promotions').send({ business_name: 'X', category: 'Retail' });
        expect(res.status).toBe(401);
    });

    test('rejects missing fields', async () => {
        const token = await loginAs('business');
        const res = await request(app).post('/api/promotions').set(auth(token)).send({ business_name: 'X' });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/promotions/mine and DELETE', () => {
    test('a business sees all of its own promotions', async () => {
        const token = await loginAs('business');
        const res = await request(app).get('/api/promotions/mine').set(auth(token));

        expect(res.status).toBe(200);
        expect(res.body.promotions.map((p) => p.status).sort()).toEqual(['Approved', 'Pending']);
    });

    test('the owner can delete a promotion, others cannot', async () => {
        const other = await loginAs('individual');
        expect((await request(app).delete('/api/promotions/2').set(auth(other))).status).toBe(404);

        const owner = await loginAs('business');
        expect((await request(app).delete('/api/promotions/2').set(auth(owner))).status).toBe(200);

        const [rows] = await db.query('SELECT id FROM BUSINESS_PROMOTION WHERE id = 2');
        expect(rows).toHaveLength(0);
    });
});
