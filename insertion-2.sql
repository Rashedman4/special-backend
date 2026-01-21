BEGIN;

-- Clean reset (dev only)
TRUNCATE TABLE
  event_attendees,
  events,
  poll_votes,
  poll_options,
  polls,
  post_likes,
  posts,
  community_members,
  communities,
  transactions,
  wallets,
  profiles,
  users
RESTART IDENTITY CASCADE;

-- =========================
-- USERS
-- =========================
INSERT INTO users (id, email, username, password, role, created_at) VALUES
  (1, 'admin@tokensphere.com', 'admin', 'admin123', 'admin', '2025-12-09 12:23:48.500521-08'),
  (2, 'alice@tokensphere.com', 'alice', 'alice123', 'user',  '2025-12-19 12:23:48.500521-08'),
  (3, 'bob@tokensphere.com',   'bob',   'bob123',   'user',  '2025-12-21 12:23:48.500521-08'),
  (4, 'sara@tokensphere.com',  'sara',  'sara123',  'user',  '2025-12-24 12:23:48.500521-08'),
  (5, 'omar@tokensphere.com',  'omar',  'omar123',  'user',  '2025-12-27 12:23:48.500521-08'),
  (6, 'lina@tokensphere.com',  'lina',  'lina123',  'user',  '2025-12-29 12:23:48.500521-08');

-- =========================
-- PROFILES
-- =========================
INSERT INTO profiles (user_id, display_name, avatar_url, bio, created_at) VALUES
  (1, 'TokenSphere Admin', NULL, 'Platform admin account.', '2025-12-09 12:23:48.500521-08'),
  (2, 'Alice Johnson',     NULL, 'Frontend dev. Loves communities.', '2025-12-19 12:23:48.500521-08'),
  (3, 'Bob Smith',         NULL, 'Backend dev. Coffee enjoyer.',     '2025-12-21 12:23:48.500521-08'),
  (4, 'Sara Ahmed',        NULL, 'Designer. Clean UI vibes.',        '2025-12-24 12:23:48.500521-08'),
  (5, 'Omar Hasan',        NULL, 'Security enthusiast.',             '2025-12-27 12:23:48.500521-08'),
  (6, 'Lina Khaled',       NULL, 'Product thinker. Likes polls.',    '2025-12-29 12:23:48.500521-08');

-- =========================
-- WALLETS
-- =========================
INSERT INTO wallets (id, user_id, balance, created_at) VALUES
  (1, 1, 1000, '2025-12-09 12:23:48.500521-08'),
  (2, 2, 250,  '2025-12-19 12:23:48.500521-08'),
  (3, 3, 210,  '2025-12-21 12:23:48.500521-08'),
  (4, 4, 80,   '2025-12-24 12:23:48.500521-08'),
  (5, 5, 500,  '2025-12-27 12:23:48.500521-08'),
  (6, 6, 40,   '2025-12-29 12:23:48.500521-08');

-- =========================
-- COMMUNITIES
-- =========================
INSERT INTO communities (id, name, description, creator_id, min_credits_required, status, created_at) VALUES
  (1, 'Web Developers',  'A place for web devs to share tips and projects.', 2,  0,  'active', '2025-12-25 12:23:48.500521-08'),
  (2, 'Cybersecurity',   'Talk security, tools, and best practices.',        5, 50,  'active', '2025-12-28 12:23:48.500521-08'),
  (3, 'UI/UX Designers', 'Design critiques, resources, and inspiration.',    4, 20,  'locked', '2025-12-30 12:23:48.500521-08');

-- =========================
-- COMMUNITY MEMBERS
-- =========================
INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES
  (1,  1, 2, 'admin',  '2025-12-25 12:23:48.500521-08'),
  (2,  1, 3, 'member', '2025-12-26 12:23:48.500521-08'),
  (3,  1, 6, 'member', '2025-12-27 12:23:48.500521-08'),
  (4,  2, 5, 'admin',  '2025-12-28 12:23:48.500521-08'),
  (5,  2, 2, 'member', '2025-12-29 12:23:48.500521-08'),
  (6,  2, 3, 'member', '2025-12-30 12:23:48.500521-08'),
  (7,  3, 4, 'admin',  '2025-12-30 12:23:48.500521-08'),
  (8,  3, 6, 'member', '2025-12-31 12:23:48.500521-08'),
  (9,  3, 2, 'member', '2026-01-01 12:23:48.500521-08'),
  (12, 3, 1, 'member', '2026-01-14 06:28:47.164895-08'),
  (14, 1, 1, 'member', '2026-01-18 09:38:51.245769-08'),
  (15, 2, 1, 'member', '2026-01-18 15:26:38.237082-08');

-- =========================
-- POSTS (author_id, community_id, type, content, likes_count, comments_count, created_at)
-- =========================
INSERT INTO posts (id, author_id, community_id, type, content, likes_count, comments_count, created_at) VALUES
  (1,  2, 1, 'post', 'Welcome to Web Developers! Share what you are building this week.', 3, 0, '2026-01-02 12:23:48.500521-08'),
  (2,  3, 1, 'post', 'Any recommended React patterns for large apps?',                 2, 1, '2026-01-03 12:23:48.500521-08'),
  (3,  5, 2, 'post', 'Cybersecurity community: post your favorite tools + why.',      5, 0, '2026-01-02 12:23:48.500521-08'),
  (4,  2, 2, 'poll', NULL,                                                          0, 0, '2026-01-04 12:23:48.500521-08'),
  (5,  5, 2, 'event',NULL,                                                          1, 0, '2026-01-05 12:23:48.500521-08'),
  (6,  4, 3, 'post', 'Drop your favorite UI inspiration sources.',                   2, 0, '2026-01-04 12:23:48.500521-08'),
  (28, 1, 1, 'poll', NULL,                                                          0, 0, '2026-01-18 09:39:01.899278-08'),
  (29, 1, 1, 'post', 'wewee',                                                       0, 0, '2026-01-18 09:39:43.49703-08'),
  (31, 1, NULL, 'post','hhygfhg',                                                   0, 0, '2026-01-18 09:54:01.105575-08'),
  (32, 1, NULL, 'post','dsd',                                                       0, 0, '2026-01-18 16:34:27.277586-08');

-- =========================
-- POLLS
-- =========================
INSERT INTO polls (post_id, question, ends_at) VALUES
  (4,  'Which security topic should we cover next?', '2026-01-10 12:23:48.500521-08'),
  (28, 'wewe',                                      '2026-01-19 09:39:01.899278-08');

INSERT INTO poll_options (id, poll_id, text) VALUES
  (1,  4,  'Web App Pentesting'),
  (2,  4,  'Threat Modeling'),
  (3,  4,  'SOC / Blue Team Basics'),
  (4,  4,  'Cloud Security'),
  (10, 28, 'ww'),
  (11, 28, 'ddd');

INSERT INTO poll_votes (poll_id, user_id, option_id, created_at) VALUES
  (4,  2, 1,  '2026-01-06 12:23:48.500521-08'),
  (4,  3, 3,  '2026-01-06 12:23:48.500521-08'),
  (4,  5, 2,  '2026-01-06 12:23:48.500521-08'),
  (28, 1, 10, '2026-01-18 09:39:03.490534-08');

-- =========================
-- EVENTS + ATTENDEES
-- =========================
INSERT INTO events (post_id, title, description, start_date, end_date, location) VALUES
  (5, 'Live: Intro to Web Pentesting',
      'We will discuss basics, common bugs, and safe testing approach.',
      '2026-01-11 12:23:48.500521-08',
      '2026-01-11 14:23:48.500521-08',
      'Online (Zoom)');

INSERT INTO event_attendees (event_id, user_id, created_at) VALUES
  (5, 2, '2026-01-07 12:23:48.500521-08'),
  (5, 3, '2026-01-07 12:23:48.500521-08'),
  (5, 1, '2026-01-18 09:51:49.389803-08');

-- =========================
-- POST LIKES
-- =========================
INSERT INTO post_likes (post_id, user_id, created_at) VALUES
  (1, 3, '2026-01-02 14:23:48.500521-08'),
  (1, 6, '2026-01-02 17:23:48.500521-08'),
  (2, 2, '2026-01-03 13:23:48.500521-08'),
  (3, 2, '2026-01-02 15:23:48.500521-08'),
  (3, 3, '2026-01-02 16:23:48.500521-08'),
  (3, 6, '2026-01-02 18:23:48.500521-08'),
  (6, 2, '2026-01-04 13:23:48.500521-08'),
  (3, 1, '2026-01-18 09:38:10.158896-08');

-- =========================
-- TRANSACTIONS
-- =========================
INSERT INTO transactions (id, from_user_id, to_user_id, amount, description, created_at) VALUES
  (1, 1, 2, 50, 'Welcome bonus adjustment', '2025-12-19 12:23:48.500521-08'),
  (2, 2, 3, 10, 'Thanks for helping!',      '2026-01-01 12:23:48.500521-08'),
  (3, 5, 2, 25, 'Security tips reward',     '2026-01-03 12:23:48.500521-08'),
  (4, 3, 6, 5,  'Good design feedback',     '2026-01-04 12:23:48.500521-08');

-- Fix sequences (so next inserts don't collide)
SELECT setval('users_id_seq',        (SELECT COALESCE(MAX(id), 1)  FROM users), true);
SELECT setval('wallets_id_seq',      (SELECT COALESCE(MAX(id), 1)  FROM wallets), true);
SELECT setval('transactions_id_seq', (SELECT COALESCE(MAX(id), 1)  FROM transactions), true);
SELECT setval('communities_id_seq',  (SELECT COALESCE(MAX(id), 1)  FROM communities), true);
SELECT setval('community_members_id_seq', (SELECT COALESCE(MAX(id), 1) FROM community_members), true);
SELECT setval('posts_id_seq',        (SELECT COALESCE(MAX(id), 1)  FROM posts), true);
SELECT setval('poll_options_id_seq', (SELECT COALESCE(MAX(id), 1)  FROM poll_options), true);

COMMIT;
