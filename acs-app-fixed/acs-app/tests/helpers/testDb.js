const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Builds the test database from database/schema.sql, swapping in the test DB name.
async function resetDatabase() {
    const dbName = process.env.DB_NAME;
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8').replace(/\bacs_app\b/g, dbName);

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true,
    });
    try {
        await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await conn.query(schema);
    } finally {
        await conn.end();
    }
}

module.exports = { resetDatabase };
