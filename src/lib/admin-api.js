import { LANGUAGE_RE, SONG_ID_RE } from "./constants.js";
import { CasConflictError, HttpError, errorResponse, jsonError } from "./errors.js";
import { adminHeaders, readJsonBody } from "./http.js";
import { assertCsrfAndOrigin, createCsrfToken, csrfCookie } from "./csrf.js";
import { catalogConfig } from "./config.js";
import { createAdminSessionCookie, requireAdminAccess, sharedSecretConfigured, verifySharedSecret } from "./access.js";
import { previewCatalog } from "./preview.js";
import { publishCatalog } from "./publish.js";
import { validateLanguageInput, validateSongInput, validateDraftUrls, compareIdentity } from "./validate.js";
import { adminAppJs, adminCss, adminHtml } from "../admin/ui.js";
import { unlockHtml } from "../admin/unlock.js";

function jsonOk(data, request, extra = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: adminHeaders({ "content-type": "application/json; charset=utf-8", ...extra }),
  });
}

function languageDto(row) {
  return {
    code: row.code,
    nameFa: row.name_fa,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    active: row.active === 1,
  };
}

function songDto(row) {
  return {
    songId: row.song_id,
    targetLanguage: row.language_code,
    title: row.title,
    artist: row.artist,
    manifestUrl: row.manifest_url,
    coverUrl: row.cover_url || "",
    level: row.level || "",
    durationMs: row.duration_ms,
    sortOrder: row.sort_order,
    visible: row.visible === 1,
  };
}

async function guardMutation(request, env, store) {
  await requireAdminAccess(request, env);
  assertCsrfAndOrigin(request, env);
  const body = await readJsonBody(request);
  return body;
}

export async function handleAdminRequest(request, { store, env }) {
  try {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/admin" : url.pathname;

    if (request.method === "GET" && (path === "/admin" || path === "/admin/")) {
      try {
        await requireAdminAccess(request, env);
      } catch (error) {
        if (sharedSecretConfigured(env) && (error.status === 401 || error.status === 403)) {
          return new Response(unlockHtml(), {
            headers: adminHeaders({ "content-type": "text/html; charset=utf-8" }),
          });
        }
        throw error;
      }
      return new Response(adminHtml(), {
        headers: adminHeaders({ "content-type": "text/html; charset=utf-8" }),
      });
    }
    if (request.method === "GET" && path === "/admin/app.css") {
      return new Response(adminCss(), {
        headers: adminHeaders({ "content-type": "text/css; charset=utf-8" }),
      });
    }
    if (request.method === "POST" && path === "/admin/v1/unlock") {
      if (!sharedSecretConfigured(env)) {
        throw new HttpError(403, "access_denied", "Admin shared secret is not configured");
      }
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer") || "";
      const expected = catalogConfig(env).adminOrigin;
      if (!expected || (origin !== expected && !referer.startsWith(`${expected}/`) && referer !== expected)) {
        throw new HttpError(403, "bad_origin", "Origin does not match ADMIN_ORIGIN");
      }
      const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      let secret = "";
      if (type === "application/x-www-form-urlencoded") {
        const raw = await request.text();
        secret = new URLSearchParams(raw).get("secret") || "";
      } else {
        const body = await readJsonBody(request);
        secret = body.secret || "";
      }
      await verifySharedSecret(secret, env);
      const location = `${expected}/admin`;
      return new Response(null, {
        status: 303,
        headers: adminHeaders({
          location,
          "set-cookie": await createAdminSessionCookie(request, env),
        }),
      });
    }
    if (request.method === "GET" && path === "/admin/app.js") {
      await requireAdminAccess(request, env);
      return new Response(adminAppJs(), {
        headers: adminHeaders({ "content-type": "application/javascript; charset=utf-8" }),
      });
    }

    if (request.method === "GET" && path === "/admin/v1/csrf") {
      await requireAdminAccess(request, env);
      const token = createCsrfToken();
      return jsonOk({ csrfToken: token }, request, { "set-cookie": csrfCookie(token, request) });
    }

    if (request.method === "GET" && path === "/admin/v1/state") {
      await requireAdminAccess(request, env);
      const state = await store.getState();
      const config = catalogConfig(env);
      return jsonOk({
        draftRevision: state.draft_revision,
        publishedRevision: state.published_revision,
        catalogKeyId: config.catalogKeyId,
        supportedLanguages: [...config.supportedLanguages],
        manifestHosts: [...config.manifestHosts],
        coverHosts: [...config.coverHosts],
      });
    }

    if (request.method === "GET" && path === "/admin/v1/languages") {
      await requireAdminAccess(request, env);
      return jsonOk({ languages: (await store.listLanguages()).map(languageDto) });
    }

    if (request.method === "GET" && path === "/admin/v1/songs") {
      await requireAdminAccess(request, env);
      return jsonOk({ songs: (await store.listSongs()).map(songDto) });
    }

    if (request.method === "GET" && path === "/admin/v1/preview") {
      await requireAdminAccess(request, env);
      return jsonOk(await previewCatalog(store));
    }

    const languageMatch = path.match(/^\/admin\/v1\/languages\/([a-z]{2,3})$/);
    const songMatch = path.match(/^\/admin\/v1\/songs\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);

    if (languageMatch && LANGUAGE_RE.test(languageMatch[1]) && request.method === "GET") {
      await requireAdminAccess(request, env);
      const row = await store.getLanguage(languageMatch[1]);
      if (!row) throw new HttpError(404, "not_found", "Language not found");
      return jsonOk({ language: languageDto(row) });
    }

    if (songMatch && SONG_ID_RE.test(songMatch[1]) && request.method === "GET") {
      await requireAdminAccess(request, env);
      const row = await store.getSong(songMatch[1]);
      if (!row) throw new HttpError(404, "not_found", "Song not found");
      return jsonOk({ song: songDto(row) });
    }

    if (languageMatch && request.method === "PUT") {
      const body = await guardMutation(request, env, store);
      const row = validateLanguageInput(body, languageMatch[1]);
      row.updated_at = new Date().toISOString();
      const identity = await store.getIdentity("language", row.code);
      compareIdentity(identity, { kind: "language", id: row.code });
      const state = await store.upsertLanguage(row);
      return jsonOk({ language: languageDto(row), draftRevision: state.draft_revision });
    }

    if (languageMatch && request.method === "DELETE") {
      await guardMutation(request, env, store);
      const state = await store.deleteLanguage(languageMatch[1]);
      return jsonOk({ deleted: languageMatch[1], draftRevision: state.draft_revision });
    }

    if (songMatch && request.method === "PUT") {
      const body = await guardMutation(request, env, store);
      const config = catalogConfig(env);
      const row = validateSongInput(body, songMatch[1]);
      validateDraftUrls(row, config, env);
      row.updated_at = new Date().toISOString();
      const identity = await store.getIdentity("song", row.song_id);
      compareIdentity(identity, { kind: "song", id: row.song_id, language_code: row.language_code, manifest_url: row.manifest_url });
      const state = await store.upsertSong(row);
      return jsonOk({ song: songDto(row), draftRevision: state.draft_revision });
    }

    if (songMatch && request.method === "DELETE") {
      await guardMutation(request, env, store);
      const state = await store.deleteSong(songMatch[1]);
      return jsonOk({ deleted: songMatch[1], draftRevision: state.draft_revision });
    }

    if (path === "/admin/v1/publish" && request.method === "POST") {
      const body = await guardMutation(request, env, store);
      const matchHeader = request.headers.get("if-match");
      const draftRevision = body.draftRevision;
      if (matchHeader) {
        const expected = Number(String(matchHeader).replace(/"/g, "").replace("draft-revision-", ""));
        if (expected !== draftRevision) throw new CasConflictError("If-Match does not match draftRevision");
      }
      const result = await publishCatalog(store, env, {
        draftRevision,
        confirmHostFilesVerified: body.confirmHostFilesVerified,
      });
      return jsonOk(result);
    }

    if (path === "/admin/v1/publish-offline" && request.method === "POST") {
      await guardMutation(request, env, store);
      throw new HttpError(501, "offline_signing_scope", "Offline envelope ingest is a separate agreed scope; use online publish with CATALOG_SIGNING_PKCS8 or keep signing keys off Cloudflare by not deploying admin secrets");
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      await requireAdminAccess(request, env);
      throw new HttpError(404, "not_found", "Unknown admin mutation");
    }

    await requireAdminAccess(request, env);
    return jsonError(404, "not_found", "Not found");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      const accept = request.headers.get("accept") || "";
      if (accept.includes("text/html")) {
        return new Response("<!doctype html><meta charset=utf-8><title>403</title><p>Access denied.</p>", {
          status: 403,
          headers: adminHeaders({ "content-type": "text/html; charset=utf-8" }),
        });
      }
    }
    return errorResponse(error);
  }
}
