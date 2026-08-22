"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { inputClassName as inputStyle } from "@minikb/ui/lib/field-styles";
import { RetrievalSettingsPanel } from "@/components/retrieval/RetrievalSettingsPanel";
import { api, apiErrorMessage } from "@/lib/api";
import { useRerankProviders } from "@/lib/use-rerank-providers";
import {
  buildRetrievalBody,
  formatHitScore,
  loadRetrievalPreset,
  saveRetrievalPreset,
  type RetrievalPreset,
} from "@/lib/qa-config";

type Hit = {
  score: number;
  doc_title?: string;
  text: string;
};

export default function RetrievalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const { items: rerankProviders } = useRerankProviders();
  const [preset, setPreset] = useState<RetrievalPreset>(() => loadRetrievalPreset(kbId));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [meta, setMeta] = useState<{ total: number; elapsed_ms: number; mode: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  useEffect(() => {
    setPreset(loadRetrievalPreset(kbId));
  }, [kbId]);

  useEffect(() => {
    const q = searchParams.get("query");
    if (q) setQuery(q);
  }, [searchParams]);

  function updatePreset(next: RetrievalPreset) {
    setPreset(next);
    saveRetrievalPreset(next, kbId);
  }

  async function doRetrieval() {
    if (!query.trim()) {
      alert(t("err.query"));
      return;
    }
    setLoading(true);
    setError(null);
    setHits([]);
    setMeta(null);
    setRanOnce(true);

    const body = buildRetrievalBody(preset, query.trim());

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
      <PageHeader title={t("ret.pageTitle")} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="w-full shrink-0 lg:w-[320px]">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{t("ret.settingsTitle")}</h2>
          <RetrievalSettingsPanel
            preset={preset}
            onChange={updatePreset}
            t={t}
            rerankProviders={rerankProviders}
            topKMax={100}
            showPlanned
          />
          <div className="mt-6 space-y-2 border-t border-border/60 pt-4">
            <label className="text-xs text-muted-foreground">{t("ret.query")}</label>
            <textarea
              className={inputStyle}
              style={{ height: "auto", minHeight: 88, padding: "10px 12px" }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ret.queryPlaceholder")}
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => void doRetrieval()}
              disabled={loading}
            >
              <Send className="mr-2 size-4" />
              {loading ? t("ret.searching") : t("ret.run")}
            </Button>
          </div>
        </Card>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t("ret.resultsTitle")}</h2>
            {meta ? (
              <span className="text-xs text-muted-foreground">
                {t("ret.total", { n: meta.total })}
                {" · "}
                {meta.elapsed_ms.toFixed(0)}ms
                {" · "}
                {meta.mode}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="mb-4 text-sm text-[var(--mini-color-danger)]">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("ret.searching")}</p>
          ) : !ranOnce ? (
            <EmptyState message={t("ret.emptyState")} />
          ) : hits.length === 0 ? (
            <EmptyState message={t("ret.noResults")} />
          ) : (
            <div className="space-y-3">
              {hits.map((hit, index) => (
                <Card key={index}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {formatHitScore(hit.score, preset.mode)}
                    </span>
                    <strong className="text-sm">{hit.doc_title ?? t("qa.untitled")}</strong>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">{hit.text}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
