require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("../backend/db");

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const ADMIN_KEY = process.env.SKR_ADMIN_KEY;

function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];

  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

app.get("/api/withdrawals", requireAdmin, (req, res) => {
  const withdrawals = db.prepare(`
    SELECT
      withdrawals.id,
      withdrawals.user_id,
      users.username,
      withdrawals.amount,
      withdrawals.upi_id,
      withdrawals.status,
      withdrawals.created_at,
      withdrawals.processed_at
    FROM withdrawals
    JOIN users ON users.id = withdrawals.user_id
    ORDER BY withdrawals.id DESC
  `).all();

  res.json({ withdrawals });
});

app.post("/api/withdrawals/:id/status", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "");

  const allowed = ["processing", "paid", "rejected"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: "Invalid withdrawal status."
    });
  }

  const withdrawal = db.prepare(`
    SELECT *
    FROM withdrawals
    WHERE id = ?
  `).get(id);

  if (!withdrawal) {
    return res.status(404).json({
      error: "Withdrawal not found."
    });
  }

  if (withdrawal.status === "paid") {
    return res.status(400).json({
      error: "Withdrawal is already marked paid."
    });
  }

  if (withdrawal.status === "rejected") {
    return res.status(400).json({
      error: "Withdrawal has already been rejected."
    });
  }

  if (status === "rejected" && withdrawal.status !== "rejected") {
    db.prepare(`
      UPDATE users
      SET balance = balance + ?
      WHERE id = ?
    `).run(withdrawal.amount, withdrawal.user_id);

    db.prepare(`
      INSERT INTO transactions
        (user_id, type, amount, description)
      VALUES (?, 'withdrawal_refund', ?, ?)
    `).run(
      withdrawal.user_id,
      withdrawal.amount,
      `Refund for rejected withdrawal #${withdrawal.id}`
    );
  }

  db.prepare(`
    UPDATE withdrawals
    SET
      status = ?,
      processed_at = CASE
        WHEN ? IN ('paid', 'rejected')
        THEN CURRENT_TIMESTAMP
        ELSE processed_at
      END
    WHERE id = ?
  `).run(status, status, id);

  res.json({
    success: true,
    id,
    status
  });
});

app.listen(PORT, () => {
  console.log(`SKR Admin running at http://localhost:${PORT}`);
});
