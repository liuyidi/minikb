import { NextRequest, NextResponse } from "next/server";
import { authEnv, issuerBase } from "@/lib/auth";
import { publicOrigin, publicUrl } from "@/lib/origin";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySession,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  const home = publicUrl(request, "/");

  if (process.env.MINIKB_AUTH_DISABLED === "true") {
    const response = NextResponse.redirect(home);
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  let issuer = "https://auth.liuyidi.me";
  let sessionSecret = "";
  try {
    ({ issuer, sessionSecret } = authEnv());
  } catch {
    // Still clear the cookie even if env is broken.
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && sessionSecret) {
    const payload = await verifySession(cookie, sessionSecret);
    if (payload?.refresh_token) {
      try {
        await fetch(`${issuerBase(issuer)}/api/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: payload.refresh_token }),
        });
      } catch {
        // Best-effort revoke; local cookie clear + IdP logout still proceed.
      }
    }
  }

  // Clear IdP browser cookies so the next visit is not instantly SSO'd back in.
  // Does not clear bot.liuyidi.me cookies (minibot stays signed in locally).
  const idpLogout = new URL(`${issuerBase(issuer)}/logout`);
  idpLogout.searchParams.set("next", publicOrigin(request));
  const response = NextResponse.redirect(idpLogout);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
