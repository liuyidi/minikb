import { NextRequest, NextResponse } from "next/server";
import { authEnv } from "@/lib/auth";
import {
  SESSION_COOKIE,
  sealSession,
  sessionCookieOptions,
  verifySession,
} from "@/lib/session";
import { fetchOidcUserProfile } from "@/lib/userinfo";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  let sessionSecret: string;
  let issuer: string;
  try {
    ({ sessionSecret, issuer } = authEnv());
  } catch {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const payload = await verifySession(cookie, sessionSecret);
  if (!payload?.refresh_token) {
    return NextResponse.json({ error: "invalid session" }, { status: 401 });
  }

  const tokenResp = await fetch(`${issuer.replace(/\/$/, "")}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: payload.refresh_token }),
  });

  if (!tokenResp.ok) {
    const response = NextResponse.json({ error: "refresh failed" }, { status: 401 });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  const tokenData = (await tokenResp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    const response = NextResponse.json({ error: "refresh failed" }, { status: 401 });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  const refreshToken = tokenData.refresh_token ?? payload.refresh_token;
  const expiresIn = Number(tokenData.expires_in ?? 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const profile = await fetchOidcUserProfile(issuer, accessToken);

  const sessionToken = await sealSession(
    {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      sub: profile?.sub ?? payload.sub,
      name: profile?.name ?? payload.name,
      email: profile?.email ?? payload.email,
      nickname: profile?.nickname ?? payload.nickname,
    },
    sessionSecret,
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
}
