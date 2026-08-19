"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { inputClassName as inputStyle } from "@minikb/ui/lib/field-styles";
import { api } from "@/lib/api";

type ChunkItem = {
  id: string;
  seq: number;
  text: string;
  tokens?: number;
  document_id: string;
  meta?: { heading_path?: string | string[]; enriched_heading_path?: string | string[]; language?: string };
};

type DocOption = { id: string; title: string };

type ChunkStats = {
  total_chunks: number;
  total_tokens?: number;
  avg_chunk_chars?: number;
};

const PAGE_SIZE = 20;

function headingPath(meta?: ChunkItem["meta"]): string | null {
  const path = meta?.heading_path ?? meta?.enriched_heading_path;
  if (!path) return null;
  return Array.isArray(path) ? path.join(" > ") : path;
}

export default function ChunksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [docId, setDocId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void (async () => {
      const resp = await api(`/v1/kb/${kbId}/documents`);
      if (resp.ok) {
        const data = (await resp.json()) as { items: DocOption[] };
        setDocs(data.items ?? []);
      }
    })();
  }, [kbId]);

  const loadChunks = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (docId) params.set("document_id", docId);
    if (debouncedSearch) params.set("search", debouncedSearch);

    const [chunkResp, statsResp] = await Promise.all([
      api(`/v1/kb/${kbId}/chunks?${params}`),
      api(`/v1/kb/${kbId}/chunks/stats`),
    ]);

    if (chunkResp.ok) {
      const data = (await chunkResp.json()) as { items: ChunkItem[]; total: number };
      setChunks(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    if (statsResp.ok) {
      setStats((await statsResp.json()) as ChunkStats);
    }
    setLoading(false);
  }, [kbId, page, docId, debouncedSearch]);

  useEffect(() => {
    void loadChunks();
  }, [loadChunks]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const highlight = useMemo(() => {
    if (!debouncedSearch) return null;
    try {
      return new RegExp(`(${debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    } catch {
      return null;
    }
  }, [debouncedSearch]);

  function renderText(text: string) {
    if (!highlight) return text;
    const parts = text.split(highlight);
    return parts.map((part, index) =>
      highlight.test(part) ? (
        <mark key={index} style={{ background: "#fff3cd", padding: "1px 2px" }}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }

  return (
    <PageShell>
      <PageHeader title={t("chunk.title")} />

      {stats ? (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: t("stat.chunks"), value: stats.total_chunks },
            { label: t("chunk.tokens"), value: (stats.total_tokens ?? 0).toLocaleString() },
            { label: t("chunk.avgChars"), value: stats.avg_chunk_chars ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: 12,
                border: "1px solid var(--mini-color-border-soft)",
                borderRadius: "var(--mini-radius-control)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "var(--mini-color-muted)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select
          className={inputStyle}
          style={{ width: "auto", minWidth: 180 }}
          value={docId}
          onChange={(e) => { setDocId(e.target.value); setPage(0); }}
        >
          <option value="">{t("chunk.allDocs")}</option>
          {docs.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title}
            </option>
          ))}
        </select>
        <input
          className={inputStyle}
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("chunk.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : chunks.length === 0 ? (
        <EmptyState message={t("chunk.empty")} />
      ) : (
        chunks.map((chunk) => {
          const path = headingPath(chunk.meta);
          const isExpanded = expanded === chunk.id;
          return (
            <Card key={chunk.id}>
              <div
                style={{ cursor: "pointer" }}
                onClick={() => setExpanded(isExpanded ? null : chunk.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Chunk #{chunk.seq + 1}</span>
                  <Badge>{chunk.tokens ?? "?"} tok</Badge>
                </div>
                {path ? (
                  <div style={{ fontSize: 12, color: "#3538cd", marginBottom: 8 }}>{path}</div>
                ) : null}
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--mini-color-ink-soft)",
                    maxHeight: isExpanded ? "none" : 100,
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {renderText(chunk.text)}
                </div>
              </div>
              {isExpanded ? (
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--mini-color-muted)" }}>
                  <strong>ID:</strong> {chunk.id}
                  <br />
                  <strong>Doc:</strong> {chunk.document_id}
                  {chunk.meta?.language ? (
                    <>
                      <br />
                      <strong>Lang:</strong> {chunk.meta.language}
                    </>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        {totalPages > 1 ? (
          <>
            <Button
              variant="secondary"
              type="button"
              disabled={page === 0}
              style={{ fontSize: 12, height: 36 }}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("chunk.prev")}
            </Button>
            <span style={{ fontSize: 13, color: "var(--mini-color-muted)" }}>
              {t("chunk.page", { page: page + 1, total: totalPages, n: total })}
            </span>
            <Button
              variant="secondary"
              type="button"
              disabled={page >= totalPages - 1}
              style={{ fontSize: 12, height: 36 }}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("chunk.next")}
            </Button>
          </>
        ) : (
          <span style={{ fontSize: 13, color: "var(--mini-color-muted)" }}>
            {t("chunk.count", { n: total })}
          </span>
        )}
      </div>
    </PageShell>
  );
}
