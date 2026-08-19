"use client";

import { use, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@/components/Button";
import { Card, EmptyState, FormGroup, PageHeader, PageShell, inputStyle } from "@/components/ui";
import { api, apiErrorMessage } from "@/lib/api";

type Hit = {
  score: number;
  doc_title?: string;
  text: string;
};

export default function RetrievalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const [mode, setMode] = useState("vector");
  const [query, setQuery] = useState("");
  const [rerank, setRerank] = useState(false);
  const [rerankProvider, setRerankProvider] = useState("mock");
  const [topN, setTopN] = useState(5);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [meta, setMeta] = useState<{ total: number; elapsed_ms: number; mode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doRetrieval() {
    if (!query.trim()) {
      alert(t("err.query"));
      return;
    }
    setLoading(true);
    setError(null);
    setHits([]);
    setMeta(null);

    const body: Record<string, unknown> = { query: query.trim(), mode, top_k: 10 };
    if (rerank) {
      body.rerank = { enabled: true, provider: rerankProvider, top_n: topN };
    }

    try {
      const resp = await api(`/v1/kb/${kbId}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        setError(apiErrorMessage(await resp.json()));
        return;
      }
      const data = (await resp.json()) as {
        hits: Hit[];
        total: number;
        elapsed_ms: number;
        mode: string;
      };
      setHits(data.hits ?? []);
      setMeta({ total: data.total, elapsed_ms: data.elapsed_ms, mode: data.mode });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("err.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title={t("ret.title")} />

      <Card>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: "auto" }} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="vector">vector</option>
            <option value="keyword">keyword</option>
            <option value="hybrid">hybrid</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)} />
            {t("ret.rerank")}
          </label>
          {rerank ? (
            <>
              <select
                style={{ ...inputStyle, width: "auto" }}
                value={rerankProvider}
                onChange={(e) => setRerankProvider(e.target.value)}
              >
                <option value="mock">mock</option>
                <option value="bm25">bm25</option>
                <option value="cohere">cohere</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                {t("ret.topn")}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={topN}
                  onChange={(e) => setTopN(parseInt(e.target.value, 10) || 5)}
                  style={{ ...inputStyle, width: 72 }}
                />
              </label>
            </>
          ) : null}
        </div>
        <FormGroup label={t("ret.query")}>
          <textarea
            style={{ ...inputStyle, height: "auto", minHeight: 80, padding: "10px 12px" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </FormGroup>
        <Button type="button" onClick={() => void doRetrieval()} disabled={loading}>
          {loading ? t("ret.searching") : t("ret.search")}
        </Button>
      </Card>

      {error ? <p style={{ color: "var(--mini-color-danger)", fontSize: 14 }}>{error}</p> : null}

      {loading ? (
        <p style={{ marginTop: 16, color: "var(--mini-color-muted)", fontSize: 14 }}>{t("ret.searching")}</p>
      ) : hits.length === 0 && meta === null && !error ? null : hits.length === 0 ? (
        <EmptyState message={t("ret.noResults")} />
      ) : (
        <>
          {meta ? (
            <p style={{ margin: "16px 0", fontSize: 13, color: "var(--mini-color-muted)" }}>
              {t("ret.results", { n: meta.total, ms: meta.elapsed_ms.toFixed(0), mode: meta.mode })}
            </p>
          ) : null}
          {hits.map((hit, index) => (
            <Card key={index}>
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--mini-color-surface)",
                    fontSize: 12,
                    fontWeight: 600,
                    marginRight: 8,
                  }}
                >
                  {(hit.score * 100).toFixed(1)}%
                </span>
                <strong>{hit.doc_title ?? "Untitled"}</strong>
              </div>
              <div style={{ fontSize: 13, color: "var(--mini-color-ink-soft)", whiteSpace: "pre-wrap" }}>
                {hit.text}
              </div>
            </Card>
          ))}
        </>
      )}
    </PageShell>
  );
}
