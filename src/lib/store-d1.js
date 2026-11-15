import { CasConflictError, HttpError } from "./errors.js";

function mapLanguage(row) {
  if (!row) return null;
  return {
    code: row.code,
    name_fa: row.name_fa,
    name_en: row.name_en,
    sort_order: row.sort_order,
    active: row.active,
    updated_at: row.updated_at,
  };
}

function mapSong(row) {
  if (!row) return null;
  return {
    song_id: row.song_id,
    language_code: row.language_code,
    title: row.title,
    artist: row.artist,
    manifest_url: row.manifest_url,
    cover_url: row.cover_url,
    level: row.level,
    duration_ms: row.duration_ms,
    sort_order: row.sort_order,
    visible: row.visible,
    updated_at: row.updated_at,
  };
}

export function createD1Store(db) {
  return {
    async getState() {
      const row = await db.prepare("SELECT draft_revision, published_revision FROM catalog_state WHERE singleton = 1").first();
      if (!row) throw new Error("catalog_state missing");
      return row;
    },
    async listLanguages() {
      const { results } = await db.prepare(
        "SELECT code, name_fa, name_en, sort_order, active, updated_at FROM languages ORDER BY sort_order ASC, code ASC",
      ).all();
      return (results || []).map(mapLanguage);
    },
    async getLanguage(code) {
      return mapLanguage(await db.prepare(
        "SELECT code, name_fa, name_en, sort_order, active, updated_at FROM languages WHERE code = ?",
      ).bind(code).first());
    },
    async upsertLanguage(row) {
      await db.batch([
        db.prepare(`
          INSERT INTO languages (code, name_fa, name_en, sort_order, active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(code) DO UPDATE SET
            name_fa = excluded.name_fa,
            name_en = excluded.name_en,
            sort_order = excluded.sort_order,
            active = excluded.active,
            updated_at = excluded.updated_at
        `).bind(row.code, row.name_fa, row.name_en, row.sort_order, row.active, row.updated_at),
        db.prepare("UPDATE catalog_state SET draft_revision = draft_revision + 1 WHERE singleton = 1"),
      ]);
      return this.getState();
    },
    async deleteLanguage(code) {
      const published = await db.prepare(
        "SELECT id FROM published_identities WHERE kind = 'language' AND id = ?",
      ).bind(code).first();
      if (published) throw new HttpError(409, "immutable", "Published language cannot be deleted; deactivate it instead");
      const song = await db.prepare("SELECT song_id FROM songs WHERE language_code = ? LIMIT 1").bind(code).first();
      if (song) throw new HttpError(409, "has_songs", "Delete songs first");
      const result = await db.batch([
        db.prepare("DELETE FROM languages WHERE code = ?").bind(code),
        db.prepare("UPDATE catalog_state SET draft_revision = draft_revision + 1 WHERE singleton = 1"),
      ]);
      if (!result[0]?.meta?.changes) throw new HttpError(404, "not_found", "Language not found");
      return this.getState();
    },
    async listSongs() {
      const { results } = await db.prepare(
        `SELECT song_id, language_code, title, artist, manifest_url, cover_url, level, duration_ms, sort_order, visible, updated_at
         FROM songs ORDER BY sort_order ASC, song_id ASC`,
      ).all();
      return (results || []).map(mapSong);
    },
    async getSong(id) {
      return mapSong(await db.prepare(
        `SELECT song_id, language_code, title, artist, manifest_url, cover_url, level, duration_ms, sort_order, visible, updated_at
         FROM songs WHERE song_id = ?`,
      ).bind(id).first());
    },
    async upsertSong(row) {
      const language = await db.prepare("SELECT code FROM languages WHERE code = ?").bind(row.language_code).first();
      if (!language) throw new HttpError(400, "missing_language", "targetLanguage does not exist");
      try {
        await db.batch([
          db.prepare(`
            INSERT INTO songs (song_id, language_code, title, artist, manifest_url, cover_url, level, duration_ms, sort_order, visible, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(song_id) DO UPDATE SET
              language_code = excluded.language_code,
              title = excluded.title,
              artist = excluded.artist,
              manifest_url = excluded.manifest_url,
              cover_url = excluded.cover_url,
              level = excluded.level,
              duration_ms = excluded.duration_ms,
              sort_order = excluded.sort_order,
              visible = excluded.visible,
              updated_at = excluded.updated_at
          `).bind(
            row.song_id, row.language_code, row.title, row.artist, row.manifest_url, row.cover_url,
            row.level, row.duration_ms, row.sort_order, row.visible, row.updated_at,
          ),
          db.prepare("UPDATE catalog_state SET draft_revision = draft_revision + 1 WHERE singleton = 1"),
        ]);
      } catch (error) {
        const message = String(error?.message || error);
        if (message.includes("UNIQUE") || message.includes("unique")) {
          throw new HttpError(409, "duplicate_url", "manifestUrl must be unique");
        }
        throw error;
      }
      return this.getState();
    },
    async deleteSong(id) {
      const published = await db.prepare(
        "SELECT id FROM published_identities WHERE kind = 'song' AND id = ?",
      ).bind(id).first();
      if (published) throw new HttpError(409, "immutable", "Published song cannot be deleted; hide it instead");
      const result = await db.batch([
        db.prepare("DELETE FROM songs WHERE song_id = ?").bind(id),
        db.prepare("UPDATE catalog_state SET draft_revision = draft_revision + 1 WHERE singleton = 1"),
      ]);
      if (!result[0]?.meta?.changes) throw new HttpError(404, "not_found", "Song not found");
      return this.getState();
    },
    async getSnapshot(scope) {
      const row = await db.prepare(
        "SELECT scope, revision, envelope_json, etag, published_at FROM published_snapshots WHERE scope = ?",
      ).bind(scope).first();
      return row || null;
    },
    async listSnapshots() {
      const { results } = await db.prepare(
        "SELECT scope, revision, envelope_json, etag, published_at FROM published_snapshots",
      ).all();
      return results || [];
    },
    async getIdentity(kind, id) {
      const row = await db.prepare(
        "SELECT kind, id, language_code, manifest_url FROM published_identities WHERE kind = ? AND id = ?",
      ).bind(kind, id).first();
      return row || null;
    },
    async listIdentities() {
      const { results } = await db.prepare(
        "SELECT kind, id, language_code, manifest_url FROM published_identities",
      ).all();
      return results || [];
    },
    async logAudit(action, detail) {
      await db.prepare("INSERT INTO audit_log (at, action, detail) VALUES (?, ?, ?)").bind(
        new Date().toISOString(), action, detail.slice(0, 2000),
      ).run();
    },
    async publishAtomic({ expectedDraft, expectedPublished, nextRevision, snapshots, deleteScopes, identities, publishedAt }) {
      const statements = [
        db.prepare("DELETE FROM publish_cas"),
        db.prepare(`
          INSERT INTO publish_cas (id, token)
          SELECT 1,
            CASE WHEN EXISTS (
              SELECT 1 FROM catalog_state
              WHERE singleton = 1 AND draft_revision = ? AND published_revision = ?
            ) THEN 1 ELSE 0 END
        `).bind(expectedDraft, expectedPublished),
        db.prepare(`
          UPDATE catalog_state
          SET published_revision = ?
          WHERE singleton = 1 AND draft_revision = ? AND published_revision = ?
        `).bind(nextRevision, expectedDraft, expectedPublished),
      ];
      for (const snapshot of snapshots) {
        statements.push(db.prepare(`
          INSERT INTO published_snapshots (scope, revision, envelope_json, etag, published_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(scope) DO UPDATE SET
            revision = excluded.revision,
            envelope_json = excluded.envelope_json,
            etag = excluded.etag,
            published_at = excluded.published_at
        `).bind(snapshot.scope, snapshot.revision, snapshot.envelope_json, snapshot.etag, snapshot.published_at));
      }
      for (const scope of deleteScopes) {
        statements.push(db.prepare("DELETE FROM published_snapshots WHERE scope = ?").bind(scope));
      }
      for (const identity of identities) {
        statements.push(db.prepare(`
          INSERT INTO published_identities (kind, id, language_code, manifest_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(kind, id) DO NOTHING
        `).bind(identity.kind, identity.id, identity.language_code, identity.manifest_url));
      }
      statements.push(
        db.prepare("INSERT INTO audit_log (at, action, detail) VALUES (?, ?, ?)").bind(
          publishedAt, "publish", `revision=${nextRevision} draft=${expectedDraft}`,
        ),
        db.prepare("DELETE FROM publish_cas"),
      );
      try {
        await db.batch(statements);
      } catch (error) {
        const message = String(error?.message || error);
        if (message.includes("CHECK") || message.includes("constraint") || message.includes("publish_cas")) {
          throw new CasConflictError();
        }
        throw error;
      }
    },
  };
}
