import { DEFAULT_SUPPORTED_LANGUAGES, KEY_ID_RE, TEST_HOST } from "./constants.js";

const FALLBACK_CATALOG_KEY_ID = "cat-reedance-1";

function splitList(value) {
  if (!value || typeof value !== "string") return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

/** Secrets named CATALOG_KEY_ID override wrangler [vars]; map the placeholder so publish can sign. */
export function resolveCatalogKeyId(env = {}) {
  const raw = String(env.CATALOG_KEY_ID || "").trim().replace(/^["']|["']$/g, "");
  if (!raw || raw === "cat-REPLACE_ME") return FALLBACK_CATALOG_KEY_ID;
  return raw;
}

export function catalogConfig(env = {}) {
  const environment = env.ENVIRONMENT || "production";
  const isDev = environment === "development";
  const manifestHosts = splitList(env.ALLOWED_MANIFEST_HOSTS).map((h) => h.toLowerCase());
  const coverHosts = splitList(env.ALLOWED_COVER_HOSTS).map((h) => h.toLowerCase());
  const supported = splitList(env.SUPPORTED_LANGUAGE_CODES).map((c) => c.toLowerCase());
  const allowedEmails = splitList(env.ACCESS_ALLOWED_EMAILS).map((e) => e.toLowerCase());
  const catalogKeyId = resolveCatalogKeyId(env);
  return {
    environment,
    isDev,
    catalogKeyId,
    prettyPayload: env.PRETTY_PAYLOAD === "true" || isDev,
    manifestHosts: new Set(manifestHosts.length ? manifestHosts : (isDev ? [TEST_HOST] : [])),
    coverHosts: new Set(coverHosts.length ? coverHosts : (isDev ? [TEST_HOST] : [])),
    supportedLanguages: new Set(supported.length ? supported : [...DEFAULT_SUPPORTED_LANGUAGES]),
    adminOrigin: env.ADMIN_ORIGIN || "",
    accessTeamDomain: env.ACCESS_TEAM_DOMAIN || "",
    accessAud: env.ACCESS_AUD || "",
    allowedEmails,
    allowLocalAdmin: isDev && env.ALLOW_LOCAL_ADMIN === "true",
    keyIdOk: KEY_ID_RE.test(catalogKeyId),
  };
}
