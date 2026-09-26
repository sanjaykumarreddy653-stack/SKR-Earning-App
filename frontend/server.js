require("dotenv").config({ path: "../backend/.env" });
const express = require("express");
const { createPayout } = require("./payout-provider");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const db = require("./neon-db");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DAILY_LIMIT = 50;

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

async function getUserFromSession(req) {
  const token = req.cookies.skr_session;

  if (!token) return null;

  const result = await db.query(`
    SELECT
      users.id,
      users.username,
      users.balance,
      accounts.password_hash
    FROM accounts
    JOIN users ON users.username = accounts.username
    JOIN sessions ON sessions.user_id = users.id
    WHERE sessions.token = $1
      AND sessions.expires_at > NOW()
  `, [token]);

  return result.rows[0] || null;
}

async function getTodayEarnings(userId) {
  const result = await db.query(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE user_id = $1
      AND type IN ('typing_reward', 'ad_reward')
      AND created_at::date = CURRENT_DATE
  `, [userId]);

  return Number(result.rows[0].total);
}

app.get("/api/status", (req, res) => {
  res.json({
    app: "SKR Earning App",
    status: "online",
    database: "connected"
  });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.trim().length < 3 ||
    password.length < 8
  ) {
    return res.status(400).json({
      error: "Username must contain at least 3 characters and password at least 8 characters."
    });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const existing = await db.query(
      "SELECT id FROM accounts WHERE username = $1",
      [cleanUsername]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Username already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO accounts (username, password_hash)
         VALUES ($1, $2)`,
        [cleanUsername, passwordHash]
      );

      await client.query(
        `INSERT INTO users (username)
         VALUES ($1)`,
        [cleanUsername]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: "Account created successfully."
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Unable to create account."
    });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Username and password are required."
    });
  }

  try {
    const accountResult = await db.query(
      `SELECT * FROM accounts WHERE username = $1`,
      [username.trim().toLowerCase()]
    );

    const account = accountResult.rows[0];

    if (!account) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    const userResult = await db.query(
      `SELECT id FROM users WHERE username = $1`,
      [account.username]
    );

    const user = userResult.rows[0];

    const token = crypto.randomBytes(32).toString("hex");

    await db.query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, token]
    );

    res.cookie("skr_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      username: account.username
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Unable to log in."
    });
  }
});

app.post("/api/logout", async (req, res) => {
  const token = req.cookies.skr_session;

  try {
    if (token) {
      await db.query(
        "DELETE FROM sessions WHERE token = $1",
        [token]
      );
    }

    res.clearCookie("skr_session");

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Unable to log out."
    });
  }
});

app.get("/api/me", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Not logged in."
    });
  }

  res.json({
    username: user.username
  });
});

app.get("/api/transactions", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  try {
    const result = await db.query(`
      SELECT
        id,
        type,
        amount,
        description,
        created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 100
    `, [user.id]);

    res.json({
      transactions: result.rows
    });
  } catch (error) {
    console.error("Transactions error:", error);
    res.status(500).json({
      error: "Unable to load transactions."
    });
  }
});


app.get("/api/task", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  const todayEarnings = await getTodayEarnings(user.id);

  if (todayEarnings >= DAILY_LIMIT) {
    return res.status(403).json({
      error: "You have reached today's ₹50 earning limit."
    });
  }

  try {
    const result = await db.query(`
      SELECT id, task_text, reward
      FROM typing_tasks
      WHERE active = TRUE
      ORDER BY id
      LIMIT 1
    `);

    const task = result.rows[0];

    if (!task) {
      return res.status(404).json({
        error: "No typing tasks are available."
      });
    }

    res.json({
      taskId: task.id,
      text: task.task_text,
      reward: Number(task.reward)
    });
  } catch (error) {
    console.error("Task load error:", error);
    res.status(500).json({
      error: "Unable to load typing task."
    });
  }
});


app.post("/api/task/complete", async (req, res) => {
  console.log("[TASK COMPLETE REQUEST]", req.body);

  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  const { taskId, typedText } = req.body;

  if (!taskId || typeof typedText !== "string") {
    return res.status(400).json({
      error: "Invalid task submission."
    });
  }

  try {
    const taskResult = await db.query(`
      SELECT id, task_text, reward
      FROM typing_tasks
      WHERE id = $1 AND active = TRUE
    `, [Number(taskId)]);

    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({
        error: "Task not found."
      });
    }

    const taskLines = task.task_text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (taskLines.length !== 3) {
      return res.status(500).json({
        error: "This typing task is not configured as a 3-line task."
      });
    }

    if (typedText.trim() !== task.task_text.trim()) {
      return res.status(400).json({
        error: "Typing does not match the task."
      });
    }

    const TYPING_REWARD = 2;
    const todayEarnings = await getTodayEarnings(user.id);

    if (todayEarnings + TYPING_REWARD > DAILY_LIMIT) {
      return res.status(403).json({
        error: "This task would exceed today's ₹50 limit.",
        todayEarnings,
        reward: TYPING_REWARD,
        dailyLimit: DAILY_LIMIT
      });
    }

    const completedResult = await db.query(`
      SELECT id
      FROM completed_tasks
      WHERE user_id = $1
        AND task_id = $2
        AND completed_at::date = CURRENT_DATE
    `, [user.id, task.id]);

    if (completedResult.rows.length > 0) {
      return res.status(400).json({
        error: "This task has already been completed today."
      });
    }

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(`
        INSERT INTO completed_tasks
          (user_id, task_id, reward)
        VALUES ($1, $2, $3)
      `, [user.id, task.id, TYPING_REWARD]);

      await client.query(`
        UPDATE users
        SET balance = balance + $1
        WHERE id = $2
      `, [TYPING_REWARD, user.id]);

      await client.query(`
        INSERT INTO transactions
          (user_id, type, amount, description)
        VALUES ($1, 'typing_reward', $2, $3)
      `, [
        user.id,
        TYPING_REWARD,
        `Typing task #${task.id} completed`
      ]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const updatedResult = await db.query(`
      SELECT balance
      FROM users
      WHERE id = $1
    `, [user.id]);

    const updatedUser = updatedResult.rows[0];

    res.json({
      success: true,
      reward: TYPING_REWARD,
      balance: Number(updatedUser.balance),
      todayEarnings: await getTodayEarnings(user.id),
      dailyLimit: DAILY_LIMIT
    });

  } catch (error) {
    console.error("Typing task completion error:", error);

    res.status(500).json({
      error: "Unable to complete the typing task."
    });
  }
});


app.post("/api/ad-reward/verify", (req, res) => {
  const user = getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  return res.status(501).json({
    error: "Rewarded-ad verification is not configured yet."
  });
});


app.get("/api/admob/ssv", async (req, res) => {
  const {
    transaction_id,
    custom_data,
    reward_amount,
    reward_item
  } = req.query;

  if (!transaction_id || !custom_data) {
    return res.status(400).send("invalid");
  }

  const rewardAmount = Number(reward_amount);

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return res.status(400).send("invalid");
  }

  try {
    const existingResult = await db.query(`
      SELECT id
      FROM ad_reward_events
      WHERE transaction_id = $1
      LIMIT 1
    `, [String(transaction_id)]);

    if (existingResult.rows.length > 0) {
      return res.status(200).send("already_processed");
    }

    const userId = Number(custom_data);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).send("invalid");
    }

    const userResult = await db.query(`
      SELECT id
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).send("user_not_found");
    }

    /*
     * IMPORTANT:
     * The callback is NOT credited yet.
     * Signature verification must be added before production use.
     */

    await db.query(`
      INSERT INTO ad_reward_events
        (user_id, transaction_id, reward_amount, status)
      VALUES ($1, $2, $3, 'pending')
    `, [
      userId,
      String(transaction_id),
      Math.min(rewardAmount, 2)
    ]);

    res.status(202).send("pending_verification");

  } catch (error) {
    console.error("AdMob SSV error:", error);

    res.status(500).send("server_error");
  }
});


app.get("/api/wallet", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  try {
    const result = await db.query(`
      SELECT balance
      FROM users
      WHERE id = $1
    `, [user.id]);

    const currentUser = result.rows[0];

    res.json({
      balance: Number(currentUser.balance),
      todayEarnings: await getTodayEarnings(user.id),
      dailyLimit: DAILY_LIMIT
    });
  } catch (error) {
    console.error("Wallet error:", error);

    res.status(500).json({
      error: "Unable to load wallet."
    });
  }
});


app.post("/api/withdraw", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  const amount = Number(req.body.amount);
  const upiId = String(req.body.upiId || "").trim();

  if (
    !Number.isFinite(amount) ||
    amount < 10 ||
    Math.round(amount * 100) !== amount * 100
  ) {
    return res.status(400).json({
      error: "Withdrawal must be at least ₹10 and use at most 2 decimal places."
    });
  }

  if (!/^[\w.-]+@[\w.-]+$/.test(upiId)) {
    return res.status(400).json({
      error: "Please enter a valid UPI ID."
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(`
      SELECT id, balance
      FROM users
      WHERE id = $1
      FOR UPDATE
    `, [user.id]);

    const currentUser = userResult.rows[0];

    if (!currentUser) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "User not found."
      });
    }

    if (amount > Number(currentUser.balance)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Insufficient wallet balance."
      });
    }

    const pendingResult = await client.query(`
      SELECT id
      FROM withdrawals
      WHERE user_id = $1
        AND status = 'pending'
      LIMIT 1
    `, [user.id]);

    if (pendingResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "You already have a pending withdrawal."
      });
    }

    const withdrawalResult = await client.query(`
      INSERT INTO withdrawals
        (user_id, amount, upi_id, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `, [user.id, amount, upiId]);

    const withdrawalId = withdrawalResult.rows[0].id;

    await client.query(`
      UPDATE users
      SET balance = balance - $1
      WHERE id = $2
    `, [amount, user.id]);

    await client.query(`
      INSERT INTO transactions
        (user_id, type, amount, description)
      VALUES ($1, 'withdrawal', $2, $3)
    `, [
      user.id,
      -amount,
      `Withdrawal request #${withdrawalId}`
    ]);

    await client.query("COMMIT");

    res.json({
      success: true,
      withdrawalId,
      amount,
      status: "pending",
      message: "Withdrawal request submitted."
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Withdrawal transaction failed:", error);

    res.status(500).json({
      error: "Unable to create withdrawal request."
    });
  } finally {
    client.release();
  }
});


app.post("/api/withdrawals/:id/process", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Invalid withdrawal ID."
    });
  }

  try {
    const result = await db.query(`
      SELECT
        id,
        user_id,
        amount,
        upi_id,
        status,
        provider,
        provider_payout_id,
        provider_status
      FROM withdrawals
      WHERE id = $1
        AND user_id = $2
    `, [id, user.id]);

    const withdrawal = result.rows[0];

    if (!withdrawal) {
      return res.status(404).json({
        error: "Withdrawal not found."
      });
    }

    if (withdrawal.provider_payout_id) {
      return res.json({
        success: true,
        withdrawalId: withdrawal.id,
        provider: withdrawal.provider,
        payoutId: withdrawal.provider_payout_id,
        providerStatus: withdrawal.provider_status
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        error: `Withdrawal is already ${withdrawal.status}.`
      });
    }

    const payout = await createPayout({
      withdrawalId: withdrawal.id,
      amount: Number(withdrawal.amount),
      upiId: withdrawal.upi_id
    });

    await db.query(`
      UPDATE withdrawals
      SET
        status = 'processing',
        provider = $1,
        provider_payout_id = $2,
        provider_status = $3
      WHERE id = $4
        AND provider_payout_id IS NULL
    `, [
      payout.provider,
      payout.payoutId,
      payout.status,
      withdrawal.id
    ]);

    res.json({
      success: true,
      withdrawalId: withdrawal.id,
      provider: payout.provider,
      payoutId: payout.payoutId,
      status: "processing"
    });

  } catch (error) {
    console.error("Payout processing failed:", error);

    res.status(502).json({
      error: "Payout provider request failed."
    });
  }
});


app.get("/api/withdrawals", async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      error: "Please log in."
    });
  }

  try {
    const result = await db.query(`
      SELECT
        id,
        amount,
        upi_id,
        status,
        created_at,
        processed_at
      FROM withdrawals
      WHERE user_id = $1
      ORDER BY id DESC
    `, [user.id]);

    res.json({
      withdrawals: result.rows
    });
  } catch (error) {
    console.error("Withdrawal history error:", error);

    res.status(500).json({
      error: "Unable to load withdrawals."
    });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`SKR Earning App running at http://localhost:${PORT}`);
});
