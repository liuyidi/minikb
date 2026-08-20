export const LOCALE_ITEMS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
] as const;

export const RETRIEVAL_MODE_ITEMS = [
  { value: "vector", label: "vector" },
  { value: "keyword", label: "keyword" },
  { value: "hybrid", label: "hybrid" },
] as const;

export const RERANK_PROVIDER_ITEMS = [
  { value: "mock", label: "mock" },
  { value: "bm25", label: "bm25" },
  { value: "cohere", label: "cohere" },
] as const;

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
