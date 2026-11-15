-- Reedance catalog metadata only. Never store lesson/audio/image/pack bytes or secrets.

CREATE TABLE languages (
  code TEXT PRIMARY KEY,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE songs (
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

CREATE INDEX songs_for_language ON songs(language_code, visible, sort_order, song_id);

CREATE TABLE catalog_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  draft_revision INTEGER NOT NULL,
  published_revision INTEGER NOT NULL
);

INSERT INTO catalog_state (singleton, draft_revision, published_revision) VALUES (1, 0, 0);

CREATE TABLE published_snapshots (
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  envelope_json TEXT NOT NULL,
  etag TEXT NOT NULL,
  published_at TEXT NOT NULL
);

-- Locked identity after the first successful publish of a code/songId.
CREATE TABLE published_identities (
  kind TEXT NOT NULL CHECK (kind IN ('language', 'song')),
  id TEXT NOT NULL,
  language_code TEXT,
  manifest_url TEXT,
  PRIMARY KEY (kind, id)
);

-- CHECK(token = 1) aborts a D1 batch when CAS does not match.
CREATE TABLE publish_cas (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token INTEGER NOT NULL CHECK (token = 1)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);
