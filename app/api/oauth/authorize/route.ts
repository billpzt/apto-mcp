/**
 * OAuth 2.1 authorization endpoint (single-tenant, auto-approve).
 *
 * One legitimate client, gated by APTO_OAUTH_CLIENT_ID and a fixed Claude
 * redirect URI, so there is no hosted consent screen here: a valid request is
 * redirected straight back with a short-lived code. Nothing here proves the
 * caller is the owner, so the code is useless on its own. Both PKCE (S256)
 * and the confidential client secret are enforced at the token endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAllowedRedirectUri, isKnownClient, issueAuthCode } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const state = params.get("state");

  if (!isAllowedRedirectUri(redirectUri)) {
    // Never redirect to an unrecognized URI — that would be an open redirect.
    return NextResponse.json({ error: "invalid_request", error_description: "unknown redirect_uri" }, { status: 400 });
  }

  const fail = (error: string, description: string) => {
    const url = new URL(redirectUri!);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString(), 302);
  };

  if (responseType !== "code") {
    return fail("unsupported_response_type", "only 'code' is supported");
  }
  if (!isKnownClient(clientId)) {
    return fail("unauthorized_client", "unknown client_id");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return fail("invalid_request", "PKCE with S256 is required");
  }

  const code = issueAuthCode({ cc: codeChallenge, ru: redirectUri!, cid: clientId! });

  const url = new URL(redirectUri!);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString(), 302);
}
