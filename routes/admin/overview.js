import express from "express";
import db from "../../db.js";
import adminAuth from "../../middleware/adminAuth.js";

const router = express.Router();

function toInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/admin/overview
 * Headers: x-role: admin
 * Response: totals + recent users + recent communities
 */
router.get("/", adminAuth, async (req, res) => {
  const limitUsers = toInt(req.query.users_limit) ?? 3;
  const limitCommunities = toInt(req.query.communities_limit) ?? 3;

  try {
    // 1) Totals in one round-trip
    const usersCountQ = `SELECT COUNT(*)::int AS "totalUsers" FROM users;`;
    const postsCountQ = `SELECT COUNT(*)::int AS "totalPosts" FROM posts;`;
    const communitiesCountQ = `SELECT COUNT(*)::int AS "totalCommunities"
                               FROM communities
                               WHERE status = 'active';`;
    const transactionsCountQ = `SELECT COUNT(*)::int AS "totalTransactions" FROM transactions;`;

    const usersCount = await db.query(usersCountQ);
    const postsCount = await db.query(postsCountQ);
    const communitiesCount = await db.query(communitiesCountQ);
    const transactionsCount = await db.query(transactionsCountQ);

    const totals = {
      totalUsers: usersCount.rows[0].totalUsers,
      totalPosts: postsCount.rows[0].totalPosts,
      totalCommunities: communitiesCount.rows[0].totalCommunities,
      totalTransactions: transactionsCount.rows[0].totalTransactions,
    };

    // 2) Recent users (join profiles to get display_name)
    const recentUsersQ = `
      SELECT
        u.id,
        u.username,
        p.display_name,
        p.avatar_url,
        u.created_at
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT $1;
    `;
    const recentUsersResult = await db.query(recentUsersQ, [limitUsers]);

    // 3) Recent communities + members_count (computed)
    const recentCommunitiesQ = `
      SELECT
        c.id,
        c.name,
        c.created_at,
        c.status,
        COALESCE(cm.members_count, 0)::int AS members_count
      FROM communities c
      LEFT JOIN (
        SELECT community_id, COUNT(*)::int AS members_count
        FROM community_members
        GROUP BY community_id
      ) cm ON cm.community_id = c.id
      ORDER BY c.created_at DESC
      LIMIT $1;
    `;
    const recentCommunitiesResult = await db.query(recentCommunitiesQ, [
      limitCommunities,
    ]);

    return res.json({
      stats: totals,
      recentUsers: recentUsersResult.rows,
      recentCommunities: recentCommunitiesResult.rows,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
