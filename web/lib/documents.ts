import { api } from "@/lib/api";

export type DocListItem = {
  id: string;
  title: string;
  meta?: Record<string, unknown>;
};

export async function fetchAllDocuments(kbId: string): Promise<DocListItem[]> {
  const items: DocListItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const resp = await api(`/v1/kb/${kbId}/documents?limit=${limit}&offset=${offset}`);
    if (!resp.ok) break;
    const data = (await resp.json()) as { items: DocListItem[]; total: number };
    items.push(...(data.items ?? []));
    if (items.length >= (data.total ?? 0) || (data.items?.length ?? 0) < limit) break;
    offset += limit;
  }

  return items;
}
