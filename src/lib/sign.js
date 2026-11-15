import { CATALOG_DOMAIN, KEY_ID_RE, MAX_ENVELOPE_BYTES, MAX_PAYLOAD_BYTES, TEST_KEY_ID } from "./constants.js";
import { concatBytes, decodePkcs8, fromBase64Url, toBase64Url, utf8Encode } from "./bytes.js";
import { HttpError } from "./errors.js";
import { stableStringify } from "./json.js";

export function catalogMessage(catalogKeyId, payloadBytes) {
  return concatBytes(utf8Encode(`${CATALOG_DOMAIN}\n${catalogKeyId}\n`), payloadBytes);
}

export async function importCatalogPrivateKey(pkcs8) {
  const der = decodePkcs8(pkcs8);
  return crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
}

export async function importCatalogPublicKey(raw32) {
  const bytes = raw32 instanceof Uint8Array ? raw32 : fromBase64Url(raw32, 32);
  if (bytes.length !== 32) throw new Error("catalog public key must be 32 bytes");
  return crypto.subtle.importKey("raw", bytes, { name: "Ed25519" }, false, ["verify"]);
}

export async function publicRaw32FromPrivate(pkcs8) {
  const der = decodePkcs8(pkcs8);
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", key));
  return spki.slice(-32);
}

export async function signPayloadBytes(privateKey, catalogKeyId, payloadBytes) {
  if (!KEY_ID_RE.test(catalogKeyId) || catalogKeyId.length > 32) {
    throw new HttpError(500, "bad_key_id", "Invalid catalogKeyId");
  }
  if (payloadBytes.byteLength > MAX_PAYLOAD_BYTES) {
    throw new HttpError(400, "payload_too_large", "Payload exceeds 128 KiB");
  }
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, privateKey, catalogMessage(catalogKeyId, payloadBytes)),
  );
  return {
    catalogKeyId,
    payload: toBase64Url(payloadBytes),
    signature: toBase64Url(signature),
  };
}

export async function signPayloadObject(privateKey, catalogKeyId, payload, pretty = true) {
  const text = stableStringify(payload, pretty);
  return signPayloadBytes(privateKey, catalogKeyId, utf8Encode(text));
}

export function envelopeBytes(envelope) {
  return utf8Encode(JSON.stringify({
    catalogKeyId: envelope.catalogKeyId,
    payload: envelope.payload,
    signature: envelope.signature,
  }));
}

export async function verifyEnvelope(envelope, publicKey) {
  if (!envelope || typeof envelope !== "object") return false;
  const keys = Object.keys(envelope);
  if (keys.length !== 3 || !("catalogKeyId" in envelope) || !("payload" in envelope) || !("signature" in envelope)) {
    return false;
  }
  let payloadBytes;
  let signature;
  try {
    payloadBytes = fromBase64Url(envelope.payload, MAX_PAYLOAD_BYTES);
    signature = fromBase64Url(envelope.signature, 64);
  } catch {
    return false;
  }
  if (signature.length !== 64) return false;
  if (payloadBytes.byteLength > MAX_PAYLOAD_BYTES) return false;
  return crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signature,
    catalogMessage(envelope.catalogKeyId, payloadBytes),
  );
}

export function assertProductionKey(env) {
  const environment = env.ENVIRONMENT || "production";
  if (environment !== "development" && env.CATALOG_KEY_ID === TEST_KEY_ID) {
    throw new HttpError(403, "test_key_forbidden", "cat-test-v1 cannot be used outside development");
  }
}

export function assertEnvelopeSize(bytes) {
  if (bytes.byteLength > MAX_ENVELOPE_BYTES) {
    throw new HttpError(400, "envelope_too_large", "Envelope exceeds 192 KiB");
  }
}
