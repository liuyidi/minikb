"use client";

import { use, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { inputClassName as inputStyle } from "@minikb/ui/lib/field-styles";
import { api, apiErrorMessage } from "@/lib/api";
import { RETRIEVAL_MODE_ITEMS } from "@/lib/form-options";

type Citation = {
  index: number;
  id?: string;
  doc_title?: string;
  text_snippet?: string;
};

type QaResult = {
  answer: string;
  model?: string;
  retrieval_hits?: number;
  elapsed_ms?: number;
  faithfulness_score?: number;
  citations?: Citation[];
};

export default function QaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const [mode, setMode] = useState("vector");
  const [topK, setTopK] = useState(6);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doQA() {
    if (!query.trim()) {
      alert(t("err.question"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await api(`/v1/kb/${kbId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode, top_k: topK, stream: false }),
      });
      if (!resp.ok) {
        setError(apiErrorMessage(await resp.json()));
        return;
      }
      setResult((await resp.json()) as QaResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("err.failed"));
    } finally {
      setLoading(false);
    }
  }

  function clearQA() {
    setQuery("");
    setResult(null);
    setError(null);
  }

  const faithScore = result?.faithfulness_score ?? 0;
  const faithVariant =
    faithScore >= 0.7 ? "success" : faithScore >= 0.4 ? "warning" : "danger";

  return (
    <PageShell>
      <PageHeader title={t("qa.title")} />

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select
            items={[...RETRIEVAL_MODE_ITEMS]}
            value={mode}
            onValueChange={(value) => setMode(String(value))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RETRIEVAL_MODE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            Top-K
            <input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10) || 6)}
              className={inputStyle}
              style={{ width: 72 }}
            />
          </label>
        </div>
        <textarea
          className={inputStyle}
          style={{ height: "auto", minHeight: 80, padding: "10px 12px", marginBottom: 16, width: "100%" }}
          placeholder={t("qa.query")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <Button type="button" onClick={() => void doQA()} disabled={loading}>
            {loading ? t("qa.thinking") : t("qa.ask")}
          </Button>
          <Button variant="secondary" type="button" onClick={clearQA}>
            {t("qa.clear")}
          </Button>
        </div>
      </Card>

      {error ? (
        <Card style={{ marginTop: 16, color: "var(--mini-color-danger)" }}>{error}</Card>
      ) : null}

      {loading ? (
        <Card style={{ marginTop: 16 }}>
          <p style={{ margin: 0, color: "var(--mini-color-muted)" }}>{t("qa.thinking")}</p>
        </Card>
      ) : null}

      {result ? (
        <Card style={{ marginTop: 16 }}>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {result.answer}
          </pre>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--mini-color-muted)" }}>
            Model: {result.model ?? "?"} · Retrieved: {result.retrieval_hits ?? 0} chunks · Time:{" "}
            {result.elapsed_ms?.toFixed(0) ?? "?"}ms ·{" "}
            <Badge variant={faithVariant}>Faithfulness: {(faithScore * 100).toFixed(0)}%</Badge>
          </div>
          {result.citations?.length ? (
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>{t("qa.citations")}</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13 }}>
                {result.citations.map((citation) => (
                  <li key={citation.index} style={{ marginBottom: 8 }}>
                    [{citation.index}] {citation.doc_title ?? "Untitled"}
                    {citation.id ? ` (${citation.id})` : ""}
                    {citation.text_snippet ? (
                      <div style={{ color: "var(--mini-color-muted)", marginTop: 4 }}>
                        {citation.text_snippet}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
    </PageShell>
  );
}
