import express from "express";
import db from "../../db.js";
import adminAuth from "../../middleware/adminAuth.js";

const router = express.Router();

function toInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/admin/communities
 * Headers: x-role: admin
 * Query: limit, offset
 * Response: { communities: [...] }
 *
 * Each community row shape matches what your table needs:
 * { id, name, creator_name, members_count, status, created_at }
 */
router.get("/", adminAuth, async (req, res) => {
  const limit = toInt(req.query.limit) ?? 50;
  const offset = toInt(req.query.offset) ?? 0;

  try {
    const q = `
      SELECT
        c.id,
        c.name,
        c.status,
        c.created_at,
        COALESCE(cm.members_count, 0)::int AS members_count,
        COALESCE(p.display_name, u.username) AS creator_name
      FROM communities c
      JOIN users u ON u.id = c.creator_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN (
        SELECT community_id, COUNT(*)::int AS members_count
        FROM community_members
        GROUP BY community_id
      ) cm ON cm.community_id = c.id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await db.query(q, [limit, offset]);
    return res.json({ communities: result.rows });
  } catch (err) {
    console.error("Admin communities list error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/admin/communities/:id/status
 * Headers: x-role: admin
 * Body: { status: 'active' | 'locked' | 'disabled' }
 *
 * Used for Lock/Unlock (and optionally Disable).
 */
router.patch("/:id/status", adminAuth, async (req, res) => {
  const communityId = toInt(req.params.id);
  const { status } = req.body || {};
  console.log(req);

  const allowed = new Set(["active", "locked", "disabled"]);
  if (!communityId)
    return res.status(400).json({ message: "Invalid community id" });
  if (!allowed.has(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Use: active | locked | disabled" });
  }

  try {
    const updateQ = `
      UPDATE communities
      SET status = $1
      WHERE id = $2
      RETURNING id, name, status, created_at;
    `;
    const updated = await db.query(updateQ, [status, communityId]);

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Community not found" });
    }

    return res.json({ community: updated.rows[0] });
  } catch (err) {
    console.error("Admin community status update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
