"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/providers";
import { CreateKbModal } from "@/components/CreateKbModal";
import { EditKbModal } from "@/components/kb/EditKbModal";
import { KbCard } from "@/components/kb/KbCard";
import { KbInfoDrawer } from "@/components/kb/KbInfoDrawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@minikb/ui/components/ui/alert-dialog";
import { Button } from "@minikb/ui/components/ui/button";
import { Input } from "@minikb/ui/components/ui/input";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { api } from "@/lib/api";
import type { KbSummary } from "@/lib/kb";

export default function KbsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<KbSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editKb, setEditKb] = useState<KbSummary | null>(null);
  const [infoKbId, setInfoKbId] = useState<string | null>(null);
  const [deleteKb, setDeleteKb] = useState<KbSummary | null>(null);

  const loadKbs = useCallback(async () => {
    const resp = await api("/v1/kb");
    if (!resp.ok) return;
    const data = (await resp.json()) as { items: KbSummary[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadKbs();
  }, [loadKbs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (kb) =>
        kb.name.toLowerCase().includes(q) ||
        kb.slug.toLowerCase().includes(q) ||
        (kb.description?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  async function confirmDelete() {
    if (!deleteKb) return;
    const resp = await api(`/v1/kb/${deleteKb.id}`, { method: "DELETE" });
    if (resp.ok) {
      setDeleteKb(null);
      await loadKbs();
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setCreateOpen(true)}>
            {t("kb.create")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("kb.total", { n: items.length })}
          </span>
        </div>
        <Input
          className="w-full max-w-xs"
          placeholder={t("kb.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card"
          message={items.length === 0 ? t("kb.empty") : t("kb.noMatch")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((kb) => (
            <KbCard
              key={kb.id}
              kb={kb}
              onEdit={(item) => setEditKb(item)}
              onDelete={(item) => setDeleteKb(item)}
              onInfo={(item) => setInfoKbId(item.id)}
            />
          ))}
        </div>
      )}

      <CreateKbModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditKbModal
        kb={editKb}
        open={editKb !== null}
        onClose={() => setEditKb(null)}
        onSaved={() => void loadKbs()}
      />
      <KbInfoDrawer
        kbId={infoKbId}
        open={infoKbId !== null}
        onOpenChange={(open) => {
          if (!open) setInfoKbId(null);
        }}
      />

      <AlertDialog open={deleteKb !== null} onOpenChange={(open) => !open && setDeleteKb(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("kb.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.deleteKbPerm")} {deleteKb?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={() => void confirmDelete()}>
              {t("kb.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
