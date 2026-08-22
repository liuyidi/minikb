// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildDifyKbSettingsPatch } from "./dify-apply";
import type { DifyAppSummary } from "./dify-dsl";

function minimalSummary(overrides: Partial<DifyAppSummary> = {}): DifyAppSummary {
  return {
    appName: "Test",
    mode: "advanced-chat",
    retrieverResource: true,
    features: {
      openingStatement: "Hello",
      suggestedQuestions: ["Q1", "Q2"],
      suggestedQuestionsAfterAnswer: true,
      retrieverResource: true,
      fileUpload: { enabled: true, allowedTypes: ["image"], maxCount: 3 },
      contentModeration: false,
    },
    flowNodes: [],
    flowEdges: [],
    rawNodeCount: 0,
    noteCount: 0,
    ...overrides,
  };
}

describe("dify-apply", () => {
  it("maps Dify features to KB settings patch", () => {
    const patch = buildDifyKbSettingsPatch(minimalSummary());
    expect(patch).toEqual({
      opening_statement: "Hello",
      show_citations: true,
      suggested_questions: ["Q1", "Q2"],
      suggested_questions_after_answer: true,
      content_moderation_enabled: false,
      file_upload: {
        enabled: true,
        allowed_types: ["image"],
        max_count: 3,
      },
    });
  });
});
