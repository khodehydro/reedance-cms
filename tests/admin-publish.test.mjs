import test from "node:test";
import assert from "node:assert/strict";
import { admin, createStore, pub, quietStep, readFixture, seedLanguages, testEnv } from "./helpers.mjs";

test("publish r1 then r2 adds new-track only for English and matches fixtures", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await seedLanguages(store, env, session);
  await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", { method: "PUT", session, json: quietStep });
  const s1 = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: s1.body.draftRevision, confirmHostFilesVerified: true },
  });
  env.NOW = "2026-11-13T01:00:00Z";
  await admin(store, env, "http://admin.test/admin/v1/songs/new-track", {
    method: "PUT", session,
    json: {
      songId: "new-track", targetLanguage: "en", title: "New Track (TEST ONLY)",
      artist: "Reedance Contract Tests",
      manifestUrl: "https://content.example.invalid/reedance/en/new-track/latest.json",
      sortOrder: 2, visible: true,
    },
  });
  const s2 = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  const published = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: s2.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal(published.body.publishedRevision, 2);
  const en = await pub(store, "http://catalog.test/v1/languages/en/songs");
  assert.deepEqual(en.body, readFixture("songs-en-r2-envelope"));
  const es = await pub(store, "http://catalog.test/v1/languages/es/songs");
  const esPayload = JSON.parse(Buffer.from(es.body.payload, "base64url").toString("utf8"));
  assert.deepEqual(esPayload.songs, []);
  assert.equal(esPayload.revision, 2);
});

test("CAS 409 on stale draft, missing confirmation, and concurrent publish", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await seedLanguages(store, env, session);
  const state = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  const stale = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: state.body.draftRevision - 1, confirmHostFilesVerified: true },
  });
  assert.equal(stale.response.status, 409);
  const unconfirmed = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: state.body.draftRevision, confirmHostFilesVerified: false },
  });
  assert.equal(unconfirmed.response.status, 400);
  const ok = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session,
    json: { draftRevision: state.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal(ok.response.status, 200);
  await assert.rejects(
    () => store.publishAtomic({
      expectedDraft: state.body.draftRevision,
      expectedPublished: 0,
      nextRevision: 1,
      snapshots: [],
      deleteScopes: [],
      identities: [],
      publishedAt: env.NOW,
    }),
    (error) => error.status === 409,
  );
});

test("published songId/language/manifestUrl are immutable; hide instead of delete", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await seedLanguages(store, env, session);
  await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", { method: "PUT", session, json: quietStep });
  const state = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session, json: { draftRevision: state.body.draftRevision, confirmHostFilesVerified: true },
  });
  const moved = await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT", session,
    json: { ...quietStep, targetLanguage: "es" },
  });
  assert.equal(moved.response.status, 409);
  const url = await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT", session,
    json: { ...quietStep, manifestUrl: "https://content.example.invalid/other/latest.json" },
  });
  assert.equal(url.response.status, 409);
  const del = await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "DELETE", session, json: {},
  });
  assert.equal(del.response.status, 409);
  const hidden = await admin(store, env, "http://admin.test/admin/v1/songs/quiet-step", {
    method: "PUT", session, json: { ...quietStep, visible: false, title: "Quiet Step (hidden)" },
  });
  assert.equal(hidden.response.status, 200);
});

test("deactivating a language removes its public snapshot (404) without serving draft", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await seedLanguages(store, env, session);
  const s1 = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session, json: { draftRevision: s1.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal((await pub(store, "http://catalog.test/v1/languages/es/songs")).response.status, 200);
  await admin(store, env, "http://admin.test/admin/v1/languages/es", {
    method: "PUT", session,
    json: { code: "es", nameFa: "اسپانیایی", nameEn: "Spanish", sortOrder: 2, active: false },
  });
  const s2 = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session, json: { draftRevision: s2.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal((await pub(store, "http://catalog.test/v1/languages/es/songs")).response.status, 404);
});

test("100 visible songs for one language publish under the v1 cap", async () => {
  const store = createStore();
  const env = testEnv();
  const { session } = await admin(store, env, "http://admin.test/admin/v1/csrf");
  await seedLanguages(store, env, session);
  for (let i = 0; i < 100; i += 1) {
    const id = `track-${String(i).padStart(3, "0")}`;
    const result = await admin(store, env, `http://admin.test/admin/v1/songs/${id}`, {
      method: "PUT", session,
      json: {
        songId: id, targetLanguage: "en", title: `T${i}`, artist: "Tests",
        manifestUrl: `https://content.example.invalid/reedance/en/${id}/latest.json`,
        sortOrder: i, visible: true,
      },
    });
    assert.equal(result.response.status, 200);
  }
  const extra = await admin(store, env, "http://admin.test/admin/v1/songs/track-100", {
    method: "PUT", session,
    json: {
      songId: "track-100", targetLanguage: "en", title: "T100", artist: "Tests",
      manifestUrl: "https://content.example.invalid/reedance/en/track-100/latest.json",
      sortOrder: 100, visible: true,
    },
  });
  assert.equal(extra.response.status, 200);
  const state = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  const published = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session, json: { draftRevision: state.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal(published.response.status, 400);
  await admin(store, env, "http://admin.test/admin/v1/songs/track-100", {
    method: "PUT", session,
    json: {
      songId: "track-100", targetLanguage: "en", title: "T100", artist: "Tests",
      manifestUrl: "https://content.example.invalid/reedance/en/track-100/latest.json",
      sortOrder: 100, visible: false,
    },
  });
  const state2 = await admin(store, env, "http://admin.test/admin/v1/state", { session });
  const ok = await admin(store, env, "http://admin.test/admin/v1/publish", {
    method: "POST", session, json: { draftRevision: state2.body.draftRevision, confirmHostFilesVerified: true },
  });
  assert.equal(ok.response.status, 200);
  const en = await pub(store, "http://catalog.test/v1/languages/en/songs");
  const payload = JSON.parse(Buffer.from(en.body.payload, "base64url").toString("utf8"));
  assert.equal(payload.songs.length, 100);
});
