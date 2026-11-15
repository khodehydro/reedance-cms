import test from "node:test";
import assert from "node:assert/strict";
import { assertCoverUrl, assertManifestUrl, parseCanonicalHttpsUrl } from "../src/lib/url.js";

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
