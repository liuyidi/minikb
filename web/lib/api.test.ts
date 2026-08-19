import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./api";

describe("apiErrorMessage", () => {
  it("reads FastAPI detail string", () => {
    expect(apiErrorMessage({ detail: "Invalid API key" })).toBe("Invalid API key");
  });
});
