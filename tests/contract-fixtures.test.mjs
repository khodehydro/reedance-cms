import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { importCatalogPublicKey, signPayloadObject, verifyEnvelope, catalogMessage } from "../src/lib/sign.js";
import { importCatalogPrivateKey } from "../src/lib/sign.js";
import { fromBase64Url, utf8Encode } from "../src/lib/bytes.js";
import { TEST_PKCS8_PEM, TEST_PUBLIC, readFixture } from "./helpers.mjs";

async function verified(name, kind, language) {
  const envelope = readFixture(`${name}-envelope`);
  const payload = readFixture(`${name}-payload`);
  const publicKey = await importCatalogPublicKey(TEST_PUBLIC.ed25519PublicKeyBase64url);
  assert.equal(await verifyEnvelope(envelope, publicKey), true);
  const bytes = fromBase64Url(envelope.payload, 128 * 1024);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)), payload);
  assert.equal(payload.kind, kind);
  if (language) assert.equal(payload.language, language);
  return { envelope, payload, bytes };
}

test("fixture signatures match catalog-only Ed25519 domain and public test key", async () => {
  assert.equal(TEST_PUBLIC.testOnly, true);
  assert.equal(TEST_PUBLIC.catalogKeyId, "cat-test-v1");
  const languages = await verified("languages", "languages");
  const r1 = await verified("songs-en-r1", "songs", "en");
  const es = await verified("songs-es-r1", "songs", "es");
  const r2 = await verified("songs-en-r2", "songs", "en");
  assert.deepEqual(es.payload.songs, []);
  assert.equal(es.payload.revision, languages.payload.revision);
  assert.deepEqual(r1.payload.songs.map((s) => s.songId), ["quiet-step"]);
  assert.deepEqual(r2.payload.songs.map((s) => s.songId), ["quiet-step", "new-track"]);
  const privateKey = await importCatalogPrivateKey(TEST_PKCS8_PEM);
  const reproduced = await signPayloadObject(privateKey, "cat-test-v1", languages.payload, true);
  assert.deepEqual(reproduced, languages.envelope);
});

test("tampering, padding, domain confusion and extra fields fail verification", async () => {
  const { envelope, bytes } = await verified("songs-en-r1", "songs", "en");
  const publicKey = await importCatalogPublicKey(TEST_PUBLIC.ed25519PublicKeyBase64url);
  const mutated = { ...envelope, payload: envelope.payload };
  const changed = new Uint8Array(bytes);
  changed[20] ^= 1;
  assert.equal(await verifyEnvelope({ ...envelope, payload: Buffer.from(changed).toString("base64url") }, publicKey), false);
  assert.equal(await verifyEnvelope({ ...envelope, payload: `${envelope.payload}=` }, publicKey), false);
  const wrongDomain = catalogMessage("cat-other", bytes);
  assert.notEqual(wrongDomain.length, 0);
  assert.equal(await verifyEnvelope({ ...envelope, catalogKeyId: "cat-other" }, publicKey), false);
  assert.equal("audio" in readFixture("songs-en-r1-payload").songs[0], false);
});

test("rollback rule: lower revision or same revision with different payload is rejected", async () => {
  const r1 = await verified("songs-en-r1", "songs", "en");
  const r2 = await verified("songs-en-r2", "songs", "en");
  const seen = { revision: r2.payload.revision, sha: createHash("sha256").update(r2.bytes).digest("hex") };
  const accept = (snap) => snap.payload.revision > seen.revision
    || (snap.payload.revision === seen.revision && createHash("sha256").update(snap.bytes).digest("hex") === seen.sha);
  assert.equal(accept(r1), false);
  assert.equal(accept(r2), true);
  const alt = utf8Encode(`${JSON.stringify({ ...r2.payload, publishedAt: "2026-11-13T02:00:00Z" })}\n`);
  assert.equal(accept({ payload: r2.payload, bytes: alt }), false);
});
