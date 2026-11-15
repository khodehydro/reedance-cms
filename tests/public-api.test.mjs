import test from "node:test";
import assert from "node:assert/strict";
import { admin, createMemoryCache, createStore, pub, quietStep, readFixture, seedLanguages, testEnv } from "./helpers.mjs";

async function publishR1(store, env, session) {
  await seedLanguages(store, env, session);
  await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT", session, json: quietStep,
  });
  const state = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  return admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: state.body.draftRevision, confirmHostFilesVerified: true },
  });
}

test("public GET serves fixture-identical signed envelopes and empty Spanish list", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  const published = await publishR1(store, env, session);
  assert.equal(published.response.status, 200);
  assert.equal(published.body.publishedRevision, 1);

  const languages = await pub(store, "http://catalog.test/v1/languages");
  assert.equal(languages.response.status, 200);
  assert.equal(languages.response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.match(languages.response.headers.get("cache-control"), /s-maxage=300/);
  assert.deepEqual(languages.body, readFixture("languages-envelope"));

  const en = await pub(store, "http://catalog.test/v1/languages/en/songs");
  assert.deepEqual(en.body, readFixture("songs-en-r1-envelope"));
  const es = await pub(store, "http://catalog.test/v1/languages/es/songs");
  assert.deepEqual(es.body, readFixture("songs-es-r1-envelope"));
  assert.deepEqual(JSON.parse(Buffer.from(es.body.payload, "base64url").toString("utf8")).songs, []);
});

test("public API is GET-only, rejects queries and unknown paths, 404s inactive languages", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await publishR1(store, env, session);
  const post = await handleMethod(store, "POST", "http://catalog.test/v1/languages");
  assert.equal(post.status, 405);
  const query = await pub(store, "http://catalog.test/v1/languages?x=1");
  assert.equal(query.response.status, 400);
  const ko = await pub(store, "http://catalog.test/v1/languages/ko/songs");
  assert.equal(ko.response.status, 404);
  const tr = await pub(store, "http://catalog.test/v1/languages/tr/songs");
  assert.equal(tr.response.status, 404);
  const extra = await pub(store, "http://catalog.test/v1/languages/en/songs/quiet-step");
  assert.equal(extra.response.status, 404);
});

test("ETag 304, Cache-Control no-cache bypass, and D1 failure 503", async () => {
  const store = createStore();
  const env = testEnv();
  const cache = createMemoryCache();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await publishR1(store, env, session);
  const first = await pub(store, "http://catalog.test/v1/languages", { cache });
  const etag = first.response.headers.get("etag");
  assert.match(etag, /^"sha256-[0-9a-f]{64}"$/);
  const cached = await pub(store, "http://catalog.test/v1/languages", { cache });
  assert.equal(cached.response.status, 200);
  const none = await pub(store, "http://catalog.test/v1/languages", { cache, headers: { "if-none-match": etag } });
  assert.equal(none.response.status, 304);
  assert.equal(none.text, "");
  store.failNextReads(1);
  const bypass = await pub(store, "http://catalog.test/v1/languages", { cache, headers: { "cache-control": "no-cache" } });
  assert.equal(bypass.response.status, 503);
  store.failNextReads(1);
  const miss = await pub(store, "http://catalog.test/v1/languages/en/songs", { headers: { "cache-control": "no-cache" } });
  assert.equal(miss.response.status, 503);
});

test("unpublished catalog is 503 and draft edits do not change public snapshots", async () => {
  const store = createStore();
  const env = testEnv();
  const empty = await pub(store, "http://catalog.test/v1/languages");
  assert.equal(empty.response.status, 503);
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await publishR1(store, env, session);
  await admin(store, env, "http://admin.test/admin/v1/languages/en", {
    method: "PUT", session,
    json: { code: "en", nameFa: "انگلیسی تازه", nameEn: "English", sortOrder: 1, active: true },
  });
  const languages = await pub(store, "http://catalog.test/v1/languages");
  assert.deepEqual(languages.body, readFixture("languages-envelope"));
});

async function handleMethod(store, method, url) {
  const { handlePublicRequest } = await import("../src/lib/public-api.js");
  return handlePublicRequest(new Request(url, { method }), { store, ctx: { waitUntil() {} }, cache: createMemoryCache() });
}
