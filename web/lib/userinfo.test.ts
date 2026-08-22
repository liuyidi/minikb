// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasReadableProfile, resolveDisplayName } from "./userinfo";

describe("resolveDisplayName", () => {
  it("prefers name then nickname then email", () => {
    expect(
      resolveDisplayName({
        sub: "uuid",
        name: "Alice",
        nickname: "ali",
        email: "a@example.com",
      }),
    ).toBe("Alice");
    expect(resolveDisplayName({ sub: "uuid", nickname: "ali", email: "a@example.com" })).toBe(
      "ali",
    );
    expect(resolveDisplayName({ sub: "uuid", email: "a@example.com" })).toBe("a@example.com");
  });

  it("falls back to sub when profile fields are empty", () => {
    expect(resolveDisplayName({ sub: "75a04a34-5c13-4598-8bf2-b3770ed74ab2" })).toBe(
      "75a04a34-5c13-4598-8bf2-b3770ed74ab2",
    );
  });
});

describe("hasReadableProfile", () => {
  it("returns false when only sub would be shown", () => {
    expect(hasReadableProfile({})).toBe(false);
    expect(hasReadableProfile({ name: "  " })).toBe(false);
  });

  it("returns true when any profile field is set", () => {
    expect(hasReadableProfile({ nickname: "demo" })).toBe(true);
  });
});
