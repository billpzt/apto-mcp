/**
 * OAuth 2.1 token endpoint. Exchanges an authorization_code (verified via
 * PKCE) for the existing static APTO_MCP_TOKEN — there is only ever one
 * access token in this system, so no separate token minting or refresh-
 * token bookkeeping is needed. Accepts client credentials either as
 * client_secret_post (body params) or client_secret_basic (Authorization
 * header), per RFC 6749.
 */
import { NextRequest, NextResponse } from "next/server";
import { clientSecretMatches, isKnownClient, verifyAuthCode, verifyPkce } from "@/lib/oauth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

function errorResponse(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let params: URLSearchParams;
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  } else {
    const text = await req.text();
    params = new URLSearchParams(text);
  }

  let clientId = params.get("client_id");
  let clientSecret = params.get("client_secret");

  const authHeader = req.headers.get("authorization");
  if ((!clientId || !clientSecret) && authHeader?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const [basicId, basicSecret] = decoded.split(":");
      clientId = clientId || basicId;
      clientSecret = clientSecret || basicSecret;
    } catch {
      // fall through — invalid header just leaves clientId/clientSecret unset
    }
  }

  const grantType = params.get("grant_type");
  if (grantType !== "authorization_code") {
    return errorResponse("unsupported_grant_type", "only authorization_code is supported");
  }

  if (!isKnownClient(clientId)) {
    return errorResponse("invalid_client", "unknown client_id", 401);
  }
  if (!clientSecretMatches(clientSecret)) {
    return errorResponse("invalid_client", "client secret mismatch", 401);
  }

  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const codeVerifier = params.get("code_verifier");
  if (!code || !redirectUri || !codeVerifier) {
    return errorResponse("invalid_request", "code, redirect_uri, and code_verifier are required");
  }

  const payload = verifyAuthCode(code);
  if (!payload) {
    return errorResponse("invalid_grant", "authorization code is invalid or expired");
  }
  if (payload.cid !== clientId || payload.ru !== redirectUri) {
    return errorResponse("invalid_grant", "client_id or redirect_uri does not match the authorization request");
  }
  if (!verifyPkce(codeVerifier, payload.cc)) {
    return errorResponse("invalid_grant", "code_verifier does not match code_challenge");
  }

  const accessToken = process.env.APTO_MCP_TOKEN;
  if (!accessToken) {
    return errorResponse("server_error", "APTO_MCP_TOKEN not configured", 500);
  }

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 31536000,
    },
    { headers: CORS_HEADERS }
  );
}
