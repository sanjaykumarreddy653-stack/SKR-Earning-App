const path = require("path");
const dotenv = require("dotenv");

// Local Termux development: load ../backend/.env if it exists.
// Render: environment variables are already provided by the platform.
dotenv.config({
  path: path.join(__dirname, "../backend/.env")
});

const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: DATABASE_URL
});

module.exports = pool;
