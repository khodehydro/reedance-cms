import { LANGUAGE_RE } from "./constants.js";
import { jsonError } from "./errors.js";
import { cacheKeyFor, etagMatches, ifNoneMatch, publicJsonHeaders, wantsNoCache } from "./http.js";

function notFound() {
  return jsonError(404, "not_found", "Not found");
}

function unavailable() {
  return jsonError(503, "unavailable", "Catalog snapshot is unavailable");
}

async function readSnapshot(store, scope) {
  try {
    return await store.getSnapshot(scope);
  } catch {
    throw new Error("d1");
  }
}

export async function serveSnapshot({ request, store, ctx, cache, scope, missingStatus }) {
  const bypass = wantsNoCache(request);
  const key = cacheKeyFor(request, new URL(request.url).pathname);
  if (!bypass && cache) {
    const cached = await cache.match(key);
    if (cached) {
      const etag = cached.headers.get("etag");
      if (etagMatches(ifNoneMatch(request), etag)) {
        return new Response(null, { status: 304, headers: publicJsonHeaders(etag) });
      }
      return cached;
    }
  }

  let row;
  try {
    row = await readSnapshot(store, scope);
  } catch {
    return unavailable();
  }
  if (!row) {
    return missingStatus === 503 ? unavailable() : notFound();
  }

  const etag = row.etag;
  if (etagMatches(ifNoneMatch(request), etag)) {
    return new Response(null, { status: 304, headers: publicJsonHeaders(etag) });
  }
  const response = new Response(row.envelope_json, { status: 200, headers: publicJsonHeaders(etag) });
  if (cache) {
    const put = cache.put(key, response.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return response;
}

export async function handlePublicRequest(request, { store, ctx, cache }) {
  if (request.method !== "GET") {
    return jsonError(405, "method_not_allowed", "Public catalog is GET-only", { allow: "GET" });
  }
  const url = new URL(request.url);
  if (url.search && url.search !== "") {
    return jsonError(400, "query_not_allowed", "Public catalog does not accept query parameters");
  }
  if (url.pathname === "/v1/languages") {
    return serveSnapshot({ request, store, ctx, cache, scope: "languages", missingStatus: 503 });
  }
  const match = url.pathname.match(/^\/v1\/languages\/([a-z]{2,3})\/songs$/);
  if (match && LANGUAGE_RE.test(match[1])) {
    return serveSnapshot({ request, store, ctx, cache, scope: `songs/${match[1]}`, missingStatus: 404 });
  }
  return notFound();
}
