"use client";

import Link from "next/link";
import { use, useCallback, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";

import { Button } from "@minikb/ui/components/ui/button";
import { Card } from "@minikb/ui/components/ui/card";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { toast } from "@minikb/ui/components/ui/sonner";
import { useLocale } from "@/app/providers";
import { api, apiErrorFromResponse } from "@/lib/api";
import { buildDifyKbSettingsPatch } from "@/lib/dify-apply";
import { formatDifyFlow, parseDifyDsl, type DifyAppSummary } from "@/lib/dify-dsl";
import { kbPath } from "@/lib/paths";
import { presetFromDifyRetrieval, saveRetrievalPreset } from "@/lib/qa-config";

function FeatureRow({
  label,
  value,
  supported,
  supportedLabel,
  plannedLabel,
}: {
  label: string;
  value: string;
  supported: boolean;
  supportedLabel: string;
  plannedLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2.5 last:border-0">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{value}</div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          supported
            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
            : "bg-amber-500/15 text-amber-900 dark:text-amber-100"
        }`}
      >
        {supported ? supportedLabel : plannedLabel}
      </span>
    </div>
  );
}

export default function DifyImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState("");
  const [summary, setSummary] = useState<DifyAppSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);

  const parseSource = useCallback(
    async (text: string) => {
      setError(null);
      const trimmed = text.trim();
      if (!trimmed) {
        const message = t("dify.emptySource");
        setError(message);
        toast.error(message);
        return;
      }
      setParsing(true);
      try {
        const next = parseDifyDsl(trimmed);
        setSummary(next);
        toast.success(t("dify.parseSuccess"));
        requestAnimationFrame(() => {
          previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (e) {
        setSummary(null);
        const message = e instanceof Error ? e.message : t("dify.parseError");
        setError(message);
        toast.error(message);
      } finally {
        setParsing(false);
      }
    },
    [t],
  );

  function onFileChange(file: File | null) {
    if (!file) return;
    void file.text().then((text) => {
      setSource(text);
      void parseSource(text);
    });
  }

  async function applyToKb() {
    if (!summary || applying) return;
    setApplying(true);
    setError(null);
    const toastId = toast.loading(t("dify.applying"));
    try {
      const preset = summary.retrieval
        ? presetFromDifyRetrieval({
            topK: summary.retrieval.topK,
            rerankEnabled: summary.retrieval.rerankEnabled,
          })
        : presetFromDifyRetrieval({ topK: 4, rerankEnabled: false });
      saveRetrievalPreset(preset, kbId);

      const patch = buildDifyKbSettingsPatch(summary);
      const hasServerFields = Object.keys(patch).length > 0;
      if (hasServerFields) {
        const resp = await api(`/v1/kb/${kbId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!resp.ok) {
          const message = await apiErrorFromResponse(resp);
          toast.warning(t("dify.applyPartial"), {
            id: toastId,
            description: message,
          });
          setError(`${t("dify.applyFailed")}: ${message}`);
          return;
        }
      }

      toast.success(t("dify.applySuccess"), {
        id: toastId,
        description: t("dify.applySuccessHint"),
        action: {
          label: t("dify.goQa"),
          onClick: () => {
            window.location.href = kbPath(kbId, "qa");
          },
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("dify.applyFailed");
      toast.error(t("dify.applyFailed"), { id: toastId, description: message });
      setError(message);
    } finally {
      setApplying(false);
    }
  }

  const features = summary?.features;

  return (
    <PageShell>
      <PageHeader
        title={t("dify.title")}
        actions={
          <Button variant="secondary" nativeButton={false} render={<Link href={kbPath(kbId, "qa")} />}>
            <ArrowLeft className="size-4" />
            {t("dify.backQa")}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">{t("dify.desc")}</p>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".yml,.yaml,text/yaml"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" />
            {t("dify.upload")}
          </Button>
          <Button
            type="button"
            onClick={() => void parseSource(source)}
            disabled={!source.trim() || parsing}
          >
            {parsing ? <Loader2 className="size-4 animate-spin" /> : null}
            {parsing ? t("dify.parsing") : t("dify.preview")}
          </Button>
        </div>
        <textarea
          className="min-h-[160px] w-full rounded-[var(--radius)] border border-border bg-background p-3 text-sm"
          placeholder={t("dify.pastePlaceholder")}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </Card>

      {error ? (
        <p className="mb-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div ref={previewRef} className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">{summary.icon ?? "📚"}</span>
              <div>
                <h2 className="m-0 text-base font-semibold">{summary.appName}</h2>
                <p className="m-0 text-xs text-muted-foreground">
                  {summary.mode} · {summary.flowNodes.length} {t("dify.nodes")} · {summary.noteCount}{" "}
                  {t("dify.notes")}
                </p>
              </div>
            </div>
            {summary.openingStatement ? (
              <p className="mt-3 rounded-[var(--radius)] bg-muted/30 p-3 text-sm">{summary.openingStatement}</p>
            ) : null}
          </Card>

          {features ? (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold">{t("dify.featuresTitle")}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{t("dify.featuresDesc")}</p>
              <FeatureRow
                label={t("dify.featureOpening")}
                value={features.openingStatement?.trim() ? t("dify.configured") : t("dify.notConfigured")}
                supported
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
              <FeatureRow
                label={t("dify.featureSuggested")}
                value={
                  features.suggestedQuestions.length > 0
                    ? features.suggestedQuestions.join(" · ")
                    : features.suggestedQuestionsAfterAnswer
                      ? t("dify.afterAnswerOn")
                      : t("dify.off")
                }
                supported={features.suggestedQuestions.length > 0}
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
              <FeatureRow
                label={t("dify.featureFollowUp")}
                value={features.suggestedQuestionsAfterAnswer ? t("dify.on") : t("dify.off")}
                supported={false}
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
              <FeatureRow
                label={t("dify.featureUpload")}
                value={
                  features.fileUpload.enabled
                    ? `${t("dify.on")} · ${features.fileUpload.allowedTypes.join(", ") || "—"} · max ${features.fileUpload.maxCount || "—"}`
                    : t("dify.off")
                }
                supported={false}
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
              <FeatureRow
                label={t("dify.featureCitations")}
                value={features.retrieverResource ? t("dify.on") : t("dify.off")}
                supported
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
              <FeatureRow
                label={t("dify.featureModeration")}
                value={features.contentModeration ? t("dify.on") : t("dify.off")}
                supported={false}
                supportedLabel={t("dify.supported")}
                plannedLabel={t("dify.planned")}
              />
            </Card>
          ) : null}

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">{t("dify.flow")}</h3>
            <pre className="m-0 whitespace-pre-wrap rounded-[var(--radius)] bg-muted/20 p-3 text-xs leading-relaxed">
              {formatDifyFlow(summary)}
            </pre>
            <ul className="mt-3 space-y-1 text-sm">
              {summary.flowNodes.map((node) => (
                <li key={node.id}>
                  <span className="font-medium">{node.title}</span>
                  <span className="text-muted-foreground"> ({node.type})</span>
                </li>
              ))}
            </ul>
          </Card>

          {summary.retrieval ? (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("dify.retrieval")}</h3>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Top-K</dt>
                  <dd className="m-0 font-medium">{summary.retrieval.topK}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Rerank</dt>
                  <dd className="m-0 font-medium">
                    {summary.retrieval.rerankEnabled ? t("dify.on") : t("dify.off")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("dify.vectorWeight")}</dt>
                  <dd className="m-0 font-medium">{summary.retrieval.vectorWeight}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("dify.keywordWeight")}</dt>
                  <dd className="m-0 font-medium">{summary.retrieval.keywordWeight}</dd>
                </div>
                {summary.retrieval.embeddingModel ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Embedding</dt>
                    <dd className="m-0 font-medium">{summary.retrieval.embeddingModel}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}

          {summary.llm ? (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("dify.llm")}</h3>
              <p className="m-0 text-sm">
                <span className="text-muted-foreground">Model: </span>
                {summary.llm.model}
                {summary.llm.retryEnabled ? ` · ${t("dify.retryOn")}` : ""}
              </p>
              {summary.llm.systemPrompt ? (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-[var(--radius)] bg-muted/20 p-3 text-xs">
                  {summary.llm.systemPrompt}
                </pre>
              ) : null}
            </Card>
          ) : null}

          <Card className="border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 text-primary" />
                <p className="m-0 text-sm">{t("dify.applyHint")}</p>
              </div>
              <Button type="button" disabled={applying || !summary} onClick={() => void applyToKb()}>
                {applying ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {applying ? t("dify.applying") : t("dify.apply")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}
