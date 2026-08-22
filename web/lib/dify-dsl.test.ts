// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatDifyFlow, parseDifyDsl } from "./dify-dsl";
import { difyStarterPreset, presetFromDifyRetrieval } from "./qa-config";

describe("dify-dsl", () => {
  it("parses the Dify knowledge-base starter YAML", () => {
    const fixture = readFileSync(
      resolve(__dirname, "../../tests/fixtures/dify-knowledge-starter.yml"),
      "utf8",
    );
    const summary = parseDifyDsl(fixture);

    expect(summary.appName).toContain("知识库");
    expect(summary.mode).toBe("advanced-chat");
    expect(summary.openingStatement).toContain("你好");
    expect(summary.features.retrieverResource).toBe(true);
    expect(summary.features.fileUpload.enabled).toBe(true);
    expect(summary.features.suggestedQuestionsAfterAnswer).toBe(false);
    expect(summary.retrieval?.topK).toBe(4);
    expect(summary.retrieval?.rerankEnabled).toBe(false);
    expect(summary.llm?.model).toBe("gpt-5.4-mini");
    expect(summary.flowNodes.map((node) => node.type).sort()).toEqual(
      ["answer", "knowledge-retrieval", "llm", "start"].sort(),
    );
    expect(formatDifyFlow(summary)).toContain("用户输入");
    expect(summary.noteCount).toBeGreaterThan(0);
  });
});

describe("qa-config dify preset", () => {
  it("uses vector top_k=4 without rerank", () => {
    expect(difyStarterPreset()).toEqual({
      mode: "vector",
      top_k: 4,
      rerank: { enabled: false, provider: "qwen", top_n: 5 },
      query_rewrite: false,
    });
  });

  it("maps Dify retrieval config", () => {
    const preset = presetFromDifyRetrieval({ topK: 8, rerankEnabled: true });
    expect(preset.top_k).toBe(8);
    expect(preset.rerank.enabled).toBe(true);
  });
});
