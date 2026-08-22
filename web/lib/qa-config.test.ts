// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildRetrievalBody,
  defaultRetrievalPreset,
  loadRetrievalPreset,
  saveRetrievalPreset,
} from "./qa-config";

describe("qa-config", () => {
  it("builds retrieval body with optional rerank", () => {
    const preset = {
      ...defaultRetrievalPreset(),
      top_k: 8,
      rerank: { enabled: true, provider: "bm25", top_n: 3 },
    };
    const body = buildRetrievalBody(preset, "hello");
    expect(body).toEqual({
      query: "hello",
      mode: "vector",
      top_k: 8,
      query_rewrite: false,
      score_threshold: 0,
      vector_weight: 0.6,
      keyword_weight: 0.4,
      rerank: { enabled: true, provider: "bm25", top_n: 3 },
    });
  });

  it("omits rerank when disabled", () => {
    const body = buildRetrievalBody(defaultRetrievalPreset(), "q");
    expect(body.rerank).toBeUndefined();
    expect(body.top_k).toBe(4);
  });

  it("round-trips preset in localStorage", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    const preset = {
      ...defaultRetrievalPreset(),
      mode: "hybrid",
      top_k: 12,
      vector_weight: 0.3,
      rerank: { enabled: true, provider: "cohere", top_n: 4 },
      query_rewrite: true,
    };
    saveRetrievalPreset(preset, "kb-1");
    expect(loadRetrievalPreset("kb-1")).toEqual(preset);

    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
