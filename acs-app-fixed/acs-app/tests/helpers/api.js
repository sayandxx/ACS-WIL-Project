const request = require('supertest');
const app = require('../../app');

// Seed accounts from database/schema.sql (all use the same test password)
const SEED_PASSWORD = 'Password123!';
const SEED = {
    individual: 'jane.citizen@example.com',   // user 1
    business: 'cafe.owner@example.com',       // user 2
    organisation: 'greenteam@example.org',    // user 3
    admin: 'admin.test@example.com',          // user 4
};

// Logs in and returns the token
async function loginAs(who) {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: SEED[who], password: SEED_PASSWORD });
    if (res.status !== 200) throw new Error(`Could not log in as ${who}: ${res.status}`);
    return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, loginAs, auth, SEED, SEED_PASSWORD };
