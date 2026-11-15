import { LANGUAGE_FIELDS, LANGUAGE_RE, LEVELS, MAX_LANGUAGES, MAX_SONGS_PER_LANGUAGE, SONG_FIELDS, SONG_ID_RE } from "./constants.js";
import { HttpError } from "./errors.js";
import { pickKnown, rejectForbidden } from "./json.js";
import { assertCoverUrl, assertManifestUrl, assertProductionHosts } from "./url.js";

function requireString(value, field, { min = 1, max = 128, pattern } = {}) {
  if (typeof value !== "string") throw new HttpError(400, "invalid_field", `${field} must be a string`);
  if (value.length < min || value.length > max) throw new HttpError(400, "invalid_field", `${field} length is invalid`);
  if (!/\S/.test(value)) throw new HttpError(400, "invalid_field", `${field} must contain non-whitespace`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    throw new HttpError(400, "invalid_field", `${field} contains control characters`);
  }
  if (pattern && !pattern.test(value)) throw new HttpError(400, "invalid_field", `${field} format is invalid`);
  return value;
}

function requireInteger(value, field, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, "invalid_field", `${field} must be an integer`);
  }
  if (value < min || value > max) throw new HttpError(400, "invalid_field", `${field} is out of range`);
  return value;
}

function requireFlag(value, field) {
  if (typeof value !== "boolean") throw new HttpError(400, "invalid_field", `${field} must be a boolean`);
  return value ? 1 : 0;
}

export function validateLanguageInput(body, codeFromPath) {
  rejectForbidden(body);
  pickKnown(body, LANGUAGE_FIELDS);
  const code = requireString(body.code ?? codeFromPath, "code", { min: 2, max: 3, pattern: LANGUAGE_RE });
  if (codeFromPath && code !== codeFromPath) throw new HttpError(400, "invalid_field", "code must match the URL");
  return {
    code,
    name_fa: requireString(body.nameFa, "nameFa", { max: 128 }),
    name_en: requireString(body.nameEn, "nameEn", { max: 128 }),
    sort_order: requireInteger(body.sortOrder, "sortOrder", -1_000_000, 1_000_000),
    active: requireFlag(body.active, "active"),
  };
}

export function validateSongInput(body, songIdFromPath) {
  rejectForbidden(body);
  pickKnown(body, SONG_FIELDS);
  const songId = requireString(body.songId ?? songIdFromPath, "songId", { min: 1, max: 80, pattern: SONG_ID_RE });
  if (songIdFromPath && songId !== songIdFromPath) throw new HttpError(400, "invalid_field", "songId must match the URL");
  const row = {
    song_id: songId,
    language_code: requireString(body.targetLanguage, "targetLanguage", { min: 2, max: 3, pattern: LANGUAGE_RE }),
    title: requireString(body.title, "title", { max: 256 }),
    artist: requireString(body.artist, "artist", { max: 256 }),
    manifest_url: requireString(body.manifestUrl, "manifestUrl", { min: 12, max: 2048 }),
    cover_url: body.coverUrl == null || body.coverUrl === "" ? null : requireString(body.coverUrl, "coverUrl", { min: 12, max: 2048 }),
    level: body.level == null || body.level === "" ? null : body.level,
    duration_ms: body.durationMs == null ? null : requireInteger(body.durationMs, "durationMs", 1, 86_400_000),
    sort_order: requireInteger(body.sortOrder, "sortOrder", -1_000_000, 1_000_000),
    visible: requireFlag(body.visible, "visible"),
  };
  if (row.level != null) {
    if (!LEVELS.includes(row.level)) throw new HttpError(400, "invalid_field", "level must be A1–C2");
  }
  return row;
}

export function validateDraftUrls(row, config, env) {
  const manifest = assertManifestUrl(row.manifest_url, config.manifestHosts);
  assertProductionHosts(manifest, env);
  if (row.cover_url) {
    const cover = assertCoverUrl(row.cover_url, config.coverHosts);
    assertProductionHosts(cover, env);
  }
}

export function languagePublic(row) {
  return { code: row.code, nameFa: row.name_fa, nameEn: row.name_en };
}

export function songPublic(row) {
  const song = {
    songId: row.song_id,
    targetLanguage: row.language_code,
    title: row.title,
    artist: row.artist,
    manifestUrl: row.manifest_url,
  };
  if (row.cover_url) song.coverUrl = row.cover_url;
  if (row.level) song.level = row.level;
  if (row.duration_ms != null) song.durationMs = row.duration_ms;
  return song;
}

export function assertPublishLimits({ languages, songsByLanguage }) {
  if (languages.length > MAX_LANGUAGES) {
    throw new HttpError(400, "too_many_languages", "At most 32 languages can be published");
  }
  const ids = new Set();
  for (const [code, songs] of songsByLanguage) {
    if (songs.length > MAX_SONGS_PER_LANGUAGE) {
      throw new HttpError(400, "too_many_songs", `Language ${code} exceeds 100 songs`);
    }
    for (const song of songs) {
      if (ids.has(song.song_id)) throw new HttpError(400, "duplicate_song", `Duplicate songId ${song.song_id}`);
      ids.add(song.song_id);
      if (song.language_code !== code) {
        throw new HttpError(400, "language_mismatch", "targetLanguage must match the language list");
      }
    }
  }
}

export function compareIdentity(existing, next) {
  if (!existing) return;
  if (existing.kind === "language" && existing.id !== next.id) {
    throw new HttpError(409, "immutable", "Published language code cannot change");
  }
  if (existing.kind === "song") {
    if (existing.language_code !== next.language_code) {
      throw new HttpError(409, "immutable", "Published song language cannot change");
    }
    if (existing.manifest_url !== next.manifest_url) {
      throw new HttpError(409, "immutable", "Published manifestUrl cannot change");
    }
  }
}
