#!/usr/bin/env node
// Generates a catalog-only Ed25519 key. Never commit the private key.
// This is independent of the Windows/Android pack manifest key (sig-).

const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
const raw32 = spki.slice(-32);
const rand = new Uint8Array(4);
crypto.getRandomValues(rand);
const keyId = `cat-${[...rand].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const b64 = btoa(String.fromCharCode(...pkcs8));
const pem = `-----BEGIN PRIVATE KEY-----\n${(b64.match(/.{1,64}/g) || []).join("\n")}\n-----END PRIVATE KEY-----`;
const pub = btoa(String.fromCharCode(...raw32)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

console.log(`# TEST KEYS ARE FORBIDDEN IN RELEASE.
# Keep the PEM off git, chat, the public Worker, and the admin HTML.
# Pin the public key + catalogKeyId in the Android APK through a side channel.

catalogKeyId=${keyId}
ed25519PublicKeyBase64url=${pub}

# wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml
# Paste the PEM below (or the base64 DER).

${pem}
`);
