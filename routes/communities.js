import express from "express";
import db from "../db.js";

const router = express.Router();

/**
 * GET /api/communities?user_id=#
 * Returns: [{id,name,description,min_credits_required,members_count,is_member}]
 */
router.get("/", async (req, res) => {
  const userId = Number(req.query.user_id || 0);

  try {
    const params = [];
    let isMemberSql = "false AS is_member";

    if (userId > 0) {
      params.push(userId);
      isMemberSql = `
        EXISTS (
          SELECT 1 FROM community_members cm2
          WHERE cm2.community_id = c.id AND cm2.user_id = $1
        ) AS is_member
      `;
    }

    const sql = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.creator_id,
        c.min_credits_required,
        c.status,
        c.created_at,
        COUNT(cm.user_id)::int AS members_count,
        ${isMemberSql}
      FROM communities c
      LEFT JOIN community_members cm ON cm.community_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /communities error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/communities/:id?user_id=#
 * Returns a single community with members_count + is_member
 */
router.get("/:id", async (req, res) => {
  const communityId = Number(req.params.id);
  const userId = Number(req.query.user_id || 0);

  try {
    const params = [communityId];
    let isMemberSql = "false AS is_member";

    if (userId > 0) {
      params.push(userId);
      isMemberSql = `
        EXISTS (
          SELECT 1 FROM community_members cm2
          WHERE cm2.community_id = c.id AND cm2.user_id = $2
        ) AS is_member
      `;
    }

    const sql = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.creator_id,
        c.min_credits_required,
        c.status,
        c.created_at,
        COUNT(cm.user_id)::int AS members_count,
        ${isMemberSql}
      FROM communities c
      LEFT JOIN community_members cm ON cm.community_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const result = await db.query(sql, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Community not found" });
    }

    res.json({ community: result.rows[0] });
  } catch (err) {
    console.error("GET /communities/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/communities
 * Body: { creator_id, name, description, min_credits_required }
 */
router.post("/", async (req, res) => {
  const creatorId = Number(req.body.creator_id);
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim();
  const minCredits = Number(req.body.min_credits_required || 0);

  if (!creatorId || !name) {
    return res
      .status(400)
      .json({ message: "creator_id and name are required" });
  }
  if (!Number.isInteger(minCredits) || minCredits < 0) {
    return res
      .status(400)
      .json({ message: "min_credits_required must be >= 0" });
  }

  try {
    await db.query("BEGIN");

    const created = await db.query(
      `
      INSERT INTO communities (name, description, creator_id, min_credits_required)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, creator_id, min_credits_required, status, created_at
      `,
      [name, description || null, creatorId, minCredits],
    );

    const community = created.rows[0];

    // Creator becomes owner + member
    await db.query(
      `
      INSERT INTO community_members (community_id, user_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (community_id, user_id) DO NOTHING
      `,
      [community.id, creatorId],
    );

    await db.query("COMMIT");

    res.status(201).json({
      ...community,
      members_count: 1,
      is_member: true,
    });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("POST /communities error:", err);

    if (
      String(err.message || "")
        .toLowerCase()
        .includes("unique")
    ) {
      return res.status(409).json({ message: "Community name already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/communities/:id/join
 * Body: { user_id }
 */
router.post("/:id/join", async (req, res) => {
  const communityId = Number(req.params.id);
  const userId = Number(req.body.user_id);

  if (!communityId || !userId) {
    return res
      .status(400)
      .json({ message: "community id and user_id are required" });
  }

  try {
    const comm = await db.query(
      `SELECT id, min_credits_required, status FROM communities WHERE id = $1`,
      [communityId],
    );
    if (comm.rowCount === 0)
      return res.status(404).json({ message: "Community not found" });
    if (comm.rows[0].status !== "active")
      return res.status(403).json({ message: "Community is not active" });

    const minCredits = Number(comm.rows[0].min_credits_required || 0);

    const wallet = await db.query(
      `SELECT balance FROM wallets WHERE user_id = $1`,
      [userId],
    );
    if (wallet.rowCount === 0)
      return res.status(404).json({ message: "Wallet not found" });

    const balance = Number(wallet.rows[0].balance || 0);
    if (minCredits > 0 && balance < minCredits) {
      return res.status(400).json({
        message: `Insufficient credits. Need at least ${minCredits}, current balance ${balance}.`,
      });
    }

    await db.query(
      `
      INSERT INTO community_members (community_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (community_id, user_id) DO NOTHING
      `,
      [communityId, userId],
    );

    res.json({ message: "Joined community" });
  } catch (err) {
    console.error("POST /communities/:id/join error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/communities/:id/leave
 * Body: { user_id }
 */
router.post("/:id/leave", async (req, res) => {
  const communityId = Number(req.params.id);
  const userId = Number(req.body.user_id);

  if (!communityId || !userId) {
    return res
      .status(400)
      .json({ message: "community id and user_id are required" });
  }

  try {
    const roleRes = await db.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (roleRes.rowCount === 0) {
      return res.json({ message: "Not a member" });
    }

    if (roleRes.rows[0].role === "owner") {
      return res
        .status(400)
        .json({ message: "Owner cannot leave the community" });
    }

    await db.query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    res.json({ message: "Left community" });
  } catch (err) {
    console.error("POST /communities/:id/leave error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
