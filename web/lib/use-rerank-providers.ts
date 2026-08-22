import { useEffect, useState } from "react";

import { api, readResponseJson } from "@/lib/api";
import { RERANK_PROVIDER_FALLBACK } from "@/lib/form-options";

export type RerankProviderItem = {
  value: string;
  label: string;
  model?: string;
  available?: boolean;
};

export function useRerankProviders() {
  const [items, setItems] = useState<RerankProviderItem[]>([...RERANK_PROVIDER_FALLBACK]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await api("/v1/platform/rerank-providers");
        if (!resp.ok) return;
        const data = await readResponseJson<{ items?: RerankProviderItem[] }>(resp);
        const next = data.items?.filter((item) => item.available) ?? [];
        if (!cancelled && next.length > 0) {
          setItems(next);
        }
      } catch {
        // Keep fallback list when API is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}
