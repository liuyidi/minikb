import { describe, expect, it } from "vitest";
import { isSafeNextPath, kbPath } from "./paths";

describe("kbPath", () => {
  it("scopes documents under a kb id", () => {
    expect(kbPath("abc")).toBe("/kb/abc/documents");
    expect(kbPath("abc", "qa")).toBe("/kb/abc/qa");
  });
});

describe("isSafeNextPath", () => {
  it("rejects open redirects", () => {
    expect(isSafeNextPath("/kb/1/documents")).toBe(true);
    expect(isSafeNextPath("https://evil.example")).toBe(false);
    expect(isSafeNextPath("//evil.example")).toBe(false);
  });
});
