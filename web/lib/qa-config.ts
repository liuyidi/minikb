export type RerankConfig = {
  enabled: boolean;
  provider: string;
  top_n: number;
};

export type RetrievalPreset = {
  mode: string;
  top_k: number;
  rerank: RerankConfig;
  query_rewrite: boolean;
  score_threshold: number;
  vector_weight: number;
};

export const DEFAULT_OPENING_STATEMENT_ZH =
  "你好！👋 你可以问我任何关于文档的问题，我会根据知识库里的内容回答。";
export const DEFAULT_OPENING_STATEMENT_EN =
  "Hi! Ask me anything about your documents — I'll answer using your knowledge base.";

const STORAGE_PREFIX = "minikb:retrieval-preset";

/** Dify「知识库：连接你的知识数据」模版默认检索参数 */
export function difyStarterPreset(): RetrievalPreset {
  return {
    mode: "vector",
    top_k: 4,
    rerank: { enabled: false, provider: "qwen", top_n: 5 },
    query_rewrite: false,
    score_threshold: 0.0,
    vector_weight: 0.6,
  };
}

export function defaultRetrievalPreset(): RetrievalPreset {
  return difyStarterPreset();
}

function storageKey(kbId?: string): string {
  return kbId ? `${STORAGE_PREFIX}:${kbId}` : STORAGE_PREFIX;
}

export function loadRetrievalPreset(kbId?: string): RetrievalPreset {
  if (typeof window === "undefined") return defaultRetrievalPreset();
  try {
    const raw = window.localStorage.getItem(storageKey(kbId));
    if (!raw) return defaultRetrievalPreset();
    const parsed = JSON.parse(raw) as Partial<RetrievalPreset>;
    const defaults = defaultRetrievalPreset();
    const rerankProvider =
      parsed.rerank?.provider === "mock" ? defaults.rerank.provider : parsed.rerank?.provider;
    return {
      mode: parsed.mode ?? defaults.mode,
      top_k: parsed.top_k ?? defaults.top_k,
      query_rewrite: parsed.query_rewrite ?? defaults.query_rewrite,
      score_threshold: parsed.score_threshold ?? defaults.score_threshold,
      vector_weight: parsed.vector_weight ?? defaults.vector_weight,
      rerank: {
        enabled: parsed.rerank?.enabled ?? defaults.rerank.enabled,
        provider: rerankProvider ?? defaults.rerank.provider,
        top_n: parsed.rerank?.top_n ?? defaults.rerank.top_n,
      },
    };
  } catch {
    return defaultRetrievalPreset();
  }
}

export function saveRetrievalPreset(preset: RetrievalPreset, kbId?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(kbId), JSON.stringify(preset));
}

export function applyDifyStarterPreset(kbId?: string): RetrievalPreset {
  const preset = difyStarterPreset();
  saveRetrievalPreset(preset, kbId);
  return preset;
}

export function defaultOpeningStatement(locale: string): string {
  return locale.startsWith("zh") ? DEFAULT_OPENING_STATEMENT_ZH : DEFAULT_OPENING_STATEMENT_EN;
}

export function resolveOpeningStatement(
  stored: string | null | undefined,
  locale: string,
): string {
  const trimmed = stored?.trim();
  return trimmed || defaultOpeningStatement(locale);
}

export function keywordWeight(preset: RetrievalPreset): number {
  return Math.max(0, Math.min(1, 1 - preset.vector_weight));
}

export function buildRetrievalBody(preset: RetrievalPreset, query: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query,
    mode: preset.mode,
    top_k: preset.top_k,
    query_rewrite: preset.query_rewrite,
    score_threshold: preset.score_threshold,
    vector_weight: preset.vector_weight,
    keyword_weight: keywordWeight(preset),
  };
  if (preset.rerank.enabled) {
    body.rerank = {
      enabled: true,
      provider: preset.rerank.provider,
      top_n: preset.rerank.top_n,
    };
  }
  return body;
}

/** Map Dify knowledge-retrieval node config to minikb preset */
export function presetFromDifyRetrieval(config: {
  topK?: number;
  rerankEnabled?: boolean;
}): RetrievalPreset {
  const base = difyStarterPreset();
  if (config.topK != null) base.top_k = config.topK;
  if (config.rerankEnabled != null) {
    base.rerank = { ...base.rerank, enabled: config.rerankEnabled };
  }
  return base;
}

export function formatHitScore(score: number, mode: string): string {
  if (mode === "vector" || mode.startsWith("vector")) {
    return `${(score * 100).toFixed(1)}%`;
  }
  return score.toFixed(4);
}
