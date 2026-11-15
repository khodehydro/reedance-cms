import { DEFAULT_SUPPORTED_LANGUAGES, KEY_ID_RE, TEST_HOST } from "./constants.js";

function splitList(value) {
  if (!value || typeof value !== "string") return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function catalogConfig(env = {}) {
  const environment = env.ENVIRONMENT || "production";
  const isDev = environment === "development";
  const manifestHosts = splitList(env.ALLOWED_MANIFEST_HOSTS).map((h) => h.toLowerCase());
  const coverHosts = splitList(env.ALLOWED_COVER_HOSTS).map((h) => h.toLowerCase());
  const supported = splitList(env.SUPPORTED_LANGUAGE_CODES).map((c) => c.toLowerCase());
  const allowedEmails = splitList(env.ACCESS_ALLOWED_EMAILS).map((e) => e.toLowerCase());
  return {
    environment,
    isDev,
    catalogKeyId: env.CATALOG_KEY_ID || "",
    prettyPayload: env.PRETTY_PAYLOAD === "true" || isDev,
    manifestHosts: new Set(manifestHosts.length ? manifestHosts : (isDev ? [TEST_HOST] : [])),
    coverHosts: new Set(coverHosts.length ? coverHosts : (isDev ? [TEST_HOST] : [])),
    supportedLanguages: new Set(supported.length ? supported : [...DEFAULT_SUPPORTED_LANGUAGES]),
    adminOrigin: env.ADMIN_ORIGIN || "",
    accessTeamDomain: env.ACCESS_TEAM_DOMAIN || "",
    accessAud: env.ACCESS_AUD || "",
    allowedEmails,
    allowLocalAdmin: isDev && env.ALLOW_LOCAL_ADMIN === "true",
    keyIdOk: !env.CATALOG_KEY_ID || KEY_ID_RE.test(env.CATALOG_KEY_ID),
  };
}
