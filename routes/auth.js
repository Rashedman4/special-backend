import express from "express";
import db from "../db.js";

const router = express.Router();

// POST /api/auth/signup
// body: { email, username, display_name, password }
router.post("/signup", async (req, res) => {
  const { email, username, display_name, password } = req.body;

  if (!email || !username || !display_name || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const exists = await db.query(
      "SELECT 1 FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );
    if (exists.rows.length) {
      return res
        .status(400)
        .json({ message: "Email or username already exists" });
    }

    await db.query("BEGIN");

    const createdUser = await db.query(
      `INSERT INTO users (email, username, password, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, username, role, created_at`,
      [email, username, password]
    );

    const userId = createdUser.rows[0].id;

    await db.query(
      `INSERT INTO profiles (user_id, display_name, avatar_url, bio)
       VALUES ($1, $2, NULL, NULL)`,
      [userId, display_name]
    );

    // signup bonus: 100 tokens
    await db.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, 100)`,
      [userId]
    );

    await db.query("COMMIT");

    const fullUser = await db.query(
      `SELECT
         u.id, u.email, u.username, u.role, u.created_at,
         p.display_name, p.avatar_url, p.bio
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    res.status(201).json({ user: fullUser.rows[0] });
  } catch (err) {
    await db.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
// body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      `SELECT
         u.id, u.email, u.username, u.role, u.created_at,
         p.display_name, p.avatar_url, p.bio
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1 AND u.password = $2`,
      [email, password]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
