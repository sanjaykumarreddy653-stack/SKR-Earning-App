require("dotenv").config({ path: "../backend/.env" });

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

module.exports = {
  pool,

  query(text, params = []) {
    return pool.query(text, params);
  },

  async close() {
    await pool.end();
  }
};
