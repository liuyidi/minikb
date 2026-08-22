"use client";

import { Label } from "@minikb/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { Switch } from "@minikb/ui/components/ui/switch";
import { inputClassName as inputStyle } from "@minikb/ui/lib/field-styles";
import { RERANK_PROVIDER_FALLBACK, RETRIEVAL_MODE_ITEMS } from "@/lib/form-options";
import { keywordWeight, type RetrievalPreset } from "@/lib/qa-config";

type RerankItem = { value: string; label: string };

type Props = {
  preset: RetrievalPreset;
  onChange: (next: RetrievalPreset) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  rerankProviders: RerankItem[];
  /** Retrieval test page allows higher top_k than QA sidebar */
  topKMax?: number;
  showPlanned?: boolean;
};

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-medium text-foreground tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  );
}

export function RetrievalSettingsPanel({
  preset,
  onChange,
  t,
  rerankProviders,
  topKMax = 100,
  showPlanned = false,
}: Props) {
  const kw = keywordWeight(preset);
  const rerankItems = rerankProviders.length > 0 ? rerankProviders : [...RERANK_PROVIDER_FALLBACK];

  return (
    <div className="space-y-5">
      <RangeRow
        label={t("ret.scoreThreshold")}
        value={preset.score_threshold}
        min={0}
        max={1}
        step={0.05}
        display={preset.score_threshold.toFixed(2)}
        onChange={(score_threshold) => onChange({ ...preset, score_threshold })}
      />

      {preset.mode === "hybrid" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-muted-foreground">{t("ret.vectorWeight")}</Label>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {t("ret.vectorLabel")} {preset.vector_weight.toFixed(2)}
            </span>
            <span>
              {t("ret.fulltextLabel")} {kw.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={preset.vector_weight}
            onChange={(e) =>
              onChange({ ...preset, vector_weight: parseFloat(e.target.value) })
            }
            className="w-full accent-foreground"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("ret.mode")}</Label>
        <Select
          items={[...RETRIEVAL_MODE_ITEMS]}
          value={preset.mode}
          onValueChange={(value) => onChange({ ...preset, mode: String(value) })}
        >
          <SelectTrigger className="w-full bg-background">
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
      </div>

      <RangeRow
        label={t("ret.topK")}
        value={preset.top_k}
        min={1}
        max={topKMax}
        step={1}
        display={String(preset.top_k)}
        onChange={(top_k) => onChange({ ...preset, top_k: Math.round(top_k) || 1 })}
      />

      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">{t("ret.rerank")}</Label>
        <Switch
          checked={preset.rerank.enabled}
          onCheckedChange={(checked) =>
            onChange({
              ...preset,
              rerank: { ...preset.rerank, enabled: checked === true },
            })
          }
        />
      </div>

      {preset.rerank.enabled ? (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t("qa.rerankProvider")}</Label>
            <Select
              items={rerankItems}
              value={preset.rerank.provider}
              onValueChange={(value) =>
                onChange({
                  ...preset,
                  rerank: { ...preset.rerank, provider: String(value) },
                })
              }
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rerankItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <Label className="text-muted-foreground">{t("ret.topn")}</Label>
            <input
              type="number"
              min={1}
              max={50}
              value={preset.rerank.top_n}
              onChange={(e) =>
                onChange({
                  ...preset,
                  rerank: { ...preset.rerank, top_n: parseInt(e.target.value, 10) || 5 },
                })
              }
              className={inputStyle}
              style={{ width: 72 }}
            />
          </div>
        </>
      ) : null}

      {showPlanned ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("ret.planned")}
          </p>
          <div className="flex items-center justify-between gap-3 opacity-50">
            <Label className="text-xs text-muted-foreground">{t("ret.knowledgeGraph")}</Label>
            <Switch checked={false} disabled />
          </div>
          <div className="flex items-center justify-between gap-3 opacity-50">
            <Label className="text-xs text-muted-foreground">{t("ret.crossLanguage")}</Label>
            <span className="text-[11px] text-muted-foreground">{t("ret.crossLanguageAuto")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
