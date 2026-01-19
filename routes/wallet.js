import express from "express";
import db from "../db.js";

const router = express.Router();

// GET /api/wallet/:userId
router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  try {
    const result = await db.query(
      `SELECT id, user_id, balance, created_at
       FROM wallets
       WHERE user_id = $1`,
      [userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json({ wallet: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/wallet/:userId/transactions
router.get("/:userId/transactions", async (req, res) => {
  const userId = Number(req.params.userId);

  try {
    const result = await db.query(
      `SELECT
         t.id, t.from_user_id, t.to_user_id, t.amount, t.description, t.created_at,
         json_build_object(
           'id', fu.id, 'username', fu.username, 'display_name', fp.display_name, 'avatar_url', fp.avatar_url
         ) AS from_user,
         json_build_object(
           'id', tu.id, 'username', tu.username, 'display_name', tp.display_name, 'avatar_url', tp.avatar_url
         ) AS to_user
       FROM transactions t
       JOIN users fu ON fu.id = t.from_user_id
       JOIN profiles fp ON fp.user_id = fu.id
       JOIN users tu ON tu.id = t.to_user_id
       JOIN profiles tp ON tp.user_id = tu.id
       WHERE t.from_user_id = $1 OR t.to_user_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );

    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/wallet/transfer
// body: { from_user_id, to_user_id, amount, description? }
router.post("/transfer", async (req, res) => {
  const fromUserId = Number(req.body.from_user_id);
  const toUserId = Number(req.body.to_user_id);
  const amount = Number(req.body.amount);
  const description = req.body.description || null;

  if (!fromUserId || !toUserId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid transfer data" });
  }
  if (fromUserId === toUserId) {
    return res
      .status(400)
      .json({ message: "Cannot transfer to the same user" });
  }

  try {
    await db.query("BEGIN");

    // lock both wallets
    const fromWallet = await db.query(
      `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [fromUserId],
    );
    const toWallet = await db.query(
      `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [toUserId],
    );

    if (!fromWallet.rows.length || !toWallet.rows.length) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (fromWallet.rows[0].balance < amount) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Insufficient balance" });
    }

    await db.query(
      `UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`,
      [amount, fromUserId],
    );
    await db.query(
      `UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`,
      [amount, toUserId],
    );

    const tx = await db.query(
      `INSERT INTO transactions (from_user_id, to_user_id, amount, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, from_user_id, to_user_id, amount, description, created_at`,
      [fromUserId, toUserId, amount, description],
    );

    await db.query("COMMIT");

    res.status(201).json({ transaction: tx.rows[0] });
  } catch (err) {
    await db.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  }
});

export default router;
