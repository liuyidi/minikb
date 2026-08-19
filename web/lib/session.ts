import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "minikb_session";
export const OAUTH_STATE_COOKIE = "minikb_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "minikb_oauth_verifier";
export const OAUTH_NEXT_COOKIE = "minikb_oauth_next";

export type SessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  sub: string;
};

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function sealSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secretKey(secret));
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    const access_token = payload.access_token;
    const refresh_token = payload.refresh_token;
    const expires_at = payload.expires_at;
    const sub = payload.sub;
    if (
      typeof access_token !== "string" ||
      typeof refresh_token !== "string" ||
      typeof expires_at !== "number" ||
      typeof sub !== "string"
    ) {
      return null;
    }
    return { access_token, refresh_token, expires_at, sub };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function pkceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
}

export function clearCookieOptions() {
  return {
    ...pkceCookieOptions(),
    maxAge: 0,
  };
}
