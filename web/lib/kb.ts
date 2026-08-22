export type KbSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  kind?: string;
  visibility?: string;
  stats?: { documents?: number; chunks?: number };
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export function formatKbDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

export function kbEmbeddingLabel(meta: Record<string, unknown> | undefined): string {
  const model = meta?.embedding_model;
  if (typeof model === "string" && model.trim()) return model.trim();
  return "—";
}
