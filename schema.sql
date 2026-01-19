-- USERS (auth + role)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROFILES (public user info)
CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WALLETS (token balance)
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRANSACTIONS (transfers between users)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount INT NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_user_id <> to_user_id)
);



-- COMMUNITIES
CREATE TABLE IF NOT EXISTS communities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  min_credits_required INT NOT NULL DEFAULT 0 CHECK (min_credits_required >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- COMMUNITY MEMBERS
CREATE TABLE IF NOT EXISTS community_members (
  id SERIAL PRIMARY KEY,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','moderator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);



-- POSTS (supports feed + communities)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id INT REFERENCES communities(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('post','poll','event')),
  content TEXT,
  likes_count INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INT NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
);


-- POST LIKES
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);


-- POLLS (poll is a post)
CREATE TABLE IF NOT EXISTS polls (
  post_id INT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  ends_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INT NOT NULL REFERENCES polls(post_id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id INT NOT NULL REFERENCES polls(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);



-- EVENTS (event is a post)
CREATE TABLE IF NOT EXISTS events (
  post_id INT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL CHECK (length(trim(location)) > 0),
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id INT NOT NULL REFERENCES events(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

