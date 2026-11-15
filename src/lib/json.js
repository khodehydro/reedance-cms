import { HttpError } from "./errors.js";

function skipWs(text, i) {
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) i += 1;
    else break;
  }
  return i;
}

function parseString(text, start) {
  let i = start + 1;
  let out = "";
  while (i < text.length) {
    const c = text[i];
    if (c === '"') return { value: out, next: i + 1 };
    if (c === "\\") {
      const n = text[i + 1];
      const map = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
      if (n === "u") {
        const hex = text.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new HttpError(400, "invalid_json", "Invalid unicode escape");
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      if (!(n in map)) throw new HttpError(400, "invalid_json", "Invalid escape");
      out += map[n];
      i += 2;
      continue;
    }
    if (c.charCodeAt(0) < 32) throw new HttpError(400, "invalid_json", "Control character in string");
    out += c;
    i += 1;
  }
  throw new HttpError(400, "invalid_json", "Unterminated string");
}

function parseNumber(text, start) {
  const rest = text.slice(start);
  const match = rest.match(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/);
  if (!match) throw new HttpError(400, "invalid_json", "Invalid number");
  const raw = match[0];
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new HttpError(400, "invalid_json", "Non-finite number");
  return { value, next: start + raw.length, raw };
}

function parseLiteral(text, start) {
  if (text.startsWith("true", start)) return { value: true, next: start + 4 };
  if (text.startsWith("false", start)) return { value: false, next: start + 5 };
  if (text.startsWith("null", start)) return { value: null, next: start + 4 };
  throw new HttpError(400, "invalid_json", "Invalid literal");
}

function parseValue(text, start) {
  const i = skipWs(text, start);
  if (i >= text.length) throw new HttpError(400, "invalid_json", "Unexpected end");
  const c = text[i];
  if (c === "{") return parseObject(text, i);
  if (c === "[") return parseArray(text, i);
  if (c === '"') return parseString(text, i);
  if (c === "-" || (c >= "0" && c <= "9")) return parseNumber(text, i);
  return parseLiteral(text, i);
}

function parseObject(text, start) {
  let i = start + 1;
  const obj = Object.create(null);
  const keys = new Set();
  i = skipWs(text, i);
  if (text[i] === "}") return { value: obj, next: i + 1 };
  while (i < text.length) {
    i = skipWs(text, i);
    if (text[i] !== '"') throw new HttpError(400, "invalid_json", "Expected object key");
    const key = parseString(text, i);
    if (keys.has(key.value)) throw new HttpError(400, "invalid_json", `Duplicate key: ${key.value}`);
    keys.add(key.value);
    i = skipWs(text, key.next);
    if (text[i] !== ":") throw new HttpError(400, "invalid_json", "Expected colon");
    const val = parseValue(text, i + 1);
    obj[key.value] = val.value;
    i = skipWs(text, val.next);
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] === "}") return { value: obj, next: i + 1 };
    throw new HttpError(400, "invalid_json", "Expected comma or end of object");
  }
  throw new HttpError(400, "invalid_json", "Unterminated object");
}

function parseArray(text, start) {
  let i = start + 1;
  const arr = [];
  i = skipWs(text, i);
  if (text[i] === "]") return { value: arr, next: i + 1 };
  while (i < text.length) {
    const val = parseValue(text, i);
    arr.push(val.value);
    i = skipWs(text, val.next);
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] === "]") return { value: arr, next: i + 1 };
    throw new HttpError(400, "invalid_json", "Expected comma or end of array");
  }
  throw new HttpError(400, "invalid_json", "Unterminated array");
}

export function parseJsonStrict(text) {
  if (typeof text !== "string") throw new HttpError(400, "invalid_json", "Expected text");
  if (text.charCodeAt(0) === 0xfeff) throw new HttpError(400, "invalid_json", "BOM is not allowed");
  const parsed = parseValue(text, 0);
  const end = skipWs(text, parsed.next);
  if (end !== text.length) throw new HttpError(400, "invalid_json", "Trailing data");
  return parsed.value;
}

export function stableStringify(value, pretty = false) {
  const json = pretty ? JSON.stringify(value, null, 2) + "\n" : JSON.stringify(value);
  if (json === undefined) throw new Error("Cannot serialize");
  return json;
}

export function pickKnown(object, allowed) {
  const extra = Object.keys(object).filter((key) => !allowed.includes(key));
  if (extra.length) throw new HttpError(400, "unknown_field", `Unknown field: ${extra[0]}`);
  return object;
}

export function rejectForbidden(object) {
  for (const key of Object.keys(object)) {
    if (FORBIDDEN_LOOKUP.has(key.toLowerCase())) {
      throw new HttpError(400, "forbidden_field", `Field is not allowed: ${key}`);
    }
  }
}

const FORBIDDEN_LOOKUP = new Set([
  "lyrics", "lyric", "audio", "lesson", "image", "images", "pack", "rdpack",
  "encryptionkey", "encryptionkeyid", "signaturekeyid", "media", "startms",
  "endms", "file", "files", "coverbase64", "password", "secret", "privatekey",
  "pkcs8", "token", "latestjson", "octet", "upload", "coverimage", "songbytes",
]);
