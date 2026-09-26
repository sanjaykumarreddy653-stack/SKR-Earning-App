const db = require("./db");

db.exec(`
CREATE TABLE IF NOT EXISTS ad_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    reward_amount REAL NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

console.log("Ad rewards table ready.");
db.close();
