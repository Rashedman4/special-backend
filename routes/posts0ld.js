// routes/posts.js
import express from "express";
import db from "../db.js";

const router = express.Router();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Community helpers (safe: only enforce when community_id exists)
 */
const requireCommunityMemberIfNeeded = async (communityId, userId) => {
  if (!communityId) return; // global/public post
  const mem = await db.query(
    `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  if (!mem.rows.length) {
    const err = new Error("Join the community first");
    err.status = 403;
    throw err;
  }
};

const getPostCommunityId = async (postId) => {
  const r = await db.query(`SELECT community_id FROM posts WHERE id = $1`, [
    postId,
  ]);
  if (!r.rows.length) return null;
  return r.rows[0].community_id;
};

const requireMemberForPostIfNeeded = async (postId, userId) => {
  const communityId = await getPostCommunityId(postId);
  if (!communityId) return;
  await requireCommunityMemberIfNeeded(communityId, userId);
};

// GET /api/posts
// Query:
// - user_id (optional): to compute liked_by_me, user_vote, is_attending
// - author_id (optional): filter posts by author
// - community_id (optional): filter posts by community
// - limit (optional)
router.get("/", async (req, res) => {
  const userId = toInt(req.query.user_id);
  const authorId = toInt(req.query.author_id);
  const communityId = toInt(req.query.community_id);
  const limit = Math.min(toInt(req.query.limit) || 50, 200);

  try {
    const base = await db.query(
      `SELECT
         p.id, p.author_id, p.community_id, p.type, p.content,
         p.likes_count, p.comments_count, p.created_at,
         json_build_object(
           'id', u.id,
           'username', u.username,
           'display_name', pr.display_name,
           'avatar_url', pr.avatar_url
         ) AS profiles,
         pl.question, pl.ends_at,
         ev.title, ev.description, ev.start_date, ev.end_date, ev.location
       FROM posts p
       JOIN users u ON u.id = p.author_id
       JOIN profiles pr ON pr.user_id = u.id
       LEFT JOIN polls pl ON pl.post_id = p.id
       LEFT JOIN events ev ON ev.post_id = p.id
      WHERE ($1::int IS NULL OR p.author_id = $1)
        AND (
          CASE 
            WHEN $3::int IS NULL THEN p.community_id IS NULL
            ELSE p.community_id = $3
          END
        )
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [authorId, limit, communityId]
    );

    const posts = base.rows;
    if (!posts.length) return res.json({ posts: [] });

    const postIds = posts.map((p) => p.id);
    const pollIds = posts.filter((p) => p.type === "poll").map((p) => p.id);
    const eventIds = posts.filter((p) => p.type === "event").map((p) => p.id);

    // liked_by_me (optional)
    const likedByMe = new Map();
    if (userId) {
      const likes = await db.query(
        `SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::int[])`,
        [userId, postIds]
      );
      likes.rows.forEach((r) => likedByMe.set(r.post_id, true));
    }

    // Poll options + votes
    const pollOptionsByPollId = new Map();
    const pollTotalVotes = new Map();
    if (pollIds.length) {
      const opts = await db.query(
        `SELECT
           po.id, po.poll_id, po.text,
           COALESCE(COUNT(pv.user_id), 0)::int AS votes
         FROM poll_options po
         LEFT JOIN poll_votes pv ON pv.option_id = po.id
         WHERE po.poll_id = ANY($1::int[])
         GROUP BY po.id, po.poll_id, po.text
         ORDER BY po.id`,
        [pollIds]
      );

      for (const row of opts.rows) {
        if (!pollOptionsByPollId.has(row.poll_id)) {
          pollOptionsByPollId.set(row.poll_id, []);
          pollTotalVotes.set(row.poll_id, 0);
        }
        pollOptionsByPollId.get(row.poll_id).push({
          id: row.id,
          text: row.text,
          votes: row.votes,
        });
        pollTotalVotes.set(
          row.poll_id,
          pollTotalVotes.get(row.poll_id) + row.votes
        );
      }
    }

    // user_vote (optional)
    const userVoteByPollId = new Map();
    if (userId && pollIds.length) {
      const votes = await db.query(
        `SELECT poll_id, option_id FROM poll_votes WHERE user_id = $1 AND poll_id = ANY($2::int[])`,
        [userId, pollIds]
      );
      votes.rows.forEach((r) => userVoteByPollId.set(r.poll_id, r.option_id));
    }

    // Event attendees
    const attendeesCountByEventId = new Map();
    const isAttendingByEventId = new Map();
    if (eventIds.length) {
      const counts = await db.query(
        `SELECT event_id, COUNT(*)::int AS attendees_count
         FROM event_attendees
         WHERE event_id = ANY($1::int[])
         GROUP BY event_id`,
        [eventIds]
      );
      counts.rows.forEach((r) =>
        attendeesCountByEventId.set(r.event_id, r.attendees_count)
      );

      if (userId) {
        const attending = await db.query(
          `SELECT event_id FROM event_attendees WHERE user_id = $1 AND event_id = ANY($2::int[])`,
          [userId, eventIds]
        );
        attending.rows.forEach((r) =>
          isAttendingByEventId.set(r.event_id, true)
        );
      }
    }

    const shaped = posts.map((p) => {
      const out = {
        id: p.id,
        type: p.type,
        content: p.content,
        created_at: p.created_at,
        likes_count: p.likes_count,
        comments_count: p.comments_count,
        community_id: p.community_id ?? null,
        profiles: p.profiles,
        liked_by_me: !!likedByMe.get(p.id),
      };

      if (p.type === "poll") {
        out.question = p.question;
        out.ends_at = p.ends_at;
        out.options = pollOptionsByPollId.get(p.id) || [];
        out.total_votes = pollTotalVotes.get(p.id) || 0;
        out.user_vote = userVoteByPollId.get(p.id) || null;
      }

      if (p.type === "event") {
        out.title = p.title;
        out.description = p.description;
        out.start_date = p.start_date;
        out.end_date = p.end_date;
        out.location = p.location;
        out.attendees_count = attendeesCountByEventId.get(p.id) || 0;
        out.is_attending = !!isAttendingByEventId.get(p.id);
      }

      return out;
    });

    res.json({ posts: shaped });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/posts
router.post("/", async (req, res) => {
  const authorId = toInt(req.body.author_id);
  const type = (req.body.type || "post").toLowerCase();

  if (!authorId)
    return res.status(400).json({ message: "author_id is required" });
  if (!["post", "poll", "event"].includes(type)) {
    return res.status(400).json({ message: "Invalid post type" });
  }

  // Handle community_id: null/undefined/empty should be null, not 0
  const communityIdRaw = req.body.community_id;
  const communityId =
    communityIdRaw === null ||
    communityIdRaw === undefined ||
    communityIdRaw === "" ||
    communityIdRaw === "null"
      ? null
      : toInt(communityIdRaw);

  // If posting inside a community, require membership
  /*  try {
    await requireCommunityMemberIfNeeded(communityId, authorId);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
 */
  try {
    // Verify user exists and has a profile
    const userCheck = await db.query(
      `SELECT u.id FROM users u 
       JOIN profiles pr ON pr.user_id = u.id 
       WHERE u.id = $1`,
      [authorId]
    );
    if (!userCheck.rows.length) {
      return res.status(400).json({
        message:
          "User not found or profile missing. Please ensure you have a complete profile.",
      });
    }

    await db.query("BEGIN");

    const content = type === "post" ? (req.body.content || "").trim() : null;
    if (type === "post" && !content) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "content is required" });
    }

    const created = await db.query(
      `INSERT INTO posts (author_id, community_id, type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, author_id, community_id, type, content, likes_count, comments_count, created_at`,
      [authorId, communityId, type, content]
    );
    const postId = created.rows[0].id;

    if (type === "poll") {
      const question = (req.body.question || "").trim();
      const durationHours = toInt(req.body.duration_hours) || 24;

      const rawOptions = Array.isArray(req.body.poll_options)
        ? req.body.poll_options
        : Array.isArray(req.body.options)
        ? req.body.options
        : [];

      const opts = rawOptions.map((s) => String(s).trim()).filter(Boolean);

      if (!question || opts.length < 2) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Poll needs a question and at least 2 options" });
      }

      const poll = await db.query(
        `INSERT INTO polls (post_id, question, ends_at)
         VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)
         RETURNING post_id`,
        [postId, question, durationHours]
      );

      for (const text of opts) {
        await db.query(
          `INSERT INTO poll_options (poll_id, text) VALUES ($1, $2)`,
          [postId, text]
        );
      }
    }

    if (type === "event") {
      const title = (req.body.title || "").trim();
      const description = (req.body.description || "").trim() || null;
      const location = (req.body.location || "").trim();
      const startDate = req.body.start_date
        ? new Date(req.body.start_date)
        : null;
      const endDate = req.body.end_date ? new Date(req.body.end_date) : null;

      if (
        !title ||
        !location ||
        !startDate ||
        Number.isNaN(startDate.getTime())
      ) {
        await db.query("ROLLBACK");
        return res.status(400).json({
          message: "Event needs title, location, and valid start_date",
        });
      }

      const end =
        endDate && !Number.isNaN(endDate.getTime())
          ? endDate
          : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO events (post_id, title, description, start_date, end_date, location)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          postId,
          title,
          description,
          startDate.toISOString(),
          end.toISOString(),
          location,
        ]
      );
    }

    await db.query("COMMIT");

    const result = await db.query(
      `SELECT
         p.id, p.type, p.content, p.community_id, p.likes_count, p.comments_count, p.created_at,
         json_build_object(
           'id', u.id,
           'username', u.username,
           'display_name', pr.display_name,
           'avatar_url', pr.avatar_url
         ) AS profiles,
         pl.question, pl.ends_at,
         ev.title, ev.description, ev.start_date, ev.end_date, ev.location
       FROM posts p
       JOIN users u ON u.id = p.author_id
       JOIN profiles pr ON pr.user_id = u.id
       LEFT JOIN polls pl ON pl.post_id = p.id
       LEFT JOIN events ev ON ev.post_id = p.id
       WHERE p.id = $1`,
      [postId]
    );

    if (!result.rows.length) {
      return res.status(500).json({
        message:
          "Failed to retrieve created post. User profile may be missing.",
      });
    }

    const row = result.rows[0];
    const out = {
      id: row.id,
      type: row.type,
      content: row.content,
      created_at: row.created_at,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      community_id: row.community_id ?? null,
      profiles: row.profiles,
      liked_by_me: false,
    };

    if (row.type === "poll") {
      const opts = await db.query(
        `SELECT id, text, 0::int AS votes FROM poll_options WHERE poll_id = $1 ORDER BY id`,
        [row.id]
      );
      out.question = row.question;
      out.ends_at = row.ends_at;
      out.options = opts.rows;
      out.total_votes = 0;
      out.user_vote = null;
    }

    if (row.type === "event") {
      out.title = row.title;
      out.description = row.description;
      out.start_date = row.start_date;
      out.end_date = row.end_date;
      out.location = row.location;
      out.attendees_count = 0;
      out.is_attending = false;
    }

    res.status(201).json({ post: out });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    console.error("POST /api/posts error:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/posts/:id/like (toggle)
router.post("/:id/like", async (req, res) => {
  const postId = toInt(req.params.id);
  const userId = toInt(req.body.user_id);

  if (!postId || !userId)
    return res.status(400).json({ message: "Invalid like data" });

  /*  try {
    await requireMemberForPostIfNeeded(postId, userId);
  } catch (err) {
    return res.status(err.status || 403).json({ message: err.message });
  } */

  try {
    await db.query("BEGIN");

    const exists = await db.query(
      `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    let liked;
    if (exists.rows.length) {
      await db.query(
        `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      );
      await db.query(
        `UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
        [postId]
      );
      liked = false;
    } else {
      await db.query(
        `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
        [postId, userId]
      );
      await db.query(
        `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1`,
        [postId]
      );
      liked = true;
    }

    const updated = await db.query(
      `SELECT likes_count FROM posts WHERE id = $1`,
      [postId]
    );
    await db.query("COMMIT");

    res.json({
      liked_by_me: liked,
      likes_count: updated.rows[0]?.likes_count ?? 0,
    });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/posts/:id/vote
router.post("/:id/vote", async (req, res) => {
  const pollId = toInt(req.params.id);
  const userId = toInt(req.body.user_id);
  const optionId = toInt(req.body.option_id);

  if (!pollId || !userId || !optionId) {
    return res.status(400).json({ message: "Invalid vote data" });
  }

  try {
    const poll = await db.query(
      `SELECT post_id, ends_at FROM polls WHERE post_id = $1`,
      [pollId]
    );
    if (!poll.rows.length)
      return res.status(404).json({ message: "Poll not found" });
    if (poll.rows[0].ends_at && new Date(poll.rows[0].ends_at) < new Date()) {
      return res.status(400).json({ message: "Poll has ended" });
    }

    /*    try {
      await requireMemberForPostIfNeeded(pollId, userId);
    } catch (err) {
      return res.status(err.status || 403).json({ message: err.message });
    } */

    const opt = await db.query(
      `SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2`,
      [optionId, pollId]
    );
    if (!opt.rows.length)
      return res.status(400).json({ message: "Invalid option" });

    const already = await db.query(
      `SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId]
    );
    if (already.rows.length) {
      return res.status(400).json({ message: "Already voted" });
    }

    await db.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)`,
      [pollId, userId, optionId]
    );

    const opts = await db.query(
      `SELECT
         po.id, po.text,
         COALESCE(COUNT(pv.user_id), 0)::int AS votes
       FROM poll_options po
       LEFT JOIN poll_votes pv ON pv.option_id = po.id
       WHERE po.poll_id = $1
       GROUP BY po.id, po.text
       ORDER BY po.id`,
      [pollId]
    );

    const totalVotes = opts.rows.reduce((sum, r) => sum + r.votes, 0);

    // ✅ Fix 2: response format
    res.json({
      user_vote: optionId,
      options: opts.rows,
      total_votes: totalVotes,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/posts/:id/attend (toggle)
router.post("/:id/attend", async (req, res) => {
  const eventId = toInt(req.params.id);
  const userId = toInt(req.body.user_id);

  if (!eventId || !userId) {
    return res.status(400).json({ message: "Invalid attendance data" });
  }

  try {
    const existsEvent = await db.query(
      `SELECT 1 FROM events WHERE post_id = $1`,
      [eventId]
    );
    if (!existsEvent.rows.length)
      return res.status(404).json({ message: "Event not found" });

    /*   try {
      await requireMemberForPostIfNeeded(eventId, userId);
    } catch (err) {
      return res.status(err.status || 403).json({ message: err.message });
    } */

    await db.query("BEGIN");
    const exists = await db.query(
      `SELECT 1 FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    let attending;
    if (exists.rows.length) {
      await db.query(
        `DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );
      attending = false;
    } else {
      await db.query(
        `INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)`,
        [eventId, userId]
      );
      attending = true;
    }

    const count = await db.query(
      `SELECT COUNT(*)::int AS attendees_count FROM event_attendees WHERE event_id = $1`,
      [eventId]
    );
    await db.query("COMMIT");

    res.json({
      attendees_count: count.rows[0]?.attendees_count ?? 0,
      is_attending: attending,
    });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ✅ Fix 1: DELETE /api/posts/:id (only check membership if community_id exists)
router.delete("/:id", async (req, res) => {
  const postId = toInt(req.params.id);
  const userId = toInt(req.headers["x-user-id"]);

  if (!postId || !userId) {
    return res.status(400).json({ message: "Missing x-user-id header" });
  }

  try {
    const post = await db.query(
      `SELECT author_id, community_id FROM posts WHERE id = $1`,
      [postId]
    );
    if (!post.rows.length)
      return res.status(404).json({ message: "Post not found" });

    // Only check community membership if post belongs to a community
    const communityId = post.rows[0].community_id;
    if (communityId) {
      try {
        await requireCommunityMemberIfNeeded(communityId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
      }
    }

    if (post.rows[0].author_id !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const deleted = await db.query(
      `DELETE FROM posts WHERE id = $1 RETURNING id`,
      [postId]
    );
    res.json({ deleted: deleted.rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

export default router;
