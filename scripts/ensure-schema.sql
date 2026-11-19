-- Idempotent schema repair. Does not reset revisions or delete languages.
CREATE TABLE IF NOT EXISTS languages (
  code TEXT PRIMARY KEY,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  song_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES languages(code),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  manifest_url TEXT NOT NULL UNIQUE,
  cover_url TEXT,
  level TEXT,
  duration_ms INTEGER,
  sort_order INTEGER NOT NULL,
  visible INTEGER NOT NULL DEFAULT 0 CHECK (visible IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS songs_for_language ON songs(language_code, visible, sort_order, song_id);

CREATE TABLE IF NOT EXISTS catalog_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  draft_revision INTEGER NOT NULL,
  published_revision INTEGER NOT NULL
);

INSERT OR IGNORE INTO catalog_state (singleton, draft_revision, published_revision) VALUES (1, 0, 0);

CREATE TABLE IF NOT EXISTS published_snapshots (
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  envelope_json TEXT NOT NULL,
  etag TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS published_identities (
  kind TEXT NOT NULL CHECK (kind IN ('language', 'song')),
  id TEXT NOT NULL,
  language_code TEXT,
  manifest_url TEXT,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS publish_cas (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token INTEGER NOT NULL CHECK (token = 1)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);
