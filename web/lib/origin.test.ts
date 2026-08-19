import { afterEach, describe, expect, it } from "vitest";
import { publicOrigin, publicUrl } from "./origin";

afterEach(() => {
  delete process.env.MINIKB_PUBLIC_ORIGIN;
  delete process.env.NODE_ENV;
});

describe("publicOrigin", () => {
  it("prefers x-forwarded-host over the container listen address", () => {
    const headers = new Headers({
      host: "0.0.0.0:3000",
      "x-forwarded-host": "kb.liuyidi.me",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin({ headers, url: "http://0.0.0.0:3000/login/callback" })).toBe(
      "https://kb.liuyidi.me",
    );
  });

  it("falls back to MINIKB_PUBLIC_ORIGIN when host is 0.0.0.0", () => {
    process.env.MINIKB_PUBLIC_ORIGIN = "https://kb.liuyidi.me";
    const headers = new Headers({ host: "0.0.0.0:3000" });
    expect(publicOrigin({ headers, url: "http://0.0.0.0:3000/" })).toBe("https://kb.liuyidi.me");
  });

  it("keeps localhost for local OIDC", () => {
    const headers = new Headers({ host: "127.0.0.1:3000" });
    expect(publicOrigin({ headers, url: "http://127.0.0.1:3000/" })).toBe("http://127.0.0.1:3000");
  });
});

describe("publicUrl", () => {
  it("builds an absolute path on the public origin", () => {
    const headers = new Headers({
      "x-forwarded-host": "kb.liuyidi.me",
      "x-forwarded-proto": "https",
    });
    expect(publicUrl({ headers, url: "http://0.0.0.0:3000/login/callback" }, "/").toString()).toBe(
      "https://kb.liuyidi.me/",
    );
  });
});
