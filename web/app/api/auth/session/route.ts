import { NextRequest, NextResponse } from "next/server";
import { authEnv } from "@/lib/auth";
import {
  SESSION_COOKIE,
  sealSession,
  sessionCookieOptions,
  verifySession,
} from "@/lib/session";
import {
  fetchOidcUserProfile,
  hasReadableProfile,
  resolveDisplayName,
} from "@/lib/userinfo";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const { sessionSecret, issuer } = authEnv();
    const payload = await verifySession(cookie, sessionSecret);
    if (!payload || Math.floor(Date.now() / 1000) > payload.expires_at) {
      return NextResponse.json({ authenticated: false });
    }

    let { name, email, nickname, sub } = payload;
    let refreshedProfile = false;

    if (!hasReadableProfile({ name, email, nickname })) {
      const profile = await fetchOidcUserProfile(issuer, payload.access_token);
      if (profile) {
        sub = profile.sub || sub;
        name = profile.name ?? name;
        email = profile.email ?? email;
        nickname = profile.nickname ?? nickname;
        refreshedProfile = hasReadableProfile({ name, email, nickname });
      }
    }

    const displayName = resolveDisplayName({ sub, name, email, nickname });

    const response = NextResponse.json({
      authenticated: true,
      accessToken: payload.access_token,
      sub,
      name,
      email,
      nickname,
      displayName,
      expiresAt: payload.expires_at,
    });

    if (refreshedProfile) {
      const sessionToken = await sealSession(
        {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          expires_at: payload.expires_at,
          sub,
          name,
          email,
          nickname,
        },
        sessionSecret,
      );
      response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    }

    return response;
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
