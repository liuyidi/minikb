import type { DifyAppSummary } from "@/lib/dify-dsl";

export type DifyKbSettingsPatch = {
  opening_statement?: string;
  show_citations?: boolean;
  suggested_questions?: string[];
  suggested_questions_after_answer?: boolean;
  file_upload?: {
    enabled: boolean;
    allowed_types: string[];
    max_count: number;
  };
  content_moderation_enabled?: boolean;
};

export function buildDifyKbSettingsPatch(summary: DifyAppSummary): DifyKbSettingsPatch {
  const { features } = summary;
  const patch: DifyKbSettingsPatch = {
    show_citations: features.retrieverResource,
    suggested_questions: features.suggestedQuestions,
    suggested_questions_after_answer: features.suggestedQuestionsAfterAnswer,
    content_moderation_enabled: features.contentModeration,
  };

  const opening = features.openingStatement?.trim();
  if (opening) {
    patch.opening_statement = opening;
  }

  if (features.fileUpload.enabled || features.fileUpload.allowedTypes.length > 0) {
    patch.file_upload = {
      enabled: features.fileUpload.enabled,
      allowed_types: features.fileUpload.allowedTypes,
      max_count: features.fileUpload.maxCount,
    };
  }

  return patch;
}
