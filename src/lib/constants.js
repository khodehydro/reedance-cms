export const CATALOG_DOMAIN = "REEDANCE-CATALOG-V1";
export const MAX_JSON_BODY = 16 * 1024;
export const MAX_PAYLOAD_BYTES = 128 * 1024;
export const MAX_ENVELOPE_BYTES = 192 * 1024;
export const MAX_SONGS_PER_LANGUAGE = 100;
export const MAX_LANGUAGES = 32;
export const LANGUAGE_RE = /^[a-z]{2,3}$/;
export const SONG_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const KEY_ID_RE = /^cat-[a-z0-9-]+$/;
export const LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1", "C2"]);
export const TEST_KEY_ID = "cat-test-v1";
export const TEST_HOST = "content.example.invalid";
export const DEFAULT_SUPPORTED_LANGUAGES = Object.freeze(["en", "es", "ko"]);
export const FORBIDDEN_FIELDS = Object.freeze([
  "lyrics", "lyric", "audio", "lesson", "image", "images", "pack", "rdpack",
  "encryptionKey", "encryptionKeyId", "signatureKeyId", "media", "startMs",
  "endMs", "file", "files", "coverBase64", "password", "secret", "privateKey",
  "pkcs8", "token", "latestJson", "octet", "upload",
]);
export const LANGUAGE_FIELDS = Object.freeze(["code", "nameFa", "nameEn", "sortOrder", "active"]);
export const SONG_FIELDS = Object.freeze([
  "songId", "targetLanguage", "title", "artist", "manifestUrl", "coverUrl",
  "level", "durationMs", "sortOrder", "visible",
]);
export const CACHE_CONTROL = "public, max-age=60, s-maxage=300, must-revalidate";
