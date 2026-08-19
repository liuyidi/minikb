import { NextRequest, NextResponse } from "next/server";
import { authEnv } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const { sessionSecret } = authEnv();
    const payload = await verifySession(cookie, sessionSecret);
    if (!payload || Math.floor(Date.now() / 1000) > payload.expires_at) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      accessToken: payload.access_token,
      sub: payload.sub,
      expiresAt: payload.expires_at,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
