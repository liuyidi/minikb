export const LOCALE_ITEMS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
] as const;

export const RETRIEVAL_MODE_ITEMS = [
  { value: "vector", label: "vector" },
  { value: "keyword", label: "keyword" },
  { value: "hybrid", label: "hybrid" },
] as const;

export const RERANK_PROVIDER_FALLBACK = [
  { value: "qwen", label: "Qwen Rerank" },
  { value: "bm25", label: "BM25 (local)" },
  { value: "cohere", label: "Cohere" },
] as const;

/** @deprecated use useRerankProviders() or RERANK_PROVIDER_FALLBACK */
export const RERANK_PROVIDER_ITEMS = RERANK_PROVIDER_FALLBACK;

export const SOURCE_KIND_ITEMS = [
  { value: "url", label: "URL" },
  { value: "git", label: "Git" },
  { value: "sql", label: "SQL" },
  { value: "feishu", label: "Feishu" },
] as const;

export const FEISHU_ENTRY_ITEMS = [
  { value: "space", label: "Space" },
  { value: "wiki", label: "Wiki" },
  { value: "docx", label: "Docx" },
] as const;
