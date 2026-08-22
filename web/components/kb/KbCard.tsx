"use client";

import Link from "next/link";
import { useState } from "react";
import { Database, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useLocale } from "@/app/providers";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Button } from "@minikb/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@minikb/ui/components/ui/dropdown-menu";
import { cn } from "@minikb/ui/lib/utils";
import { formatKbDate, type KbSummary } from "@/lib/kb";
import { kbPath } from "@/lib/paths";

type Props = {
  kb: KbSummary;
  onEdit: (kb: KbSummary) => void;
  onDelete: (kb: KbSummary) => void;
  onInfo: (kb: KbSummary) => void;
};

export function KbCard({ kb, onEdit, onDelete, onInfo }: Props) {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card transition-shadow hover:shadow-sm",
        menuOpen && "shadow-sm",
      )}
    >
      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                aria-label={t("kb.cardMenu")}
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onClick={() => onEdit(kb)}>
              <Pencil className="size-4" />
              {t("kb.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(kb)}>
              <Trash2 className="size-4" />
              {t("kb.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link
        href={kbPath(kb.id)}
        className="flex flex-1 flex-col px-4 pt-4 pb-3"
        onClick={(e) => {
          if (menuOpen) e.preventDefault();
        }}
      >
        <div className="flex items-start gap-2.5 pr-6">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
            <Database className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-foreground">{kb.name}</h3>
              {kb.kind ? (
                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                  {kb.kind}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {kb.created_at ? formatKbDate(kb.created_at, locale) : kb.slug}
            </p>
          </div>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-3 gap-2 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tabular-nums text-foreground">
              {kb.stats?.documents ?? 0}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{t("kb.docs")}</div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tabular-nums text-foreground">
              {kb.stats?.chunks ?? 0}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{t("kb.chunks")}</div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{kb.kind ?? "general"}</div>
            <div className="truncate text-[10px] text-muted-foreground">{t("kb.kindLabel")}</div>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/25 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {kb.description?.trim() || t("kb.noDescription")}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-[11px]"
          onClick={() => onInfo(kb)}
        >
          {t("kb.openInfo")}
        </Button>
      </div>
    </div>
  );
}
