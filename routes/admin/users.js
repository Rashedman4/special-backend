import express from "express";
import db from "../../db.js";
import adminAuth from "../../middleware/adminAuth.js";

const router = express.Router();

function toInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/admin/users
 * Headers: x-role: admin
 * Query: limit, offset
 * Response: { users: [...] }
 */
router.get("/", adminAuth, async (req, res) => {
  const limit = toInt(req.query.limit) ?? 50;
  const offset = toInt(req.query.offset) ?? 0;

  try {
    const q = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.created_at,
        p.display_name,
        p.avatar_url
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await db.query(q, [limit, offset]);

    return res.json({ users: result.rows });
  } catch (err) {
    console.error("Admin users list error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Headers: x-role: admin
 *
 * NOTE about your schema:
 * - users is referenced by transactions with NO ON DELETE CASCADE
 * - so hard delete requires removing dependent transactions first.
 */
router.delete("/:id", adminAuth, async (req, res) => {
  const userId = toInt(req.params.id);
  if (!userId) return res.status(400).json({ message: "Invalid user id" });

  try {
    const userQ = `SELECT id, role FROM users WHERE id = $1;`;
    const userR = await db.query(userQ, [userId]);
    if (!userR.rows.length)
      return res.status(404).json({ message: "User not found" });

    if (userR.rows[0].role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin accounts" });
    }

    await db.query("BEGIN");

    await db.query(
      `DELETE FROM transactions WHERE from_user_id = $1 OR to_user_id = $1;`,
      [userId],
    );

    await db.query(`DELETE FROM users WHERE id = $1;`, [userId]);

    await db.query("COMMIT");
    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    console.error("Admin delete user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
