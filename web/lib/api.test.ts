import { describe, expect, it } from "vitest";
import { apiErrorFromResponse, apiErrorMessage, readResponseBody } from "./api";

describe("apiErrorMessage", () => {
  it("reads FastAPI detail string", () => {
    expect(apiErrorMessage({ detail: "Invalid API key" })).toBe("Invalid API key");
  });

  it("reads FastAPI validation detail array", () => {
    expect(apiErrorMessage({ detail: [{ msg: "field required" }] })).toBe("field required");
  });
});

describe("readResponseBody", () => {
  it("wraps non-json text as detail", async () => {
    const resp = new Response("Internal Server Error", { status: 500 });
    await expect(readResponseBody(resp)).resolves.toEqual({ detail: "Internal Server Error" });
  });
});

describe("apiErrorFromResponse", () => {
  it("surfaces proxy plain-text errors", async () => {
    const resp = new Response("Internal Server Error", { status: 500 });
    await expect(apiErrorFromResponse(resp)).resolves.toBe("Internal Server Error");
  });
});
