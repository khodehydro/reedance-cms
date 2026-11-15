import { HttpError } from "./errors.js";
import { toBase64Url } from "./bytes.js";
import { catalogConfig } from "./config.js";

export function createCsrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function csrfCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `reedance_csrf=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=43200`;
}

function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) return part.slice(name.length + 1);
  }
  return "";
}

export function assertCsrfAndOrigin(request, env) {
  const config = catalogConfig(env);
  const origin = request.headers.get("origin");
  if (!origin || !config.adminOrigin || origin !== config.adminOrigin) {
    throw new HttpError(403, "bad_origin", "Origin does not match ADMIN_ORIGIN");
  }
  const header = request.headers.get("x-csrf-token") || "";
  const cookie = cookieValue(request, "reedance_csrf");
  if (!header || !cookie || header !== cookie) {
    throw new HttpError(403, "csrf", "CSRF token mismatch");
  }
}
