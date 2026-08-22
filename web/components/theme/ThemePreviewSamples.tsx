"use client";

import { Database, FileText, Layers, SlidersHorizontal } from "lucide-react";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Button } from "@minikb/ui/components/ui/button";
import { cn } from "@minikb/ui/lib/utils";
import type { ThemePreset } from "@/lib/theme-presets";

type Props = {
  preset: ThemePreset;
  className?: string;
};

/** Mini UI samples scoped to a single theme preset (for side-by-side preview). */
export function ThemePreviewSamples({ preset, className }: Props) {
  return (
    <div
      data-theme-preset={preset}
      className={cn(
        "flex min-h-[420px] flex-col gap-3 rounded-[var(--radius-lg)] border border-border p-4",
        className,
      )}
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      {/* KB card */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="flex items-start gap-2.5 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Database className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">产品知识库</div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              内部文档、FAQ 与 API 说明的检索问答
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/60 bg-muted/25 px-3 py-2">
          <Badge variant="success">ready</Badge>
          <span className="text-xs text-muted-foreground">128 文档 · 2.4k 块</span>
        </div>
      </div>

      {/* Settings module with tabs */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            知识库配置
          </div>
        </div>
        <div className="flex gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
          {["基本信息", "问答", "索引"].map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                i === 0
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="space-y-2 p-3">
          <div className="h-2 w-16 rounded bg-muted" />
          <div className="h-8 rounded-md border border-input bg-background" />
          <div className="h-2 w-24 rounded bg-muted" />
          <div className="h-8 rounded-md border border-input bg-muted/40" />
        </div>
      </div>

      {/* Table / list module */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="size-3.5 text-muted-foreground" />
            文档列表
          </div>
          <Button type="button" size="sm" variant="secondary" className="h-7 text-xs">
            上传
          </Button>
        </div>
        {["onboarding.pdf", "api-reference.md"].map((name, i) => (
          <div
            key={name}
            className={cn(
              "flex items-center justify-between gap-2 px-3 py-2 text-xs",
              i > 0 && "border-t border-border/60",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
            </div>
            <Badge variant={i === 0 ? "success" : "warning"}>{i === 0 ? "ready" : "syncing"}</Badge>
          </div>
        ))}
      </div>

      {/* Sidebar nav strip */}
      <div className="mt-auto flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-xs font-medium shadow-sm">
          <Database className="size-3" />
          知识库
        </span>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
          <FileText className="size-3" />
          文档
        </span>
      </div>
    </div>
  );
}
