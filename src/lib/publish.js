import { fromBase64Url, sha256Hex, utf8Decode } from "./bytes.js";
import { KEY_ID_RE, MAX_PAYLOAD_BYTES } from "./constants.js";
import { catalogConfig } from "./config.js";
import { CasConflictError, HttpError } from "./errors.js";
import { isoNow } from "./http.js";
import { envelopeBytes, importCatalogPrivateKey, signPayloadObject, assertEnvelopeSize, assertProductionKey } from "./sign.js";
import { assertPublishLimits, compareIdentity, languagePublic, songPublic, validateDraftUrls } from "./validate.js";

function sortLang(a, b) {
  return a.sort_order - b.sort_order || a.code.localeCompare(b.code);
}

function sortSong(a, b) {
  return a.sort_order - b.sort_order || a.song_id.localeCompare(b.song_id);
}

export async function buildSnapshots({ store, env, privateKey, revision, publishedAt }) {
  const config = catalogConfig(env);
  assertProductionKey(env);
  if (!config.catalogKeyId) throw new HttpError(500, "missing_key_id", "CATALOG_KEY_ID is not set");
  const allLanguages = (await store.listLanguages()).filter((row) => row.active === 1).sort(sortLang);
  for (const language of allLanguages) {
    if (!config.supportedLanguages.has(language.code)) {
      throw new HttpError(400, "unsupported_language", `Language ${language.code} is not in SUPPORTED_LANGUAGE_CODES`);
    }
  }
  const allSongs = await store.listSongs();
  const songsByLanguage = new Map(allLanguages.map((language) => [
    language.code,
    allSongs.filter((song) => song.language_code === language.code && song.visible === 1).sort(sortSong),
  ]));
  assertPublishLimits({ languages: allLanguages, songsByLanguage });

  const identities = [];
  for (const language of allLanguages) {
    const existing = await store.getIdentity("language", language.code);
    compareIdentity(existing, { kind: "language", id: language.code });
    identities.push({ kind: "language", id: language.code, language_code: language.code, manifest_url: null });
  }
  for (const [code, songs] of songsByLanguage) {
    for (const song of songs) {
      validateDraftUrls(song, config, env);
      const existing = await store.getIdentity("song", song.song_id);
      try {
        compareIdentity(existing, { kind: "song", id: song.song_id, language_code: song.language_code, manifest_url: song.manifest_url });
      } catch (error) {
        await store.logAudit("immutable_rejected", `${song.song_id}: ${error.message}`);
        throw error;
      }
      identities.push({
        kind: "song",
        id: song.song_id,
        language_code: song.language_code,
        manifest_url: song.manifest_url,
      });
    }
  }

  const pretty = config.prettyPayload;
  const snapshots = [];
  const languagesPayload = {
    catalogVersion: 1,
    kind: "languages",
    revision,
    publishedAt,
    languages: allLanguages.map(languagePublic),
  };
  const languagesEnvelope = await signPayloadObject(privateKey, config.catalogKeyId, languagesPayload, pretty);
  const languagesBytes = envelopeBytes(languagesEnvelope);
  assertEnvelopeSize(languagesBytes);
  snapshots.push({
    scope: "languages",
    revision,
    envelope_json: utf8Decode(languagesBytes),
    etag: `"sha256-${await sha256Hex(languagesBytes)}"`,
    published_at: publishedAt,
  });

  for (const language of allLanguages) {
    const payload = {
      catalogVersion: 1,
      kind: "songs",
      revision,
      publishedAt,
      language: language.code,
      songs: songsByLanguage.get(language.code).map(songPublic),
    };
    const envelope = await signPayloadObject(privateKey, config.catalogKeyId, payload, pretty);
    const bytes = envelopeBytes(envelope);
    assertEnvelopeSize(bytes);
    snapshots.push({
      scope: `songs/${language.code}`,
      revision,
      envelope_json: utf8Decode(bytes),
      etag: `"sha256-${await sha256Hex(bytes)}"`,
      published_at: publishedAt,
    });
  }

  const keep = new Set(["languages", ...allLanguages.map((language) => `songs/${language.code}`)]);
  const existing = await store.listSnapshots();
  const deleteScopes = existing.map((row) => row.scope).filter((scope) => !keep.has(scope));
  return { snapshots, deleteScopes, identities, languagesPayload };
}

export async function publishCatalog(store, env, { draftRevision, confirmHostFilesVerified }) {
  if (confirmHostFilesVerified !== true) {
    throw new HttpError(400, "unconfirmed", "Operator must confirm host files were verified outside Cloudflare");
  }
  if (!Number.isInteger(draftRevision) || draftRevision < 0) {
    throw new HttpError(400, "invalid_field", "draftRevision is required");
  }
  if (!env.CATALOG_SIGNING_PKCS8) {
    throw new HttpError(503, "signing_unavailable", "Online publish needs CATALOG_SIGNING_PKCS8");
  }
  const keyId = catalogConfig(env).catalogKeyId;
  if (!KEY_ID_RE.test(keyId)) {
    throw new HttpError(400, "bad_key_id", `CATALOG_KEY_ID ${JSON.stringify(keyId)} is invalid; need cat- then lowercase letters, digits or hyphens`);
  }
  const state = await store.getState();
  if (state.draft_revision !== draftRevision) {
    throw new CasConflictError("Draft changed; reload preview and retry");
  }
  const nextRevision = state.published_revision + 1;
  const publishedAt = isoNow(env);
  let privateKey;
  try {
    privateKey = await importCatalogPrivateKey(env.CATALOG_SIGNING_PKCS8);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "bad_signing_key", "CATALOG_SIGNING_PKCS8 is not a valid Ed25519 PKCS8 private key");
  }
  try {
    const built = await buildSnapshots({
      store, env, privateKey, revision: nextRevision, publishedAt,
    });
    await store.publishAtomic({
      expectedDraft: draftRevision,
      expectedPublished: state.published_revision,
      nextRevision,
      snapshots: built.snapshots,
      deleteScopes: built.deleteScopes,
      identities: built.identities,
      publishedAt,
    });
    return {
      publishedRevision: nextRevision,
      publishedAt,
      scopes: built.snapshots.map((snapshot) => snapshot.scope),
      removedScopes: built.deleteScopes,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = String(error?.message || error);
    if (/no such table/i.test(message)) {
      throw new HttpError(503, "schema_missing", "D1 schema is incomplete. Run scripts/ensure-schema.sql");
    }
    throw new HttpError(500, "internal", message.slice(0, 180));
  }
}

export function decodeEnvelopeJson(envelopeJson) {
  const envelope = JSON.parse(envelopeJson);
  const payloadBytes = fromBase64Url(envelope.payload, MAX_PAYLOAD_BYTES);
  return { envelope, payload: JSON.parse(utf8Decode(payloadBytes)), payloadBytes };
}
