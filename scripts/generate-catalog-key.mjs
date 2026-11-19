#!/usr/bin/env node
// Generates a catalog-only Ed25519 key. Never commit the private key.
// This is independent of the Windows/Android pack manifest key (sig-).

import { writeFileSync } from "node:fs";

const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
const raw32 = spki.slice(-32);
const rand = new Uint8Array(4);
crypto.getRandomValues(rand);
const keyId = `cat-${[...rand].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const b64 = btoa(String.fromCharCode(...pkcs8));
const pem = `-----BEGIN PRIVATE KEY-----\n${(b64.match(/.{1,64}/g) || []).join("\n")}\n-----END PRIVATE KEY-----\n`;
const pub = btoa(String.fromCharCode(...raw32)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

writeFileSync("catalog-signing.pem", pem, { encoding: "utf8" });
writeFileSync(
  "catalog-public.txt",
  `catalogKeyId=${keyId}\ned25519PublicKeyBase64url=${pub}\n`,
  { encoding: "utf8" },
);

console.log(`# TEST KEYS ARE FORBIDDEN IN RELEASE.
# PEM written to catalog-signing.pem (gitignored). Do not paste it in chat.
# Public values written to catalog-public.txt — pin those in the Android APK.

catalogKeyId=${keyId}
ed25519PublicKeyBase64url=${pub}

# PowerShell (from the inner repo folder):
#   npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml --from-file catalog-signing.pem
# If --from-file is unknown:
#   Get-Content -Raw .\\catalog-signing.pem | npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml
`);
