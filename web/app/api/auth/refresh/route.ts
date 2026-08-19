import { NextRequest, NextResponse } from "next/server";
import { authEnv, issuerBase } from "@/lib/auth";
import {
  SESSION_COOKIE,
  sealSession,
  sessionCookieOptions,
  verifySession,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  let sessionSecret: string;
  let issuer: string;
  let clientId: string;
  try {
    ({ sessionSecret, issuer, clientId } = authEnv());
  } catch {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const payload = await verifySession(cookie, sessionSecret);
  if (!payload?.refresh_token) {
    return NextResponse.json({ error: "invalid session" }, { status: 401 });
  }

  const tokenResp = await fetch(`${issuerBase(issuer)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: payload.refresh_token,
      client_id: clientId,
    }),
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

  const sessionToken = await sealSession(
    {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      sub: payload.sub,
    },
    sessionSecret,
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
}
