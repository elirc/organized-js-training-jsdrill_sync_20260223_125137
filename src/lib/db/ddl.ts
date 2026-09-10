/**
 * Schema DDL, kept in one place so the seed script and the app both create the
 * same tables. Everything is `IF NOT EXISTS`, so running it on every connect is
 * cheap and means a fresh clone works without a migration step.
 *
 * `schema.ts` is the Drizzle-side mirror of this — change both together.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT 'indigo',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'foundation',
  key_points TEXT NOT NULL DEFAULT '[]',
  interview_angle TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS modules_track_idx ON modules(track_id);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  frequency INTEGER NOT NULL DEFAULT 2,
  tags TEXT NOT NULL DEFAULT '[]',
  prompt TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'js',
  choices TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL DEFAULT 'null',
  explanation TEXT NOT NULL DEFAULT '',
  follow_up TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '[]',
  model_answer TEXT NOT NULL DEFAULT '',
  starter_code TEXT NOT NULL DEFAULT '',
  solution_code TEXT NOT NULL DEFAULT '',
  test_cases TEXT NOT NULL DEFAULT '[]',
  est_seconds INTEGER NOT NULL DEFAULT 45,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_module_idx ON items(module_id);
CREATE INDEX IF NOT EXISTS items_track_idx ON items(track_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  daily_goal INTEGER NOT NULL DEFAULT 20,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  response TEXT NOT NULL DEFAULT 'null',
  verdict TEXT NOT NULL DEFAULT 'incorrect',
  score REAL NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1,
  time_spent INTEGER NOT NULL DEFAULT 0,
  used_hint INTEGER NOT NULL DEFAULT 0,
  interview_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user_idx ON attempts(user_id);
CREATE INDEX IF NOT EXISTS attempts_item_idx ON attempts(item_id);
CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts(created_at);

CREATE TABLE IF NOT EXISTS user_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  due TEXT NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0,
  last_review TEXT
);
CREATE INDEX IF NOT EXISTS cards_user_due_idx ON user_cards(user_id, due);
CREATE UNIQUE INDEX IF NOT EXISTS cards_user_item_idx ON user_cards(user_id, item_id);

CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_user_item_idx ON saved_items(user_id, item_id);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  track_slugs TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  breakdown TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS interviews_user_idx ON interviews(user_id);
`;

export const DEFAULT_USER_ID = "local-user";
