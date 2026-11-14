const db = require('../config/db');
const { app, request } = require('./helpers/api');

afterAll(async () => {
    await db.end();
});

// The single page app: every page address returns the same index.html,
// and the frontend router decides what to show.

describe('single page app routing', () => {
    test.each(['/', '/login', '/register', '/dashboard', '/admin', '/causes/1', '/some/unknown/page'])(
        '%s returns the app shell',
        async (url) => {
            const res = await request(app).get(url);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/html/);
            expect(res.text).toContain('<main id="app"');
            expect(res.text).toContain('/js/main.js');
        }
    );

    test('real files are served as themselves', async () => {
        const js = await request(app).get('/js/router.js');
        expect(js.status).toBe(200);
        expect(js.headers['content-type']).toMatch(/javascript/);

        const css = await request(app).get('/css/style.css');
        expect(css.status).toBe(200);
        expect(css.headers['content-type']).toMatch(/css/);
    });

    test('a missing file is a real 404, not the app shell', async () => {
        const res = await request(app).get('/js/does-not-exist.js');
        expect(res.status).toBe(404);
        expect(res.text).not.toContain('<main id="app"');
    });

    test('unknown API routes still return JSON 404', async () => {
        const res = await request(app).get('/api/nothing-here');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Not found');
    });

    test('POST to a page address is not answered with the app', async () => {
        const res = await request(app).post('/dashboard').send({});
        expect(res.status).toBe(404);
    });
});
