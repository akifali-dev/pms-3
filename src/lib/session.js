import { cookies } from "next/headers";

const SESSION_COOKIE = "pms-session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8;

const encoder = new TextEncoder();

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
}

function toBase64(data) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data).toString("base64");
  }

  const bytes = new Uint8Array(data);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64");
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlEncode(value) {
  const encoded =
    typeof value === "string" ? toBase64(encoder.encode(value)) : toBase64(value);
  return encoded.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = fromBase64(normalized);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("utf-8");
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

async function getSigningKey() {
  const secret = getSessionSecret();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );
  return base64UrlEncode(signature);
}

async function verifySignature(value, signature) {
  const key = await getSigningKey();
  const signatureBytes = fromBase64(
    signature.replace(/-/g, "+").replace(/_/g, "/")
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(value)
  );
}

export async function createSessionToken(session) {
  const payload = {
    ...session,
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const payloadString = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadString);
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const isValid = await verifySignature(encodedPayload, signature);
  if (!isValid) {
    return null;
  }

  const payloadString = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(payloadString);
  if (!payload?.exp || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export function buildSessionCookie(token) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
