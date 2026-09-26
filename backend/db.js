const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(
  path.join(__dirname, "..", "database", "skr_earning.db")
);

db.exec("PRAGMA journal_mode = WAL");

module.exports = db;
