import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryStore } from "../src/lib/store-memory.js";
import { handleAdminRequest } from "../src/lib/admin-api.js";
import { handlePublicRequest } from "../src/lib/public-api.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const fixturesDir = path.join(root, "contracts/catalog/v1/fixtures");
export const readFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, `${name}.test.json`), "utf8"));

const seed = Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex");
export const TEST_PKCS8_DER = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
export const TEST_PKCS8_PEM = `-----BEGIN PRIVATE KEY-----\n${TEST_PKCS8_DER.toString("base64")}\n-----END PRIVATE KEY-----`;
export const TEST_PUBLIC = readFixture("public-key");

export function createMemoryCache() {
  const map = new Map();
  return {
    async match(req) {
      const hit = map.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req, res) {
      map.set(req.url, res.clone());
    },
  };
}

export function testEnv(overrides = {}) {
  return {
    ENVIRONMENT: "development",
    ALLOW_LOCAL_ADMIN: "true",
    ADMIN_ORIGIN: "http://admin.test",
    CATALOG_KEY_ID: "cat-test-v1",
    CATALOG_SIGNING_PKCS8: TEST_PKCS8_PEM,
    ALLOWED_MANIFEST_HOSTS: "content.example.invalid",
    ALLOWED_COVER_HOSTS: "content.example.invalid",
    SUPPORTED_LANGUAGE_CODES: "en,es,ko",
    PRETTY_PAYLOAD: "true",
    NOW: "2026-11-13T00:00:00Z",
    ...overrides,
  };
}

export function makeAccessBundle() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-kid";
  jwk.alg = "RS256";
  jwk.kty = "RSA";
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-kid" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://team.cloudflareaccess.com",
    aud: "aud-1",
    email: "owner@example.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  const data = `${header}.${payload}`;
  const jwt = `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
  return {
    jwt,
    env: {
      ENVIRONMENT: "production",
      ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      ACCESS_AUD: "aud-1",
      ACCESS_ALLOWED_EMAILS: "owner@example.com",
      fetchJwks: async () => ({ keys: [jwk] }),
    },
  };
}

export async function csrfSession(store, env) {
  const res = await handleAdminRequest(new Request("http://admin.test/admin/v1/csrf"), { store, env });
  const body = await res.json();
  const cookie = res.headers.get("set-cookie") || "";
  const token = cookie.split(";")[0].split("=")[1];
  return { csrf: body.csrfToken, cookie: `reedance_csrf=${token}` };
}

export function adminRequest(url, { method = "GET", json, csrf, cookie, env, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    headers.origin = env.ADMIN_ORIGIN;
    headers["x-csrf-token"] = csrf;
    headers.cookie = cookie;
  }
  return new Request(url, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
}

export async function admin(store, env, url, options = {}) {
  const session = options.session || await csrfSession(store, env);
  const request = adminRequest(url, { ...options, csrf: session.csrf, cookie: session.cookie, env });
  const response = await handleAdminRequest(request, { store, env });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, session };
}

export async function pub(store, url, { cache, headers } = {}) {
  const request = new Request(url, { headers });
  const response = await handlePublicRequest(request, { store, ctx: { waitUntil() {} }, cache: cache || createMemoryCache() });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

export function createStore() {
  return createMemoryStore();
}

export const quietStep = {
  songId: "quiet-step",
  targetLanguage: "en",
  title: "Quiet Step (TEST ONLY)",
  artist: "Reedance Contract Tests",
  manifestUrl: "https://content.example.invalid/reedance/en/quiet-step/latest.json",
  coverUrl: "https://content.example.invalid/art/quiet-step.webp",
  level: "A1",
  durationMs: 4000,
  sortOrder: 1,
  visible: true,
};

export async function seedLanguages(store, env, session) {
  await admin(store, env, "http://admin.test/admin/v1/languages/en", {
    method: "PUT", session,
    json: { code: "en", nameFa: "انگلیسی", nameEn: "English", sortOrder: 1, active: true },
  });
  await admin(store, env, "http://admin.test/admin/v1/languages/es", {
    method: "PUT", session,
    json: { code: "es", nameFa: "اسپانیایی", nameEn: "Spanish", sortOrder: 2, active: true },
  });
}
