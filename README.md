# Social Awareness Web Application - Backend

## Prerequisites
- Node.js installed
- MySQL Server installed and running on port 3306

## Setup Instructions
1. Open this folder in VS Code.
2. Open a terminal and run `npm install` to download all dependencies.
3. Open MySQL Workbench and run the `database/schema.sql` file to create the database and seed the test data.
4. Duplicate the `.env.example` file and rename the copy to exactly `.env`.
5. Open your new `.env` file and update `DB_PASSWORD` to match your local MySQL root password.
6. Run `node server.js` to start the backend.