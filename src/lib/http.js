import { MAX_JSON_BODY } from "./constants.js";
import { HttpError } from "./errors.js";
import { parseJsonStrict } from "./json.js";

export function adminHeaders(extra = {}) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https://reedance.ir; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...extra,
  };
}

export function publicJsonHeaders(etag) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=60, s-maxage=300, must-revalidate",
    etag,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

export function wantsNoCache(request) {
  const value = request.headers.get("cache-control") || "";
  return /\bno-cache\b/i.test(value);
}

export function ifNoneMatch(request) {
  return (request.headers.get("if-none-match") || "").trim();
}

export function etagMatches(header, etag) {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim());
  return parts.includes(etag) || parts.includes(etag.replaceAll('"', ""));
}

export async function readJsonBody(request) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const params = (request.headers.get("content-type") || "").toLowerCase();
  if (params.includes("multipart/form-data") || type === "application/octet-stream" || type.startsWith("image/") || type.startsWith("audio/") || type.startsWith("video/")) {
    throw new HttpError(415, "files_forbidden", "This CMS never accepts files, multipart, audio, images or packs");
  }
  if (type !== "application/json") {
    throw new HttpError(415, "unsupported_type", "Content-Type must be application/json");
  }
  if (params.includes("charset=") && !params.includes("charset=utf-8")) {
    throw new HttpError(415, "unsupported_type", "JSON charset must be utf-8");
  }
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_JSON_BODY) throw new HttpError(413, "too_large", "JSON body exceeds 16 KiB");
  const buffer = new Uint8Array(await request.arrayBuffer());
  if (buffer.byteLength > MAX_JSON_BODY) throw new HttpError(413, "too_large", "JSON body exceeds 16 KiB");
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    throw new HttpError(400, "invalid_json", "BOM is not allowed");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new HttpError(400, "invalid_json", "Body is not valid UTF-8");
  }
  return parseJsonStrict(text);
}

export function cacheKeyFor(request, pathname) {
  const url = new URL(pathname, request.url);
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
}

export function isoNow(env) {
  if (typeof env.now === "function") return env.now();
  if (typeof env.NOW === "string") return env.NOW;
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
