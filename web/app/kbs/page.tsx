"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/providers";
import { CreateKbModal } from "@/components/CreateKbModal";
import { Button } from "@/components/Button";
import { Badge, Card, EmptyState, PageHeader, PageShell } from "@/components/ui";
import { api } from "@/lib/api";
import { kbPath } from "@/lib/paths";

type KbItem = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  kind?: string;
  stats?: { documents?: number; chunks?: number };
};

export default function KbsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<KbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadKbs = useCallback(async () => {
    const resp = await api("/v1/kb");
    if (!resp.ok) return;
    const data = (await resp.json()) as { items: KbItem[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadKbs();
  }, [loadKbs]);

  return (
    <PageShell>
      <PageHeader
        title={t("kb.title")}
        actions={
          <Button type="button" onClick={() => setModalOpen(true)}>
            {t("kb.create")}
          </Button>
        }
      />

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : items.length === 0 ? (
        <EmptyState message={t("kb.empty")} />
      ) : (
        items.map((kb) => (
          <Card key={kb.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15 }}>{kb.name}</span>
              {kb.kind ? <Badge>{kb.kind}</Badge> : null}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--mini-color-muted)" }}>
              {kb.slug}
              {kb.description ? ` · ${kb.description}` : ""}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--mini-color-subtle)" }}>
              {t("kb.docs")}: {kb.stats?.documents ?? 0} · {t("kb.chunks")}: {kb.stats?.chunks ?? 0}
            </p>
            <Link href={kbPath(kb.id)}>
              <Button variant="secondary" type="button">
                {t("kb.manageDocs")}
              </Button>
            </Link>
          </Card>
        ))
      )}

      <CreateKbModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </PageShell>
  );
}
