"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { api, apiErrorMessage } from "@/lib/api";

type Dataset = {
  id: string;
  name: string;
  size?: number;
  created_at?: string;
};

type EvalRun = {
  id: string;
  status: string;
  created_at?: string;
  params?: { mode?: string; top_k?: number };
  metrics?: Record<string, number>;
};

export default function EvalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t, locale } = useLocale();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [dsResp, runsResp] = await Promise.all([
      api(`/v1/kb/${kbId}/eval/datasets`),
      api(`/v1/kb/${kbId}/eval/runs`),
    ]);
    if (dsResp.ok) setDatasets((await dsResp.json()) as Dataset[]);
    if (runsResp.ok) setRuns((await runsResp.json()) as EvalRun[]);
    setLoading(false);
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDataset() {
    const name = window.prompt(t("eval.promptName"));
    if (!name?.trim()) return;
    const resp = await api(`/v1/kb/${kbId}/eval/datasets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (resp.ok) await load();
    else alert(apiErrorMessage(await resp.json()));
  }

  async function runEval(dsId: string) {
    if (!window.confirm(t("confirm.eval"))) return;
    const resp = await api(`/v1/kb/${kbId}/eval/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: dsId, mode: "vector", top_k: 10 }),
    });
    if (resp.ok) {
      alert(t("msg.evalDone"));
      await load();
    } else {
      alert(apiErrorMessage(await resp.json()));
    }
  }

  async function deleteDataset(dsId: string) {
    if (!window.confirm(t("confirm.delete"))) return;
    await api(`/v1/kb/${kbId}/eval/datasets/${dsId}`, { method: "DELETE" });
    await load();
  }

  return (
    <PageShell>
      <PageHeader
        title={t("eval.title")}
        actions={
          <Button type="button" onClick={() => void createDataset()}>
            {t("eval.dataset")}
          </Button>
        }
      />

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : datasets.length === 0 ? (
        <EmptyState message={t("eval.empty")} />
      ) : (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>{t("eval.datasets")}</h2>
          {datasets.map((ds) => (
            <Card key={ds.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{ds.name}</span>
                <Badge variant="info">
                  {ds.size ?? 0} {t("eval.items")}
                </Badge>
              </div>
              {ds.created_at ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--mini-color-muted)" }}>
                  {new Date(ds.created_at).toLocaleString(locale)}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button variant="secondary" type="button" onClick={() => void runEval(ds.id)}>
                  {t("eval.run")}
                </Button>
                <Button variant="danger" type="button" onClick={() => void deleteDataset(ds.id)}>
                  {t("eval.delete")}
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {runs.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "24px 0 12px" }}>{t("eval.runs")}</h2>
          {runs.map((run) => {
            const metrics = run.metrics ?? {};
            return (
              <Card key={run.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>Run {run.id.slice(0, 8)}</span>
                  <Badge variant={run.status === "completed" ? "success" : "warning"}>{run.status}</Badge>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--mini-color-muted)" }}>
                  Mode: {run.params?.mode ?? "?"} · Top-K: {run.params?.top_k ?? "?"}
                  {run.created_at ? ` · ${new Date(run.created_at).toLocaleString(locale)}` : ""}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {metrics["recall@5"] !== undefined ? (
                    <Badge variant="info">R@5: {(metrics["recall@5"] * 100).toFixed(1)}%</Badge>
                  ) : null}
                  {metrics.mrr !== undefined ? <Badge variant="info">MRR: {metrics.mrr.toFixed(3)}</Badge> : null}
                  {metrics["ndcg@5"] !== undefined ? (
                    <Badge variant="info">nDCG@5: {metrics["ndcg@5"].toFixed(3)}</Badge>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </>
      ) : null}
    </PageShell>
  );
}
