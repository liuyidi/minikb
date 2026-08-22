"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";

import { Badge } from "@minikb/ui/components/ui/badge";
import { Button } from "@minikb/ui/components/ui/button";
import { Card } from "@minikb/ui/components/ui/card";
import { useLocale } from "@/app/providers";
import { api, readResponseJson } from "@/lib/api";

type PlatformModelItem = {
  id: string;
  label: string;
  slot: string;
  model: string;
  api_base?: string;
  available: boolean;
};

type PlatformDefaults = {
  llm: { slot: string; label: string; model: string; api_base?: string; available: boolean };
  embedding: {
    model: string;
    provider: string;
    dim: number;
    api_base?: string;
    available: boolean;
  };
  rerank: { provider: string; label: string; model: string; available: boolean };
};

type RerankProviderItem = {
  value: string;
  label: string;
  model?: string;
  available?: boolean;
};

function StatusBadge({ available, t }: { available: boolean; t: (key: string) => string }) {
  return available ? (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="size-3" />
      {t("models.available")}
    </Badge>
  ) : (
    <Badge variant="warning" className="gap-1">
      <CircleAlert className="size-3" />
      {t("models.missingKey")}
    </Badge>
  );
}

function ModelRow({
  label,
  value,
  sub,
  available,
  t,
}: {
  label: string;
  value: string;
  sub?: string;
  available: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-sm text-foreground">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      <StatusBadge available={available} t={t} />
    </div>
  );
}

export function ModelStatusPanel({ kbEmbeddingModel }: { kbEmbeddingModel?: string | null }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState<PlatformDefaults | null>(null);
  const [models, setModels] = useState<PlatformModelItem[]>([]);
  const [rerankProviders, setRerankProviders] = useState<RerankProviderItem[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [defaultsResp, modelsResp, rerankResp] = await Promise.all([
        api("/v1/platform/defaults"),
        api("/v1/platform/models"),
        api("/v1/platform/rerank-providers"),
      ]);
      if (defaultsResp.ok) {
        setDefaults(await readResponseJson<PlatformDefaults>(defaultsResp));
      }
      if (modelsResp.ok) {
        const data = await readResponseJson<{ items?: PlatformModelItem[] }>(modelsResp);
        setModels(data.items ?? []);
      }
      if (rerankResp.ok) {
        const data = await readResponseJson<{ items?: RerankProviderItem[] }>(rerankResp);
        setRerankProviders(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const kbOverride = kbEmbeddingModel?.trim();
  const embeddingModel = kbOverride || defaults?.embedding.model || "—";
  const embeddingSub = kbOverride
    ? `${t("models.kbOverride")} · ${defaults?.embedding.provider ?? "—"} · dim ${defaults?.embedding.dim ?? "—"}`
    : `${defaults?.embedding.provider ?? "—"} · dim ${defaults?.embedding.dim ?? "—"} · ${defaults?.embedding.api_base ?? ""}`;

  return (
    <Card className="mb-4 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">{t("models.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("models.desc")}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          {t("models.refresh")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">...</p>
      ) : defaults ? (
        <div className="mb-6 rounded-[var(--radius)] border border-border/60 bg-muted/10 px-4 py-1">
          <ModelRow
            label={t("models.llm")}
            value={`${defaults.llm.label} · ${defaults.llm.model}`}
            sub={defaults.llm.api_base || undefined}
            available={defaults.llm.available}
            t={t}
          />
          <ModelRow
            label={t("models.embedding")}
            value={embeddingModel}
            sub={embeddingSub}
            available={defaults.embedding.available}
            t={t}
          />
          <ModelRow
            label={t("models.rerank")}
            value={`${defaults.rerank.label} · ${defaults.rerank.model}`}
            available={defaults.rerank.available}
            t={t}
          />
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">{t("models.loadFailed")}</p>
      )}

      <h3 className="mb-2 text-sm font-semibold">{t("models.slotsTitle")}</h3>
      <div className="space-y-2">
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("models.slotsEmpty")}</p>
        ) : (
          models.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border/50 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">
                  {item.slot} · {item.model}
                </div>
              </div>
              <StatusBadge available={item.available} t={t} />
            </div>
          ))
        )}
      </div>

      {rerankProviders.length > 0 ? (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold">{t("models.rerankProvidersTitle")}</h3>
          <div className="flex flex-wrap gap-2">
            {rerankProviders.map((item) => (
              <Badge
                key={item.value}
                variant={item.available ? "secondary" : "outline"}
                className="text-xs"
              >
                {item.label}
                {item.model ? ` · ${item.model}` : ""}
              </Badge>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">{t("models.envHint")}</p>
    </Card>
  );
}
