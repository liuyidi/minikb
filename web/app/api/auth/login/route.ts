import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authEnv, buildAuthorizeUrl, randomVerifier } from "@/lib/auth";
import { publicUrl } from "@/lib/origin";
import { isSafeNextPath } from "@/lib/paths";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  pkceCookieOptions,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  let issuer: string;
  let clientId: string;
  let redirectUri: string;
  try {
    ({ issuer, clientId, redirectUri } = authEnv());
  } catch {
    return NextResponse.redirect(publicUrl(request, "/?error=config"));
  }

  const nextParam = request.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = isSafeNextPath(nextParam) ? nextParam : "/";

  const state = randomBytes(16).toString("base64url");
  const verifier = randomVerifier();
  const authorizeUrl = buildAuthorizeUrl({
    issuer,
    clientId,
    redirectUri,
    state,
    codeVerifier: verifier,
  });

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = pkceCookieOptions();
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, cookieOptions);
  response.cookies.set(OAUTH_NEXT_COOKIE, safeNext, cookieOptions);
  return response;
}
