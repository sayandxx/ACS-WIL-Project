module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/helpers/loadTestEnv.js'],
    globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
    // Tests share one database, so run test files one at a time
    maxWorkers: 1,
};
