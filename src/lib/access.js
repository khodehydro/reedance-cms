import { catalogConfig } from "./config.js";
import { HttpError } from "./errors.js";
import { bytesEqual, fromBase64Url, toBase64Url, utf8Decode, utf8Encode } from "./bytes.js";
import { cookieValue } from "./csrf.js";

const jwksCache = new Map();

function b64urlToJson(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(utf8Decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
}

async function importRsaJwk(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function loadJwks(env, team) {
  if (typeof env.fetchJwks === "function") return env.fetchJwks();
  const cached = jwksCache.get(team);
  if (cached && cached.exp > Date.now()) return cached.keys;
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) throw new HttpError(403, "access_jwks", "Access JWKS unavailable");
  const body = await response.json();
  jwksCache.set(team, { keys: body, exp: Date.now() + 60 * 60 * 1000 });
  return body;
}

export async function verifyAccessJwt(token, env) {
  const config = catalogConfig(env);
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(403, "access_denied", "Invalid Access assertion");
  const header = b64urlToJson(parts[0]);
  const payload = b64urlToJson(parts[1]);
  if (header.alg !== "RS256") throw new HttpError(403, "access_denied", "Unsupported Access algorithm");
  const iss = `https://${config.accessTeamDomain}`;
  if (payload.iss !== iss) throw new HttpError(403, "access_denied", "Access issuer mismatch");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.accessAud)) throw new HttpError(403, "access_denied", "Access audience mismatch");
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new HttpError(403, "access_denied", "Access assertion expired");
  if (typeof payload.nbf === "number" && payload.nbf > now + 5) throw new HttpError(403, "access_denied", "Access assertion not yet valid");
  const jwks = await loadJwks(env, config.accessTeamDomain);
  const jwk = (jwks.keys || []).find((key) => key.kid === header.kid) || (jwks.keys || [])[0];
  if (!jwk) throw new HttpError(403, "access_denied", "Access key not found");
  const key = await importRsaJwk(jwk);
  const signature = fromBase64Url(parts[2], 512);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, data);
  if (!ok) throw new HttpError(403, "access_denied", "Access assertion is invalid");
  const email = String(payload.email || payload.identity?.email || "").toLowerCase();
  if (!email || !config.allowedEmails.includes(email)) {
    throw new HttpError(403, "access_denied", "Identity is not allowed to administer the catalog");
  }
  return { email };
}

function isPlaceholder(value) {
  return !value || /replace/i.test(value);
}

export function cloudflareAccessConfigured(env) {
  const config = catalogConfig(env);
  return !isPlaceholder(config.accessTeamDomain)
    && !isPlaceholder(config.accessAud)
    && config.allowedEmails.length > 0;
}

export function sharedSecretConfigured(env) {
  return Boolean(env.ADMIN_SHARED_SECRET) && env.ADMIN_SHARED_SECRET.length >= 16;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8Encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8Encode(message)));
  return toBase64Url(sig);
}

export async function createAdminSessionCookie(request, env) {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const body = `v1.${exp}`;
  const token = `${body}.${await hmacHex(env.ADMIN_SHARED_SECRET, body)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `reedance_admin=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=43200`;
}

export async function requireSharedSecretSession(request, env) {
  const token = cookieValue(request, "reedance_admin");
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new HttpError(401, "login_required", "Admin session required");
  }
  const body = `${parts[0]}.${parts[1]}`;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    throw new HttpError(401, "login_required", "Admin session expired");
  }
  const expected = await hmacHex(env.ADMIN_SHARED_SECRET, body);
  if (!bytesEqual(utf8Encode(parts[2]), utf8Encode(expected))) {
    throw new HttpError(401, "login_required", "Admin session invalid");
  }
  return { email: "operator@local", sharedSecret: true };
}

export async function verifySharedSecret(secret, env) {
  if (!sharedSecretConfigured(env) || typeof secret !== "string") {
    throw new HttpError(403, "access_denied", "Admin shared secret is not configured");
  }
  const a = utf8Encode(secret);
  const b = utf8Encode(env.ADMIN_SHARED_SECRET);
  if (!bytesEqual(a, b)) throw new HttpError(403, "access_denied", "Invalid admin secret");
}

export async function requireAdminAccess(request, env) {
  const config = catalogConfig(env);
  if (config.environment === "production" && env.ALLOW_LOCAL_ADMIN === "true") {
    throw new HttpError(403, "access_denied", "Local admin bypass is forbidden in production");
  }
  if (config.allowLocalAdmin) {
    return { email: "local-dev@invalid", local: true };
  }
  if (cloudflareAccessConfigured(env)) {
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt) throw new HttpError(403, "access_denied", "Missing Access assertion");
    return verifyAccessJwt(jwt, env);
  }
  if (sharedSecretConfigured(env)) {
    return requireSharedSecretSession(request, env);
  }
  throw new HttpError(403, "access_denied", "Admin is closed until a shared secret or Cloudflare Access is configured");
}
