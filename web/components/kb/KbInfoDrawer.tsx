"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { useLocale } from "@/app/providers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";
import { Button } from "@minikb/ui/components/ui/button";
import { api } from "@/lib/api";
import { formatKbDate, kbEmbeddingLabel, type KbSummary } from "@/lib/kb";

type Props = {
  kbId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-foreground">{value}</span>
    </div>
  );
}

export function KbInfoDrawer({ kbId, open, onOpenChange }: Props) {
  const { locale, t } = useLocale();
  const [kb, setKb] = useState<KbSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!kbId) return;
    setLoading(true);
    try {
      const resp = await api(`/v1/kb/${kbId}`);
      if (resp.ok) {
        setKb((await resp.json()) as KbSummary);
      }
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    if (open && kbId) void load();
  }, [open, kbId, load]);

  async function copyId() {
    if (!kb?.id) return;
    try {
      await navigator.clipboard.writeText(kb.id);
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        closeLabel={t("btn.close")}
        className="fixed top-0 right-0 left-auto flex h-full max-h-screen w-full max-w-[420px] translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none rounded-l-[var(--radius-lg)] border-0 shadow-[-12px_0_48px_rgba(8,8,8,0.12)] sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{t("kb.info.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading && !kb ? (
            <p className="text-sm text-muted-foreground">...</p>
          ) : kb ? (
            <>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{t("kb.info.basic")}</h3>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 px-3">
                <InfoRow label={t("field.name")} value={kb.name} />
                <InfoRow label={t("field.desc")} value={kb.description?.trim() || "—"} />
                <InfoRow label={t("kb.field.dataType")} value={kb.kind ?? "general"} />
                <InfoRow
                  label={t("kb.field.updatedAt")}
                  value={formatKbDate(kb.updated_at, locale)}
                />
                <InfoRow
                  label={t("kb.field.createdAt")}
                  value={formatKbDate(kb.created_at, locale)}
                />
                <InfoRow
                  label={t("kb.field.resourceId")}
                  value={
                    <span className="inline-flex items-center gap-2">
                      <code className="text-xs">{kb.id}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        aria-label={t("kb.copyId")}
                        onClick={() => void copyId()}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </span>
                  }
                />
              </div>

              <h3 className="mb-1 mt-6 text-sm font-semibold text-foreground">{t("kb.info.config")}</h3>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 px-3">
                <InfoRow
                  label={t("kb.field.embeddingModel")}
                  value={kbEmbeddingLabel(kb.meta)}
                />
                <InfoRow label={t("kb.field.visibility")} value={kb.visibility ?? "private"} />
                <InfoRow
                  label={t("kb.field.chunker")}
                  value={String(kb.meta?.chunker_strategy ?? "recursive")}
                />
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
