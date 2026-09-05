/**
 * Session tokens for the single-password gate.
 *
 * The cookie used to hold the password itself, and the proxy compared it to
 * APP_PASSWORD directly. That had two problems: the credential sat in a cookie
 * in plain text, and changing the password in the database revoked nothing,
 * because the Edge proxy cannot read the database to learn it changed.
 *
 * A token is `<expiresAt>.<hmac>`, signed with APP_PASSWORD as the key. The
 * proxy verifies it with Web Crypto, no database and no extra secret to
 * configure. Changing APP_PASSWORD changes the key, so every previously issued
 * token stops verifying. That is the revocation story, and it is the reason
 * the password lives in the environment rather than in AppConfig.
 */

const encoder = new TextEncoder();

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

async function sign(password: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Compares every character even after a mismatch, so the time taken does not
// reveal how much of a forged signature was correct.
function equalsInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

export async function createSessionToken(password: string, now = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${await sign(password, String(expiresAt))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string,
  now = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator === -1) return false;

  const expiresAtRaw = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  return equalsInConstantTime(signature, await sign(password, expiresAtRaw));
}
