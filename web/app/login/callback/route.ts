import { NextRequest, NextResponse } from "next/server";
import { authEnv, issuerBase } from "@/lib/auth";
import { publicUrl } from "@/lib/origin";
import { isSafeNextPath } from "@/lib/paths";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  clearCookieOptions,
  sealSession,
  sessionCookieOptions,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const next = request.cookies.get(OAUTH_NEXT_COOKIE)?.value ?? "/";

  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return NextResponse.redirect(publicUrl(request, "/?error=auth"));
  }

  let issuer: string;
  let clientId: string;
  let redirectUri: string;
  let sessionSecret: string;
  try {
    ({ issuer, clientId, redirectUri, sessionSecret } = authEnv());
  } catch {
    return NextResponse.redirect(publicUrl(request, "/?error=config"));
  }

  const tokenResp = await fetch(`${issuerBase(issuer)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!tokenResp.ok) {
    return NextResponse.redirect(publicUrl(request, "/?error=token"));
  }

  const tokenData = (await tokenResp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? "";
  const expiresIn = Number(tokenData.expires_in ?? 3600);

  if (!accessToken) {
    return NextResponse.redirect(publicUrl(request, "/?error=token"));
  }

  const userinfoResp = await fetch(`${issuerBase(issuer)}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userinfoResp.ok) {
    return NextResponse.redirect(publicUrl(request, "/?error=userinfo"));
  }

  const userinfo = (await userinfoResp.json()) as { sub?: string; id?: string };
  const sub = String(userinfo.sub ?? userinfo.id ?? "");

  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const sessionToken = await sealSession(
    {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      sub,
    },
    sessionSecret,
  );

  const safeNext = isSafeNextPath(next) ? next : "/";
  const response = NextResponse.redirect(publicUrl(request, safeNext));
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());

  const cleared = clearCookieOptions();
  response.cookies.set(OAUTH_STATE_COOKIE, "", cleared);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, "", cleared);
  response.cookies.set(OAUTH_NEXT_COOKIE, "", cleared);
  return response;
}
