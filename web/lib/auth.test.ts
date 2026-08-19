import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, randomVerifier } from "./auth";

describe("buildAuthorizeUrl", () => {
  it("includes PKCE and client_id", () => {
    const verifier = randomVerifier();
    const url = buildAuthorizeUrl({
      issuer: "https://auth.liuyidi.me",
      clientId: "minikb",
      redirectUri: "http://127.0.0.1:3000/login/callback",
      state: "abc",
      codeVerifier: verifier,
    });
    expect(url).toContain("/oauth/authorize?");
    expect(url).toContain("client_id=minikb");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("redirect_uri=");
  });
});
