import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ENVELOPE_PREFIX = "encv1.";
const WRAP_ALG = "AES-256-GCM";
const FIELD_ALG = "AES-256-GCM";
const IV_BYTES = 12;
const KEY_BYTES = 32;

type EnvelopePayload = {
  v: 1;
  alg: typeof FIELD_ALG;
  kid: string;
  iv: string;
  ct: string;
  tag: string;
  edk: string;
  eiv: string;
  etag: string;
  wrappedAlg: typeof WRAP_ALG;
};

type EnvelopeDecryptResult = {
  plaintext: string;
  kid: string;
};

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromB64url(input: string): Buffer {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, "base64");
}

function loadKekMap(): Record<string, Buffer> {
  const raw = process.env.SECURITY_KEKS_JSON;
  if (!raw) throw new Error("SECURITY_KEKS_JSON is missing.");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const map: Record<string, Buffer> = {};
  for (const [kid, keyMaterial] of Object.entries(parsed)) {
    const key = Buffer.from(keyMaterial, "base64");
    if (key.length !== KEY_BYTES) {
      throw new Error(`KEK ${kid} must be ${KEY_BYTES} bytes (base64).`);
    }
    map[kid] = key;
  }
  return map;
}

export function getActiveKekId(): string {
  return process.env.SECURITY_ACTIVE_KEK_ID || "kek_v1";
}

export function hasEnvelopeCryptoConfigured(): boolean {
  return Boolean(process.env.SECURITY_KEKS_JSON && process.env.SECURITY_HMAC_KEY);
}

function getActiveKek(): { kid: string; key: Buffer } {
  const kid = getActiveKekId();
  const map = loadKekMap();
  const key = map[kid];
  if (!key) throw new Error(`Active KEK ${kid} is not defined.`);
  return { kid, key };
}

function getKekById(kid: string): Buffer {
  const map = loadKekMap();
  const key = map[kid];
  if (!key) throw new Error(`Unknown KEK id: ${kid}`);
  return key;
}

function encryptAesGcm(plaintext: Buffer, key: Buffer, aad: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ct, tag };
}

function decryptAesGcm(ciphertext: Buffer, key: Buffer, iv: Buffer, tag: Buffer, aad: string): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function isEncryptedEnvelope(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENVELOPE_PREFIX);
}

export function encryptSensitiveString(plaintext: string, context: string): string {
  const dek = randomBytes(KEY_BYTES);
  const { kid, key: kek } = getActiveKek();

  const fieldAad = `field:${context}`;
  const wrappedAad = `dek:${context}:${kid}`;
  const field = encryptAesGcm(Buffer.from(plaintext, "utf8"), dek, fieldAad);
  const wrappedDek = encryptAesGcm(dek, kek, wrappedAad);

  const payload: EnvelopePayload = {
    v: 1,
    alg: FIELD_ALG,
    kid,
    iv: b64url(field.iv),
    ct: b64url(field.ct),
    tag: b64url(field.tag),
    edk: b64url(wrappedDek.ct),
    eiv: b64url(wrappedDek.iv),
    etag: b64url(wrappedDek.tag),
    wrappedAlg: WRAP_ALG,
  };

  return `${ENVELOPE_PREFIX}${b64url(Buffer.from(JSON.stringify(payload), "utf8"))}`;
}

export function decryptSensitiveString(value: string, context: string): EnvelopeDecryptResult {
  if (!isEncryptedEnvelope(value)) {
    return { plaintext: value, kid: "plaintext" };
  }

  const payloadJson = fromB64url(value.slice(ENVELOPE_PREFIX.length)).toString("utf8");
  const payload = JSON.parse(payloadJson) as EnvelopePayload;

  if (payload.alg !== FIELD_ALG || payload.wrappedAlg !== WRAP_ALG || payload.v !== 1) {
    throw new Error("Unsupported envelope format.");
  }

  const kek = getKekById(payload.kid);
  const wrappedAad = `dek:${context}:${payload.kid}`;
  const dek = decryptAesGcm(
    fromB64url(payload.edk),
    kek,
    fromB64url(payload.eiv),
    fromB64url(payload.etag),
    wrappedAad,
  );

  const fieldAad = `field:${context}`;
  const plaintext = decryptAesGcm(
    fromB64url(payload.ct),
    dek,
    fromB64url(payload.iv),
    fromB64url(payload.tag),
    fieldAad,
  ).toString("utf8");

  return { plaintext, kid: payload.kid };
}

export function deterministicLookupTag(value: string, scope: string): string {
  const raw = process.env.SECURITY_HMAC_KEY;
  if (!raw) throw new Error("SECURITY_HMAC_KEY is missing.");
  const key = Buffer.from(raw, "base64");
  if (key.length < 32) throw new Error("SECURITY_HMAC_KEY must be at least 32 bytes (base64).");
  const h = createHmac("sha256", key);
  h.update(scope);
  h.update(":");
  h.update(value);
  return b64url(h.digest());
}
