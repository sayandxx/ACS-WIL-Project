// Runs once before all tests: make sure the test database exists and is fresh.
module.exports = async () => {
    require('./loadTestEnv');
    const { resetDatabase } = require('./testDb');
    await resetDatabase();
};
