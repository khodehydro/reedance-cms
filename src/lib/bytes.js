const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

export function utf8Encode(text) {
  return encoder.encode(text);
}

export function utf8Decode(bytes) {
  return decoder.decode(bytes);
}

export function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export function bytesEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value, maxBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("noncanonical base64url");
  }
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  let bin;
  try {
    bin = atob(b64);
  } catch {
    throw new Error("invalid base64url");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  if (bytes.length > maxBytes) throw new Error("base64url too large");
  if (toBase64Url(bytes) !== value) throw new Error("noncanonical base64url");
  return bytes;
}

function b64ToBytes(b64) {
  const clean = b64.replace(/-/g, "+").replace(/_/g, "/");
  let bin;
  try {
    bin = atob(clean);
  } catch {
    throw new Error("CATALOG_SIGNING_PKCS8 is not valid base64");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodePkcs8(input) {
  if (!input || typeof input !== "string") throw new Error("missing PKCS8");
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  const pem = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/);
  let bytes;
  if (pem) {
    const label = pem[1].trim();
    if (/OPENSSH/i.test(label)) throw new Error("OpenSSH keys are not supported; use npm run gen:key");
    if (/RSA|EC PRIVATE|CERTIFICATE|PUBLIC/i.test(label)) {
      throw new Error(`unsupported PEM ${label}; need PKCS8 BEGIN PRIVATE KEY`);
    }
    bytes = b64ToBytes(pem[2].replace(/\s+/g, ""));
  } else if (/BEGIN /.test(trimmed)) {
    throw new Error("PEM block is truncated; include both BEGIN and END lines");
  } else if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    bytes = new Uint8Array(trimmed.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  } else {
    bytes = b64ToBytes(trimmed.replace(/\s+/g, ""));
  }
  if (bytes.length < 32 || bytes.length > 256) {
    throw new Error(`decoded ${bytes.length} bytes; Ed25519 PKCS8 from npm run gen:key is about 48 bytes`);
  }
  return bytes;
}

export function pemFromDer(der, label = "PRIVATE KEY") {
  const b64 = btoa(String.fromCharCode(...der));
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}
