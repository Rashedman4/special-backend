import express from "express";
import db from "../db.js";

const router = express.Router();

// GET /api/users?exclude_id=1
router.get("/", async (req, res) => {
  const excludeId = req.query.exclude_id ? Number(req.query.exclude_id) : null;

  try {
    const q = excludeId
      ? `SELECT u.id, u.username, p.display_name, p.avatar_url
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.id <> $1
         ORDER BY u.id`
      : `SELECT u.id, u.username, p.display_name, p.avatar_url
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         ORDER BY u.id`;

    const params = excludeId ? [excludeId] : [];
    const result = await db.query(q, params);

    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/username/:username
router.get("/username/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await db.query(
      `SELECT
         u.id, u.email, u.username, u.role, u.created_at,
         p.display_name, p.avatar_url, p.bio,
         w.balance AS wallet_balance,
         (SELECT COUNT(*)::int FROM posts po WHERE po.author_id = u.id) AS posts_count
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.username = $1`,
      [username]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/profile
// header: x-user-id (simple ownership check)
// body: { display_name, bio, avatar_url }
router.put("/:id/profile", async (req, res) => {
  const id = Number(req.params.id);
  const headerUserId = Number(req.headers["x-user-id"]);
  const { display_name, bio, avatar_url } = req.body;

  if (!headerUserId || headerUserId !== id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  if (!display_name) {
    return res.status(400).json({ message: "display_name is required" });
  }

  try {
    await db.query(
      `UPDATE profiles
       SET display_name = $1, bio = $2, avatar_url = $3
       WHERE user_id = $4`,
      [display_name, bio || null, avatar_url || null, id]
    );

    const result = await db.query(
      `SELECT
         u.id, u.email, u.username, u.role, u.created_at,
         p.display_name, p.avatar_url, p.bio
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
