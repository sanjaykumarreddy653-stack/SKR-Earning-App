const Database = require("better-sqlite3");

const db = new Database("../database/skr_earning.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS typing_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_text TEXT NOT NULL,
    reward REAL NOT NULL DEFAULT 2,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS completed_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    reward REAL NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(task_id) REFERENCES typing_tasks(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username)
    VALUES (?)
`);

const insertTask = db.prepare(`
    INSERT INTO typing_tasks (task_text, reward)
    SELECT ?, 2
    WHERE NOT EXISTS (
        SELECT 1 FROM typing_tasks WHERE task_text = ?
    )
`);

insertUser.run("demo");

const tasks = [
    "Good communication helps people understand each other clearly.\nPractice typing carefully and maintain accurate spelling.\nComplete every task with patience and attention.",

    "Technology can make everyday activities faster and easier.\nLearning new skills requires regular practice.\nConsistent effort can improve your performance.",

    "Reading regularly can improve vocabulary and knowledge.\nTyping accurately is useful for many digital tasks.\nFocus on the text before submitting your work."
];

for (const task of tasks) {
    insertTask.run(task, task);
}

console.log("SKR Earning database initialized.");
db.close();
