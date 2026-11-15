import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminRequest } from "../src/lib/admin-api.js";
import { handlePublicRequest } from "../src/lib/public-api.js";
import { admin, createStore, makeAccessBundle, testEnv } from "./helpers.mjs";
import { parseJsonStrict } from "../src/lib/json.js";

test("admin rejects multipart, files, lyrics, unknown fields and does not bump draft", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  const before = (await store.getState()).draft_revision;
  const multipart = await handleAdminRequest(new Request("http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT",
    headers: {
      origin: env.ADMIN_ORIGIN,
      "x-csrf-token": session.csrf,
      cookie: session.cookie,
      "content-type": "multipart/form-data; boundary=x",
    },
    body: "--x\r\nContent-Disposition: form-data; name=file; filename=a.mp3\r\n\r\nDATA\r\n--x--",
  }), { store, env });
  assert.equal(multipart.status, 415);
  const lyrics = await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT", session,
    json: { songId: "quiet-step", targetLanguage: "en", title: "x", artist: "y", manifestUrl: "https://content.example.invalid/a/latest.json", sortOrder: 1, visible: true, lyrics: "secret" },
  });
  assert.equal(lyrics.response.status, 400);
  const unknown = await admin(store, env, "http://admin.test/admin/v1/languages/en", {
    method: "PUT", session,
    json: { code: "en", nameFa: "ا", nameEn: "E", sortOrder: 1, active: true, extra: 1 },
  });
  assert.equal(unknown.response.status, 400);
  assert.equal((await store.getState()).draft_revision, before);
});

test("CSRF and Origin are required; cookies are not accepted from another origin", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  const noOrigin = await handleAdminRequest(new Request("http://admin.test/admin/v1/languages/en", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-csrf-token": session.csrf, cookie: session.cookie },
    body: JSON.stringify({ code: "en", nameFa: "ا", nameEn: "E", sortOrder: 1, active: true }),
  }), { store, env });
  assert.equal(noOrigin.status, 403);
  const badOrigin = await handleAdminRequest(new Request("http://admin.test/admin/v1/languages/en", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "https://evil.invalid", "x-csrf-token": session.csrf, cookie: session.cookie },
    body: JSON.stringify({ code: "en", nameFa: "ا", nameEn: "E", sortOrder: 1, active: true }),
  }), { store, env });
  assert.equal(badOrigin.status, 403);
});

test("production admin is fail-closed without Access and rejects handmade headers / local bypass", async () => {
  const store = createStore();
  const closed = await handleAdminRequest(new Request("http://admin.test/admin/v1/state"), {
    store, env: { ENVIRONMENT: "production", ADMIN_ORIGIN: "http://admin.test" },
  });
  assert.equal(closed.status, 403);
  const spoof = await handleAdminRequest(new Request("http://admin.test/admin/v1/state", {
    headers: { "cf-access-authenticated-user-email": "owner@example.com" },
  }), { store, env: { ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1", ACCESS_ALLOWED_EMAILS: "owner@example.com", fetchJwks: async () => ({ keys: [] }) } });
  assert.equal(spoof.status, 403);
  const bypass = await handleAdminRequest(new Request("http://admin.test/admin/v1/state"), {
    store, env: { ENVIRONMENT: "production", ALLOW_LOCAL_ADMIN: "true" },
  });
  assert.equal(bypass.status, 403);
});

test("Access JWT with matching issuer/audience/email is accepted; wrong email is 403", async () => {
  const store = createStore();
  const access = makeAccessBundle();
  const env = testEnv({ ...access.env, ALLOW_LOCAL_ADMIN: "false", CATALOG_KEY_ID: "cat-prod-aaaa" });
  const ok = await handleAdminRequest(new Request("http://admin.test/admin/v1/state", {
    headers: { "cf-access-jwt-assertion": access.jwt },
  }), { store, env });
  assert.equal(ok.status, 200);
  const other = makeAccessBundle();
  other.env.ACCESS_ALLOWED_EMAILS = "someone-else@example.com";
  const denied = await handleAdminRequest(new Request("http://admin.test/admin/v1/state", {
    headers: { "cf-access-jwt-assertion": other.jwt },
  }), { store, env: testEnv({ ...other.env, ALLOW_LOCAL_ADMIN: "false" }) });
  assert.equal(denied.status, 403);
});

test("test catalog key and example.invalid hosts cannot be published in production", async () => {
  const store = createStore();
  const env = testEnv({ ENVIRONMENT: "production", ALLOW_LOCAL_ADMIN: "false" });
  const access = makeAccessBundle();
  Object.assign(env, access.env);
  env.CATALOG_KEY_ID = "cat-test-v1";
  env.ADMIN_ORIGIN = "http://admin.test";
  const csrf = await handleAdminRequest(new Request("http://admin.test/admin/v1/csrf", {
    headers: { "cf-access-jwt-assertion": access.jwt },
  }), { store, env });
  const { csrfToken } = await csrf.json();
  const cookie = `reedance_csrf=${(csrf.headers.get("set-cookie") || "").split(";")[0].split("=")[1]}`;
  const put = await handleAdminRequest(new Request("http://admin.test/admin/v1/languages/en", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: env.ADMIN_ORIGIN,
      "x-csrf-token": csrfToken,
      cookie,
      "cf-access-jwt-assertion": access.jwt,
    },
    body: JSON.stringify({ code: "en", nameFa: "انگلیسی", nameEn: "English", sortOrder: 1, active: true }),
  }), { store, env });
  assert.equal(put.status, 200);
  const publish = await handleAdminRequest(new Request("http://admin.test/admin/v1/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.ADMIN_ORIGIN,
      "x-csrf-token": csrfToken,
      cookie,
      "cf-access-jwt-assertion": access.jwt,
    },
    body: JSON.stringify({ draftRevision: 1, confirmHostFilesVerified: true }),
  }), { store, env });
  assert.equal(publish.status, 403);
});

test("strict JSON rejects duplicates and public worker never exposes draft", async () => {
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'));
  assert.throws(() => parseJsonStrict('\uFEFF{"a":1}'));
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await admin(store, env, "http://admin.test/admin/v1/languages/en", {
    method: "PUT", session,
    json: { code: "en", nameFa: "انگلیسی", nameEn: "English", sortOrder: 1, active: true },
  });
  const leaked = await handlePublicRequest(new Request("http://catalog.test/v1/languages"), {
    store, ctx: { waitUntil() {} },
  });
  assert.equal(leaked.status, 503);
  const body = await leaked.json();
  assert.equal(body.error, "unavailable");
  assert.equal("languages" in body, false);
});

test("admin responses are no-store and HTML/JS are Access-gated", async () => {
  const store = createStore();
  const env = testEnv();
  const page = await handleAdminRequest(new Request("http://admin.test/admin"), { store, env });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
  const closed = await handleAdminRequest(new Request("http://admin.test/admin"), {
    store, env: { ENVIRONMENT: "production" },
  });
  assert.equal(closed.status, 403);
});
