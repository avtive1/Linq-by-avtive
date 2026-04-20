import { randomUUID } from "node:crypto";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

export type AttendeeCardClaims = {
  sub: string;
  cardId: string;
  scope?: string;
};

type TokenKeyPair = {
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
};

const TOKEN_ISSUER = process.env.ATTENDEE_TOKEN_ISSUER || "avtive";
const TOKEN_AUDIENCE = process.env.ATTENDEE_TOKEN_AUDIENCE || "attendee-card";
const TOKEN_TTL_SECONDS = Number(process.env.ATTENDEE_TOKEN_TTL_SECONDS || "600");

function loadTokenKeys(): TokenKeyPair[] {
  const raw = process.env.ATTENDEE_TOKEN_KEYS_JSON;
  if (!raw) throw new Error("ATTENDEE_TOKEN_KEYS_JSON is missing.");
  const keys = JSON.parse(raw) as TokenKeyPair[];
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("ATTENDEE_TOKEN_KEYS_JSON must contain at least one key pair.");
  }
  return keys;
}

function getActiveKid() {
  return process.env.ATTENDEE_TOKEN_ACTIVE_KID || "atk_v1";
}

function getActiveKeyPair(): TokenKeyPair {
  const activeKid = getActiveKid();
  const pair = loadTokenKeys().find((k) => k.kid === activeKid);
  if (!pair) throw new Error(`Active token key ${activeKid} not found.`);
  return pair;
}

function getPublicKeyByKid(kid: string): TokenKeyPair {
  const pair = loadTokenKeys().find((k) => k.kid === kid);
  if (!pair) throw new Error(`Token public key ${kid} not found.`);
  return pair;
}

export async function issueAttendeeCardToken(claims: AttendeeCardClaims): Promise<string> {
  const kp = getActiveKeyPair();
  const privateKey = await importPKCS8(kp.privateKeyPem, "EdDSA");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    cardId: claims.cardId,
    scope: claims.scope || "card:read",
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "EdDSA", kid: kp.kid, typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setNotBefore(now - 5)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(privateKey);
}

export async function verifyAttendeeCardToken(token: string) {
  const protectedHeader = JSON.parse(
    Buffer.from(token.split(".")[0].replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"),
  ) as { kid?: string };
  if (!protectedHeader.kid) throw new Error("Missing kid.");

  const kp = getPublicKeyByKid(protectedHeader.kid);
  const publicKey = await importSPKI(kp.publicKeyPem, "EdDSA");
  return jwtVerify(token, publicKey, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    clockTolerance: "60s",
  });
}
