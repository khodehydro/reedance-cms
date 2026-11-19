export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export class CasConflictError extends HttpError {
  constructor(message = "Draft or published revision changed") {
    super(409, "conflict", message);
  }
}

export function jsonError(status, code, message, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.code, error.message);
  }
  const raw = String(error?.message || error).replace(/-----BEGIN[\s\S]+?-----END [^-]+-----/g, "[redacted]").slice(0, 180);
  return jsonError(500, "internal", raw || "Internal error");
}
