/**
 * Minimal single-tenant OAuth 2.1 authorization server for the Apto MCP
 * connector. Cowork's custom-connector UI only supports OAuth (Client
 * ID/Secret + authorization_code + PKCE), not a raw bearer-token field, so
 * this wraps the existing static APTO_MCP_TOKEN behind a real OAuth flow.
 *
 * There is exactly one legitimate client (Bill's Cowork connector), so this
 * intentionally skips a hosted consent screen: /authorize auto-approves any
 * request whose client_id matches APTO_OAUTH_CLIENT_ID and whose
 * redirect_uri is the known Claude callback. The authorization code itself
 * is a short-lived, HMAC-signed, stateless token (no DB table needed) that
 * embeds the PKCE code_challenge, redirect_uri, and client_id.
 */

import crypto from "crypto";

export function baseUrl(): string {
  // Set APTO_BASE_URL to your own deployment. There is deliberately no
  // fallback host: a wrong default here would send OAuth callbacks somewhere
  // you do not control.
  return process.env.APTO_BASE_URL || "http://localhost:3000";
}

// Claude's hosted surfaces (claude.ai web, Desktop, mobile, Cowork) all use
// this fixed OAuth callback for custom connectors.
const ALLOWED_REDIRECT_URIS = ["https://claude.ai/api/mcp/auth_callback"];

export function isAllowedRedirectUri(uri: string | null): boolean {
  if (!uri) return false;
  return ALLOWED_REDIRECT_URIS.includes(uri);
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function signingSecret(): string {
  const secret = process.env.APTO_MCP_TOKEN;
  if (!secret) throw new Error("APTO_MCP_TOKEN not set");
  return secret;
}

interface AuthCodePayload {
  cc: string; // PKCE code_challenge
  ru: string; // redirect_uri
  cid: string; // client_id
  exp: number; // epoch seconds
}

export function issueAuthCode(payload: Omit<AuthCodePayload, "exp">, ttlSeconds = 120): string {
  const full: AuthCodePayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = base64url(JSON.stringify(full));
  const sig = base64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyAuthCode(code: string): AuthCodePayload | null {
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const expectedSig = base64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as AuthCodePayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return computed === codeChallenge;
}

export function isKnownClient(clientId: string | null): boolean {
  const expected = process.env.APTO_OAUTH_CLIENT_ID;
  return !!expected && clientId === expected;
}

export function clientSecretMatches(clientSecret: string | null): boolean {
  const expected = process.env.APTO_OAUTH_CLIENT_SECRET;
  // If no secret is configured server-side, treat this as a public client
  // (PKCE is still required, so this remains safe).
  if (!expected) return true;
  return clientSecret === expected;
}
