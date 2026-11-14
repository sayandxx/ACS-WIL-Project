const db = require('../config/db');
const { resetDatabase } = require('./helpers/testDb');
const { app, request, loginAs, auth, SEED, SEED_PASSWORD } = require('./helpers/api');
const { resetLoginLimits, MAX_FAILURES } = require('../middleware/loginLimiter');

// Each test starts from the same clean, seeded database
beforeEach(async () => {
    await resetDatabase();
    resetLoginLimits();
});

afterAll(async () => {
    await db.end(); // close the pool so Jest can exit
});

const validUser = {
    full_name: 'Test User',
    email: 'test.user@example.com',
    password: 'Sunny-River-42',
    account_type: 'Individual',
};

describe('server', () => {
    test('health check responds', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('serves the frontend home page', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
    });

    test('unknown API route returns JSON 404', async () => {
        const res = await request(app).get('/api/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Not found');
    });

    test('broken JSON body returns 400, not a crash', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email": ');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/register', () => {
    test('creates a user and stores a hashed password', async () => {
        const res = await request(app).post('/api/auth/register').send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Account created successfully');
        expect(res.body.userId).toEqual(expect.any(Number));

        const [rows] = await db.query('SELECT * FROM USER WHERE id = ?', [res.body.userId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].email).toBe(validUser.email);
        expect(rows[0].account_type).toBe('Individual');
        expect(rows[0].password_hash).not.toBe(validUser.password);
        expect(rows[0].password_hash).toMatch(/^\$2b\$10\$/); // bcrypt hash
    });

    test('saves the email in lowercase and trims spaces', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, email: '  Test.User@Example.COM ', full_name: '  Test User  ' });

        expect(res.status).toBe(201);
        const [rows] = await db.query('SELECT email, full_name FROM USER WHERE id = ?', [res.body.userId]);
        expect(rows[0].email).toBe('test.user@example.com');
        expect(rows[0].full_name).toBe('Test User');
    });

    test.each(['full_name', 'email', 'password', 'account_type'])(
        'rejects a missing %s with 400',
        async (field) => {
            const body = { ...validUser };
            delete body[field];

            const res = await request(app).post('/api/auth/register').send(body);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Please complete all required fields.');
        }
    );

    test('rejects a badly formatted email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, email: 'not-an-email' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Please enter a valid email address.');
    });

    test('rejects a password shorter than 8 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Password must contain at least 8 characters.');
    });

    // FB-02: common or too-simple passwords are rejected on the server
    test.each([
        ['password', 'Password must include at least one letter and at least one number or symbol.'],
        ['abcdefghij', 'Password must include at least one letter and at least one number or symbol.'],
        ['12345678', 'Password must include at least one letter and at least one number or symbol.'],
        ['Password123', 'That password is too common. Please choose a different one.'],
        ['QWERTY123', 'That password is too common. Please choose a different one.'],
    ])('rejects the weak password %p', async (password, message) => {
        const res = await request(app).post('/api/auth/register').send({ ...validUser, password });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(message);
        const [rows] = await db.query('SELECT id FROM USER WHERE email = ?', [validUser.email]);
        expect(rows).toHaveLength(0);
    });

    test('rejects a password longer than 72 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, password: `a1${'x'.repeat(71)}` });
        expect(res.status).toBe(400);
    });

    test('accepts a password with letters and a symbol', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, password: 'correct horse battery!' });
        expect(res.status).toBe(201);
    });

    test('rejects an email that already exists (seed data) with 409', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, email: SEED.individual });

        expect(res.status).toBe(409);
    });

    test('duplicate check ignores letter case', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, email: 'JANE.Citizen@Example.com' });

        expect(res.status).toBe(409);
    });

    test('does not save a user when validation fails', async () => {
        await request(app).post('/api/auth/register').send({ ...validUser, password: 'short' });

        const [rows] = await db.query('SELECT id FROM USER WHERE email = ?', [validUser.email]);
        expect(rows).toHaveLength(0);
    });

    test('rejects an account type that is not in the list with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, account_type: 'SuperUser' });

        expect(res.status).toBe(400);
    });

    test('people cannot sign themselves up as Administrator', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, account_type: 'Administrator' });

        expect(res.status).toBe(400);
        const [rows] = await db.query('SELECT id FROM USER WHERE email = ?', [validUser.email]);
        expect(rows).toHaveLength(0);
    });
});

describe('POST /api/auth/login', () => {
    // Register a fresh user for each login test
    beforeEach(async () => {
        await request(app).post('/api/auth/register').send(validUser);
    });

    test('logs in with the correct password and returns a token', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Logged in successfully');
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.user).toMatchObject({
            full_name: validUser.full_name,
            email: validUser.email,
            account_type: 'Individual',
        });
    });

    test('email is not case sensitive at login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'TEST.USER@example.com', password: validUser.password });

        expect(res.status).toBe(200);
    });

    test('seed accounts can log in with the documented test password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: SEED.admin, password: SEED_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user.account_type).toBe('Administrator');
    });

    test('never returns the password hash', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    test('rejects a wrong password with 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: 'WrongPassword1' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid email or password');
    });

    test('unknown email gets the same 401 message (no account guessing)', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: 'Password123' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid email or password');
    });

    test.each([
        [{ password: 'Password123' }],
        [{ email: 'test.user@example.com' }],
    ])('rejects a missing field with 400 (%o)', async (body) => {
        const res = await request(app).post('/api/auth/login').send(body);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Please complete both fields.');
    });

    test('full flow: register a new user, then log in as them', async () => {
        const newUser = { ...validUser, email: 'cafe.two@example.com', account_type: 'Business' };

        const reg = await request(app).post('/api/auth/register').send(newUser);
        expect(reg.status).toBe(201);

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: newUser.email, password: newUser.password });

        expect(login.status).toBe(200);
        expect(login.body.user.id).toBe(reg.body.userId);
        expect(login.body.user.account_type).toBe('Business');
    });
});

describe('GET /api/auth/me', () => {
    test('returns the logged-in user', async () => {
        const token = await loginAs('organisation');
        const res = await request(app).get('/api/auth/me').set(auth(token));

        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ id: 3, full_name: 'Green Team', account_type: 'Organisation' });
        expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    test('rejects a request with no token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    test('rejects a fake token', async () => {
        const res = await request(app).get('/api/auth/me').set(auth('not.a.real.token'));
        expect(res.status).toBe(401);
    });
});

// FB-01: logging out must stop the token working on the server, not just in the browser
describe('POST /api/auth/logout', () => {
    test('the token stops working after logout', async () => {
        const token = await loginAs('individual');
        expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);

        const out = await request(app).post('/api/auth/logout').set(auth(token));
        expect(out.status).toBe(200);

        const me = await request(app).get('/api/auth/me').set(auth(token));
        expect(me.status).toBe(401);
        const mine = await request(app).get('/api/campaigns/mine').set(auth(token));
        expect(mine.status).toBe(401);
    });

    test('logging in again afterwards gives a new token that works', async () => {
        const oldToken = await loginAs('individual');
        await request(app).post('/api/auth/logout').set(auth(oldToken));

        const newToken = await loginAs('individual');
        expect((await request(app).get('/api/auth/me').set(auth(newToken))).status).toBe(200);
        expect((await request(app).get('/api/auth/me').set(auth(oldToken))).status).toBe(401);
    });

    test('an admin token is also revoked for admin routes', async () => {
        const token = await loginAs('admin');
        await request(app).post('/api/auth/logout').set(auth(token));
        const res = await request(app).get('/api/admin/stats').set(auth(token));
        expect(res.status).toBe(401);
    });

    test("one user logging out doesn't affect another user", async () => {
        const jane = await loginAs('individual');
        const green = await loginAs('organisation');
        await request(app).post('/api/auth/logout').set(auth(jane));
        expect((await request(app).get('/api/auth/me').set(auth(green))).status).toBe(200);
    });

    test('needs a valid token', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(401);
    });
});

// FB-05: too many wrong passwords are slowed down
describe('login attempt limit', () => {
    const wrong = { email: SEED.individual, password: 'WrongPassword1' };

    test(`after ${MAX_FAILURES} wrong passwords, even the right one is blocked for a while`, async () => {
        for (let i = 0; i < MAX_FAILURES; i++) {
            const res = await request(app).post('/api/auth/login').send(wrong);
            expect(res.status).toBe(401);
        }
        const blocked = await request(app)
            .post('/api/auth/login')
            .send({ email: SEED.individual, password: SEED_PASSWORD });
        expect(blocked.status).toBe(429);
        expect(blocked.headers['retry-after']).toEqual(expect.any(String));
        expect(blocked.body.token).toBeUndefined();
    });

    test('the limit is per account, so other accounts can still log in', async () => {
        for (let i = 0; i < MAX_FAILURES; i++) {
            await request(app).post('/api/auth/login').send(wrong);
        }
        const res = await request(app).post('/api/auth/login').send({ email: SEED.admin, password: SEED_PASSWORD });
        expect(res.status).toBe(200);
    });

    test('email case does not get around the limit', async () => {
        for (let i = 0; i < MAX_FAILURES; i++) {
            await request(app).post('/api/auth/login').send(wrong);
        }
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: SEED.individual.toUpperCase(), password: SEED_PASSWORD });
        expect(res.status).toBe(429);
    });

    test('a successful login resets the count', async () => {
        for (let i = 0; i < MAX_FAILURES - 1; i++) {
            await request(app).post('/api/auth/login').send(wrong);
        }
        const ok = await request(app).post('/api/auth/login').send({ email: SEED.individual, password: SEED_PASSWORD });
        expect(ok.status).toBe(200);

        // the count starts again from zero
        for (let i = 0; i < MAX_FAILURES - 1; i++) {
            const res = await request(app).post('/api/auth/login').send(wrong);
            expect(res.status).toBe(401);
        }
    });
});
