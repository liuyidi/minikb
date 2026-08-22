"use client";

import Link from "next/link";
import { Check, Palette } from "lucide-react";
import { useLocale, useTheme } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { ThemePreviewSamples } from "@/components/theme/ThemePreviewSamples";
import { THEME_PRESETS, type ThemePreset } from "@/lib/theme-presets";
import { cn } from "@minikb/ui/lib/utils";
import { toast } from "@minikb/ui/components/ui/sonner";

export default function ThemePreviewPage() {
  const { locale, t } = useLocale();
  const { themePreset, setThemePreset } = useTheme();
  const isZh = locale === "zh-CN";

  function applyPreset(preset: ThemePreset) {
    setThemePreset(preset);
    const meta = THEME_PRESETS.find((p) => p.id === preset);
    toast.success(
      isZh ? `已应用「${meta?.nameZh}」主题` : `Applied "${meta?.nameEn}" theme`,
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("themePreview.title")}
        subtitle={t("themePreview.subtitle")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            {t("themePreview.backSettings")}
          </Button>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4">
        <Palette className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          <p className="m-0 text-foreground">{t("themePreview.hintTitle")}</p>
          <p className="mb-0 mt-1">{t("themePreview.hintBody")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {THEME_PRESETS.map((preset) => {
          const active = themePreset === preset.id;
          return (
            <section
              key={preset.id}
              className={cn(
                "rounded-[var(--radius-lg)] border-2 p-4 transition-colors",
                active ? "border-foreground/30 bg-muted/20" : "border-transparent bg-transparent",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
                    {isZh ? preset.nameZh : preset.nameEn}
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                        <Check className="size-3" />
                        {t("themePreview.current")}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    {isZh ? preset.descZh : preset.descEn}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "default"}
                  disabled={active}
                  onClick={() => applyPreset(preset.id)}
                >
                  {active ? t("themePreview.applied") : t("themePreview.apply")}
                </Button>
              </div>

              <ThemePreviewSamples preset={preset.id} />
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
