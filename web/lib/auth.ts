import { createHash, randomBytes } from "node:crypto";

export function randomVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(opts: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid profile email",
    state: opts.state,
    code_challenge: codeChallenge(opts.codeVerifier),
    code_challenge_method: "S256",
  });
  return `${opts.issuer.replace(/\/$/, "")}/oauth/authorize?${params.toString()}`;
}

export function authEnv() {
  const issuer = process.env.MINIAUTH_ISSUER ?? "https://auth.liuyidi.me";
  const clientId = process.env.MINIAUTH_CLIENT_ID ?? "minikb";
  const redirectUri =
    process.env.MINIAUTH_REDIRECT_URI ?? "http://127.0.0.1:3000/login/callback";
  const sessionSecret = process.env.MINIKB_SESSION_SECRET ?? "";
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("MINIKB_SESSION_SECRET must be at least 32 characters");
  }
  return { issuer, clientId, redirectUri, sessionSecret };
}

export function issuerBase(issuer: string): string {
  return issuer.replace(/\/$/, "");
}
