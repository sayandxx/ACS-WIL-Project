// Loads .env.test BEFORE config/db.js runs, so the app connects to the test database.
process.env.DOTENV_CONFIG_QUIET = 'true';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test'), override: true, quiet: true });

// Safety catch: tests wipe their database, so only allow names ending in "_test"
if (!/_test$/i.test(process.env.DB_NAME || '')) {
    throw new Error(`Refusing to run tests: DB_NAME "${process.env.DB_NAME}" must end with "_test".`);
}

// Tests don't need a real secret, but set one so no warning is printed
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
