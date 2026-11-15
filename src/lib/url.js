import { HttpError } from "./errors.js";

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function isIpLiteral(hostname) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  if (hostname.includes(":")) return true;
  return false;
}

export function parseCanonicalHttpsUrl(raw) {
  if (typeof raw !== "string" || raw.length < 12 || raw.length > 2048) {
    throw new HttpError(400, "bad_url", "URL is missing or too long");
  }
  if (!raw.startsWith("https://")) throw new HttpError(400, "bad_url", "URL must be https and canonical");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "bad_url", "URL could not be parsed");
  }
  if (url.href !== raw) throw new HttpError(400, "bad_url", "URL is not canonical (would be normalized)");
  if (url.protocol !== "https:") throw new HttpError(400, "bad_url", "URL must use https");
  if (url.username || url.password) throw new HttpError(400, "bad_url", "URL must not include userinfo");
  if (url.port) throw new HttpError(400, "bad_url", "URL must not include a port");
  if (url.search) throw new HttpError(400, "bad_url", "URL must not include a query");
  if (url.hash) throw new HttpError(400, "bad_url", "URL must not include a fragment");
  if (isIpLiteral(url.hostname)) throw new HttpError(400, "bad_url", "IP literals are not allowed");
  if (!HOST.test(url.hostname)) throw new HttpError(400, "bad_url", "Host is not a DNS name");
  if (!url.pathname.startsWith("/")) throw new HttpError(400, "bad_url", "Path must start with /");
  const segments = url.pathname.split("/").slice(1);
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !SEGMENT.test(segment))) {
    throw new HttpError(400, "bad_url", "Path segments must be simple ASCII");
  }
  if (url.pathname.includes("%") || url.pathname.includes("\\")) {
    throw new HttpError(400, "bad_url", "Path must not include percent-encoding or backslash");
  }
  return url;
}

export function assertManifestUrl(raw, allowHosts) {
  const url = parseCanonicalHttpsUrl(raw);
  if (!allowHosts.has(url.hostname)) {
    throw new HttpError(400, "host_not_allowed", "manifestUrl host is not on the allowlist");
  }
  if (!url.pathname.endsWith("/latest.json") || url.pathname.split("/").at(-1) !== "latest.json") {
    throw new HttpError(400, "bad_url", "manifestUrl must end with /latest.json");
  }
  return url;
}

export function assertCoverUrl(raw, allowHosts) {
  const url = parseCanonicalHttpsUrl(raw);
  if (!allowHosts.has(url.hostname)) {
    throw new HttpError(400, "host_not_allowed", "coverUrl host is not on the allowlist");
  }
  if (!/\.(?:jpg|png|webp)$/.test(url.pathname)) {
    throw new HttpError(400, "bad_url", "coverUrl must end with .jpg, .png or .webp");
  }
  return url;
}

export function assertProductionHosts(url, env) {
  const environment = env.ENVIRONMENT || "production";
  if (environment !== "development" && url.hostname.endsWith(".invalid")) {
    throw new HttpError(400, "test_host_forbidden", "example.invalid hosts cannot be published outside development");
  }
}
