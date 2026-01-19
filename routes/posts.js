// routes/posts.js
import express from "express";
import db from "../db.js";

const router = express.Router();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Small helper to avoid repeating BEGIN / COMMIT / ROLLBACK everywhere
async function withTx(fn) {
  try {
    await db.query("BEGIN");
    const result = await fn();
    await db.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    throw e;
  }
}

/**
 * GET /api/posts
 * Query:
 * - user_id (optional): to compute liked_by_me, user_vote, is_attending
 * - author_id (optional): filter posts by author
 * - community_id (optional): if null => public posts only, else => that community posts
 * - limit (optional)
 */
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

         u.username AS author_username,
         pr.display_name AS author_display_name,
         pr.avatar_url AS author_avatar_url,

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
      [authorId, limit, communityId],
    );

    const posts = base.rows;
    if (!posts.length) return res.json({ posts: [] });

    const postIds = posts.map((p) => p.id);
    const pollIds = posts.filter((p) => p.type === "poll").map((p) => p.id);
    const eventIds = posts.filter((p) => p.type === "event").map((p) => p.id);

    const likedByMe = new Set();
    if (userId) {
      const likes = await db.query(
        `SELECT post_id
         FROM post_likes
         WHERE user_id = $1 AND post_id = ANY($2::int[])`,
        [userId, postIds],
      );
      likes.rows.forEach((r) => likedByMe.add(r.post_id));
    }

    const pollOptionsByPollId = new Map();
    const pollTotalVotes = new Map();

    if (pollIds.length) {
      const opts = await db.query(
        `SELECT
           po.id,
           po.poll_id,
           po.text,
           COALESCE(COUNT(pv.user_id), 0)::int AS votes
         FROM poll_options po
         LEFT JOIN poll_votes pv ON pv.option_id = po.id
         WHERE po.poll_id = ANY($1::int[])
         GROUP BY po.id, po.poll_id, po.text
         ORDER BY po.id`,
        [pollIds],
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
          pollTotalVotes.get(row.poll_id) + row.votes,
        );
      }
    }

    const userVoteByPollId = new Map();
    if (userId && pollIds.length) {
      const votes = await db.query(
        `SELECT poll_id, option_id
         FROM poll_votes
         WHERE user_id = $1 AND poll_id = ANY($2::int[])`,
        [userId, pollIds],
      );
      votes.rows.forEach((r) => userVoteByPollId.set(r.poll_id, r.option_id));
    }

    const attendeesCountByEventId = new Map();
    const isAttendingByEventId = new Set();

    if (eventIds.length) {
      const counts = await db.query(
        `SELECT event_id, COUNT(*)::int AS attendees_count
         FROM event_attendees
         WHERE event_id = ANY($1::int[])
         GROUP BY event_id`,
        [eventIds],
      );
      counts.rows.forEach((r) =>
        attendeesCountByEventId.set(r.event_id, r.attendees_count),
      );

      if (userId) {
        const attending = await db.query(
          `SELECT event_id
           FROM event_attendees
           WHERE user_id = $1 AND event_id = ANY($2::int[])`,
          [userId, eventIds],
        );
        attending.rows.forEach((r) => isAttendingByEventId.add(r.event_id));
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
        profiles: {
          id: p.author_id,
          username: p.author_username,
          display_name: p.author_display_name,
          avatar_url: p.author_avatar_url,
        },
        liked_by_me: likedByMe.has(p.id),
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
        out.is_attending = isAttendingByEventId.has(p.id);
      }

      return out;
    });

    res.json({ posts: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

  const rawCommunity = req.body.community_id;
  const communityId =
    rawCommunity === null ||
    rawCommunity === undefined ||
    rawCommunity === "" ||
    rawCommunity === "null"
      ? null
      : toInt(rawCommunity);

  try {
    const userCheck = await db.query(
      `SELECT 1
       FROM users u
       JOIN profiles pr ON pr.user_id = u.id
       WHERE u.id = $1`,
      [authorId],
    );
    if (!userCheck.rows.length) {
      return res.status(400).json({
        message: "User not found or profile missing.",
      });
    }

    const createdPostId = await withTx(async () => {
      // Create base post row
      const content =
        type === "post" ? String(req.body.content || "").trim() : null;
      if (type === "post" && !content) {
        const e = new Error("content is required");
        e.status = 400;
        throw e;
      }

      const created = await db.query(
        `INSERT INTO posts (author_id, community_id, type, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [authorId, communityId, type, content],
      );
      const postId = created.rows[0].id;

      // Poll details
      if (type === "poll") {
        const question = String(req.body.question || "").trim();
        const durationHours = toInt(req.body.duration_hours) || 24;

        const rawOptions = Array.isArray(req.body.poll_options)
          ? req.body.poll_options
          : Array.isArray(req.body.options)
            ? req.body.options
            : [];

        const opts = rawOptions.map((s) => String(s).trim()).filter(Boolean);

        if (!question || opts.length < 2) {
          const e = new Error("Poll needs a question and at least 2 options");
          e.status = 400;
          throw e;
        }

        await db.query(
          `INSERT INTO polls (post_id, question, ends_at)
           VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)`,
          [postId, question, durationHours],
        );

        for (const text of opts) {
          await db.query(
            `INSERT INTO poll_options (poll_id, text) VALUES ($1, $2)`,
            [postId, text],
          );
        }
      }

      if (type === "event") {
        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim() || null;
        const location = String(req.body.location || "").trim();

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
          const e = new Error(
            "Event needs title, location, and valid start_date",
          );
          e.status = 400;
          throw e;
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
          ],
        );
      }

      return postId;
    });

    const result = await db.query(
      `SELECT
         p.id, p.author_id, p.community_id, p.type, p.content,
         p.likes_count, p.comments_count, p.created_at,

         u.username AS author_username,
         pr.display_name AS author_display_name,
         pr.avatar_url AS author_avatar_url,

         pl.question, pl.ends_at,
         ev.title, ev.description, ev.start_date, ev.end_date, ev.location
       FROM posts p
       JOIN users u ON u.id = p.author_id
       JOIN profiles pr ON pr.user_id = u.id
       LEFT JOIN polls pl ON pl.post_id = p.id
       LEFT JOIN events ev ON ev.post_id = p.id
       WHERE p.id = $1`,
      [createdPostId],
    );

    if (!result.rows.length) {
      return res
        .status(500)
        .json({ message: "Failed to retrieve created post." });
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
      profiles: {
        id: row.author_id,
        username: row.author_username,
        display_name: row.author_display_name,
        avatar_url: row.author_avatar_url,
      },
      liked_by_me: false,
    };

    if (row.type === "poll") {
      const opts = await db.query(
        `SELECT id, text, 0::int AS votes
         FROM poll_options
         WHERE poll_id = $1
         ORDER BY id`,
        [row.id],
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
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/posts/:id/like (toggle)
router.post("/:id/like", async (req, res) => {
  const postId = toInt(req.params.id);
  const userId = toInt(req.body.user_id);

  if (!postId || !userId)
    return res.status(400).json({ message: "Invalid like data" });

  try {
    const result = await withTx(async () => {
      const exists = await db.query(
        `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId],
      );

      let liked;
      if (exists.rows.length) {
        await db.query(
          `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
          [postId, userId],
        );
        await db.query(
          `UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
          [postId],
        );
        liked = false;
      } else {
        await db.query(
          `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
          [postId, userId],
        );
        await db.query(
          `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1`,
          [postId],
        );
        liked = true;
      }

      const updated = await db.query(
        `SELECT likes_count FROM posts WHERE id = $1`,
        [postId],
      );
      return { liked, likes_count: updated.rows[0]?.likes_count ?? 0 };
    });

    res.json({ liked_by_me: result.liked, likes_count: result.likes_count });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
      [pollId],
    );
    if (!poll.rows.length)
      return res.status(404).json({ message: "Poll not found" });

    if (poll.rows[0].ends_at && new Date(poll.rows[0].ends_at) < new Date()) {
      return res.status(400).json({ message: "Poll has ended" });
    }

    const opt = await db.query(
      `SELECT 1 FROM poll_options WHERE id = $1 AND poll_id = $2`,
      [optionId, pollId],
    );
    if (!opt.rows.length)
      return res.status(400).json({ message: "Invalid option" });

    const already = await db.query(
      `SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId],
    );
    if (already.rows.length)
      return res.status(400).json({ message: "Already voted" });

    await db.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)`,
      [pollId, userId, optionId],
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
      [pollId],
    );

    const totalVotes = opts.rows.reduce((sum, r) => sum + r.votes, 0);

    res.json({
      user_vote: optionId,
      options: opts.rows,
      total_votes: totalVotes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
      [eventId],
    );
    if (!existsEvent.rows.length)
      return res.status(404).json({ message: "Event not found" });

    const result = await withTx(async () => {
      const exists = await db.query(
        `SELECT 1 FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId],
      );

      let attending;
      if (exists.rows.length) {
        await db.query(
          `DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
          [eventId, userId],
        );
        attending = false;
      } else {
        await db.query(
          `INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)`,
          [eventId, userId],
        );
        attending = true;
      }

      const count = await db.query(
        `SELECT COUNT(*)::int AS attendees_count FROM event_attendees WHERE event_id = $1`,
        [eventId],
      );

      return {
        attending,
        attendees_count: count.rows[0]?.attendees_count ?? 0,
      };
    });

    res.json({
      attendees_count: result.attendees_count,
      is_attending: result.attending,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/posts/:id
router.delete("/:id", async (req, res) => {
  const postId = toInt(req.params.id);
  const userId = toInt(req.headers["x-user-id"]);

  if (!postId || !userId) {
    return res.status(400).json({ message: "Missing x-user-id header" });
  }

  try {
    const post = await db.query(`SELECT author_id FROM posts WHERE id = $1`, [
      postId,
    ]);
    if (!post.rows.length)
      return res.status(404).json({ message: "Post not found" });

    if (post.rows[0].author_id !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const deleted = await db.query(
      `DELETE FROM posts WHERE id = $1 RETURNING id`,
      [postId],
    );
    res.json({ deleted: deleted.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
