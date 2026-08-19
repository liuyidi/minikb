"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/providers";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { kbPath } from "@/lib/paths";
import { PageHeader, PageShell, statusBadgeVariant } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";

type KbItem = {
  id: string;
  name: string;
  stats?: { documents?: number; chunks?: number };
};

type DocItem = {
  id: string;
  title: string;
  status: string;
  size_bytes?: number;
};

type ActivityGroup = {
  kb: KbItem;
  docs: DocItem[];
};

export default function HomePage() {
  const { t } = useLocale();
  const [stats, setStats] = useState({ kbs: 0, docs: 0, chunks: 0, sources: 0 });
  const [activity, setActivity] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const kbResp = await api("/v1/kb");
        if (!kbResp.ok) return;
        const kbData = (await kbResp.json()) as { items: KbItem[] };
        const kbs = kbData.items ?? [];

        let totalDocs = 0;
        let totalChunks = 0;
        for (const kb of kbs) {
          totalDocs += kb.stats?.documents ?? 0;
          totalChunks += kb.stats?.chunks ?? 0;
        }

        let totalSources = 0;
        const groups: ActivityGroup[] = [];
        await Promise.all(
          kbs.map(async (kb) => {
            try {
              const [dsResp, docResp] = await Promise.all([
                api(`/v1/kb/${kb.id}/data-sources`),
                api(`/v1/kb/${kb.id}/documents?limit=3`),
              ]);
              if (dsResp.ok) {
                const dsData = (await dsResp.json()) as { total?: number };
                totalSources += dsData.total ?? 0;
              }
              if (docResp.ok) {
                const docData = (await docResp.json()) as { items: DocItem[] };
                if (docData.items?.length) {
                  groups.push({ kb, docs: docData.items.slice(0, 3) });
                }
              }
            } catch {
              /* ignore per-kb errors */
            }
          }),
        );

        setStats({ kbs: kbs.length, docs: totalDocs, chunks: totalChunks, sources: totalSources });
        setActivity(groups);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = [
    { label: t("stat.kbs"), value: stats.kbs },
    { label: t("stat.docs"), value: stats.docs },
    { label: t("stat.chunks"), value: stats.chunks },
    { label: t("stat.sources"), value: stats.sources },
  ];

  return (
    <PageShell>
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {statCards.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: 20,
              borderRadius: "var(--mini-radius-surface)",
              border: "1px solid var(--mini-color-border-soft)",
              background: "var(--mini-color-canvas)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>{stat.value}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--mini-color-muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>{t("dash.recent")}</h2>

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : stats.kbs === 0 ? (
        <EmptyState message={t("dash.empty")} />
      ) : activity.length === 0 ? (
        <EmptyState message={t("dash.noActivity")} />
      ) : (
        activity.map(({ kb, docs }) => (
          <Card key={kb.id}>
            <div style={{ marginBottom: 12 }}>
              <Link
                href={kbPath(kb.id)}
                style={{ fontWeight: 600, fontSize: 15, textDecoration: "underline" }}
              >
                {kb.name}
              </Link>
            </div>
            {docs.map((doc) => (
              <div
                key={doc.id}
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "var(--mini-color-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>{doc.title}</span>
                <Badge variant={statusBadgeVariant(doc.status)}>{doc.status}</Badge>
                <span>· {formatBytes(doc.size_bytes)}</span>
              </div>
            ))}
          </Card>
        ))
      )}
    </PageShell>
  );
}
