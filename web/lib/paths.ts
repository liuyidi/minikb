const KB_PAGES = [
  "documents",
  "sources",
  "chunks",
  "retrieval",
  "qa",
  "eval",
  "settings",
] as const;

export type KbPage = (typeof KB_PAGES)[number];

export function kbPath(id: string, page: KbPage = "documents"): string {
  return `/kb/${id}/${page}`;
}

export function isSafeNextPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}
