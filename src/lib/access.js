import { catalogConfig } from "./config.js";
import { HttpError } from "./errors.js";
import { fromBase64Url, utf8Decode } from "./bytes.js";

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

export async function requireAdminAccess(request, env) {
  const config = catalogConfig(env);
  if (config.environment === "production" && env.ALLOW_LOCAL_ADMIN === "true") {
    throw new HttpError(403, "access_denied", "Local admin bypass is forbidden in production");
  }
  if (config.allowLocalAdmin) {
    return { email: "local-dev@invalid", local: true };
  }
  if (!config.accessTeamDomain || !config.accessAud || config.allowedEmails.length === 0) {
    throw new HttpError(403, "access_denied", "Admin is closed until Cloudflare Access is configured");
  }
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) throw new HttpError(403, "access_denied", "Missing Access assertion");
  return verifyAccessJwt(jwt, env);
}
