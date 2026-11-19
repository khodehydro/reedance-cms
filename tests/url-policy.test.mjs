import test from "node:test";
import assert from "node:assert/strict";
import { decodePkcs8 } from "../src/lib/bytes.js";
import { catalogConfig, resolveCatalogKeyId } from "../src/lib/config.js";
import { importCatalogPrivateKey } from "../src/lib/sign.js";
import { assertCoverUrl, assertManifestUrl, parseCanonicalHttpsUrl } from "../src/lib/url.js";
import { TEST_PKCS8_DER, TEST_PKCS8_PEM } from "./helpers.mjs";

const hosts = new Set(["content.example.invalid"]);

test("canonical HTTPS owner-host URLs are accepted; tricks are rejected", () => {
  const ok = "https://content.example.invalid/reedance/en/quiet-step/latest.json";
  assert.equal(assertManifestUrl(ok, hosts).href, ok);
  assertCoverUrl("https://content.example.invalid/art/quiet-step.webp", hosts);
  const bad = [
    "http://content.example.invalid/reedance/en/quiet-step/latest.json",
    "https://evil.invalid/reedance/en/quiet-step/latest.json",
    "https://user@content.example.invalid/reedance/en/quiet-step/latest.json",
    "https://content.example.invalid/reedance/en/quiet-step/latest.json?token=1",
    "https://content.example.invalid/reedance/en/quiet-step/latest.json#part",
    "https://content.example.invalid/reedance/en/%2fquiet-step/latest.json",
    "https://content.example.invalid/reedance//en/quiet-step/latest.json",
    "https://content.example.invalid:443/reedance/en/quiet-step/latest.json",
    "https://127.0.0.1/reedance/en/quiet-step/latest.json",
    "https://content.example.invalid/reedance/en/quiet-step/latest.json/extra",
  ];
  for (const url of bad) {
    assert.throws(() => assertManifestUrl(url, hosts));
  }
  assert.throws(() => assertCoverUrl("https://images.evil.invalid/cover.webp", hosts));
  assert.throws(() => parseCanonicalHttpsUrl("https://content.example.invalid/./x/latest.json"));
});

test("placeholder CATALOG_KEY_ID maps to cat-reedance-1", () => {
  assert.equal(resolveCatalogKeyId({ CATALOG_KEY_ID: "cat-REPLACE_ME" }), "cat-reedance-1");
  assert.equal(resolveCatalogKeyId({ CATALOG_KEY_ID: "  cat-reedance-1  " }), "cat-reedance-1");
  assert.equal(catalogConfig({ CATALOG_KEY_ID: "cat-REPLACE_ME" }).catalogKeyId, "cat-reedance-1");
  assert.equal(catalogConfig({ CATALOG_KEY_ID: "cat-test-v1" }).catalogKeyId, "cat-test-v1");
});

test("PKCS8 PEM is extracted even when the secret includes gen:key comments", async () => {
  const messy = `# keep off git\ncatalogKeyId=cat-abcd\n\n${TEST_PKCS8_PEM}\n`;
  const der = decodePkcs8(messy);
  assert.equal(der.byteLength, TEST_PKCS8_DER.length);
  await importCatalogPrivateKey(messy);
});
