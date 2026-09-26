const db = require("./db");

console.log("=== SKR EARNING DATABASE CHECK ===");

const users = db.prepare(`
  SELECT id, username, balance
  FROM users
  ORDER BY id
`).all();

console.table(users);

const tasks = db.prepare(`
  SELECT
    id,
    reward,
    active
  FROM typing_tasks
  ORDER BY id
`).all();

console.log("\n=== ACTIVE TYPING TASKS ===");
console.table(tasks);

const withdrawals = db.prepare(`
  SELECT
    id,
    user_id,
    amount,
    status
  FROM withdrawals
  ORDER BY id DESC
  LIMIT 10
`).all();

console.log("\n=== RECENT WITHDRAWALS ===");
console.table(withdrawals);

const rewards = db.prepare(`
  SELECT
    user_id,
    SUM(amount) AS total
  FROM transactions
  WHERE date(created_at) = date('now', 'localtime')
    AND type IN ('typing_reward', 'ad_reward')
  GROUP BY user_id
`).all();

console.log("\n=== TODAY'S EARNINGS ===");
console.table(rewards);

db.close();

console.log("\nDatabase verification complete.");
