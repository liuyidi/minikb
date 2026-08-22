"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, FileText } from "lucide-react";
import { useLocale } from "@/app/providers";
import { ChunkActionButtons } from "@/components/chunks/ChunkActionButtons";
import { ChunkFormModal, type ChunkFormValues } from "@/components/chunks/ChunkFormModal";
import { ChunkViewModal } from "@/components/chunks/ChunkViewModal";
import { DeleteConfirmDialog } from "@/components/content/DeleteConfirmDialog";
import { SearchToolbar, type SearchField } from "@/components/content/SearchToolbar";
import { ViewModeToggle, type ViewMode } from "@/components/content/ViewModeToggle";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@minikb/ui/components/ui/table";
import { api, apiErrorFromResponse } from "@/lib/api";
import { contentCardClassName, contentSurfaceClassName } from "@/lib/content-styles";
import { fetchAllDocuments } from "@/lib/documents";
import { getDocumentPath, getFileName } from "@/lib/document-tree";

type ChunkItem = {
  id: string;
  seq: number;
  text: string;
  tokens?: number;
  document_id: string;
  created_at?: string;
  meta?: {
    title?: string;
    heading_path?: string | string[];
    enriched_heading_path?: string | string[];
    language?: string;
  };
};

type DocOption = { id: string; title: string; meta?: Record<string, unknown> };

type ChunkStats = {
  total_chunks: number;
  total_tokens?: number;
  avg_chunk_chars?: number;
};

const PAGE_SIZE = 20;
const ALL_DOCS_VALUE = "__all__";

function headingPath(meta?: ChunkItem["meta"]): string | null {
  const path = meta?.heading_path ?? meta?.enriched_heading_path;
  if (!path) return null;
  return Array.isArray(path) ? path.join(" > ") : path;
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy ID"
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(id).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      <Copy className="size-3" />
      {copied ? <span className="ml-1 text-[10px]">OK</span> : null}
    </button>
  );
}

export default function ChunksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [docId, setDocId] = useState(ALL_DOCS_VALUE);
  const [searchField, setSearchField] = useState<SearchField>("name");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [activeChunk, setActiveChunk] = useState<ChunkItem | null>(null);
  const [viewChunk, setViewChunk] = useState<ChunkItem | null>(null);
  const [deleteChunk, setDeleteChunk] = useState<ChunkItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const documentId = searchParams.get("document_id");
    if (documentId) setDocId(documentId);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDocs = useCallback(async () => {
    const items = await fetchAllDocuments(kbId);
    setDocs(items);
  }, [kbId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const loadChunks = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (docId && docId !== ALL_DOCS_VALUE) params.set("document_id", docId);
    if (debouncedSearch) params.set("search", debouncedSearch);

    const [chunkResp, statsResp] = await Promise.all([
      api(`/v1/kb/${kbId}/chunks?${params}`),
      api(`/v1/kb/${kbId}/chunks/stats`),
    ]);

    if (chunkResp.ok) {
      const data = (await chunkResp.json()) as { items: ChunkItem[]; total: number };
      setChunks(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    if (statsResp.ok) {
      setStats((await statsResp.json()) as ChunkStats);
    }
    setLoading(false);
  }, [kbId, page, docId, debouncedSearch]);

  useEffect(() => {
    void loadChunks();
  }, [loadChunks]);

  useEffect(() => {
    const chunkId = searchParams.get("chunk");
    if (!chunkId) return;
    void (async () => {
      const resp = await api(`/v1/kb/${kbId}/chunks/${chunkId}`);
      if (!resp.ok) return;
      const chunk = (await resp.json()) as ChunkItem;
      setChunks((prev) => {
        if (prev.some((item) => item.id === chunk.id)) return prev;
        return [chunk, ...prev];
      });
      setViewChunk(chunk);
    })();
  }, [kbId, searchParams]);

  const docMap = useMemo(() => new Map(docs.map((doc) => [doc.id, doc])), [docs]);

  const docItems = useMemo(
    () => [
      { value: ALL_DOCS_VALUE, label: t("chunk.allDocs") },
      ...docs.map((doc) => ({ value: doc.id, label: getFileName(getDocumentPath(doc)) })),
    ],
    [docs, t],
  );

  const displayTotal = total;
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));

  const highlight = useMemo(() => {
    if (!debouncedSearch || searchField === "id") return null;
    try {
      return new RegExp(`(${debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    } catch {
      return null;
    }
  }, [debouncedSearch, searchField]);

  const formLabels = useMemo(
    () => ({
      createTitle: t("chunk.createTitle"),
      editTitle: t("chunk.editTitle"),
      doc: t("chunk.doc"),
      docPlaceholder: t("chunk.docPlaceholder"),
      title: t("chunk.chunkTitle"),
      titlePlaceholder: t("chunk.titlePlaceholder"),
      content: t("chunk.content"),
      contentPlaceholder: t("chunk.contentPlaceholder"),
      cancel: t("btn.cancel"),
      create: t("chunk.create"),
      save: t("chunk.save"),
      reembedHint: t("chunk.reembedHint"),
      seq: t("chunk.colSeq"),
      chars: t("chunk.chars"),
      requiredDoc: t("chunk.requiredDoc"),
      requiredContent: t("chunk.requiredContent"),
      tooLong: t("chunk.tooLong"),
    }),
    [t],
  );

  function renderText(text: string) {
    if (!highlight) return text;
    const parts = text.split(highlight);
    return parts.map((part, index) =>
      highlight.test(part) ? (
        <mark key={index} style={{ background: "#fff3cd", padding: "1px 2px" }}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }

  function docLabel(documentId: string) {
    const doc = docMap.get(documentId);
    if (!doc) return documentId;
    return getFileName(getDocumentPath(doc));
  }

  function openCreate() {
    setFormMode("create");
    setActiveChunk(null);
    setFormOpen(true);
  }

  function openEdit(chunk: ChunkItem) {
    setFormMode("edit");
    setActiveChunk(chunk);
    setFormOpen(true);
  }

  async function confirmDeleteChunk() {
    if (!deleteChunk) return;
    setDeleting(true);
    try {
      const resp = await api(`/v1/kb/${kbId}/chunks/${deleteChunk.id}`, { method: "DELETE" });
      if (!resp.ok) {
        alert(await apiErrorFromResponse(resp));
        return;
      }
      setDeleteChunk(null);
      void loadChunks();
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(values: ChunkFormValues) {
    setSaving(true);
    try {
      const payload = {
        document_id: values.documentId,
        text: values.text,
        title: values.title.trim() || null,
      };

      const resp =
        formMode === "create"
          ? await api(`/v1/kb/${kbId}/chunks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await api(`/v1/kb/${kbId}/chunks/${activeChunk?.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!resp.ok) {
        alert(await apiErrorFromResponse(resp));
        return;
      }

      setFormOpen(false);
      setActiveChunk(null);
      void loadChunks();
    } finally {
      setSaving(false);
    }
  }

  function renderChunkCard(chunk: ChunkItem) {
    const path = headingPath(chunk.meta);
    const doc = docMap.get(chunk.document_id);

    return (
      <Card key={chunk.id} className={`${contentCardClassName} group relative mb-0 flex h-full flex-col`}>
        <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <ChunkActionButtons
            compact
            viewLabel={t("chunk.view")}
            editLabel={t("chunk.edit")}
            deleteLabel={t("chunk.delete")}
            onView={() => setViewChunk(chunk)}
            onEdit={() => openEdit(chunk)}
            onDelete={() => setDeleteChunk(chunk)}
          />
        </div>

        <div className="flex flex-1 cursor-pointer flex-col pr-16" onClick={() => setViewChunk(chunk)}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">#{chunk.seq + 1}</div>
              {chunk.meta?.title ? (
                <div className="mt-1 truncate text-sm font-medium">{chunk.meta.title}</div>
              ) : null}
              <div className="mt-1 flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
                <span className="truncate">ID {chunk.id}</span>
                <CopyIdButton id={chunk.id} />
              </div>
            </div>
            <Badge>{chunk.tokens ?? "?"} tok</Badge>
          </div>
          {path ? <div className="mb-2 text-xs text-[#3538cd]">{path}</div> : null}
          <div
            className="flex-1 text-[13px] text-[var(--mini-color-ink-soft)]"
            style={{ maxHeight: 120, overflow: "hidden", whiteSpace: "pre-wrap" }}
          >
            {renderText(chunk.text)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            {doc ? docLabel(chunk.document_id) : chunk.document_id}
          </span>
          <span>
            {t("chunk.chars")} {chunk.text.length}
          </span>
          {chunk.created_at ? (
            <span>
              {t("chunk.updatedAt")} {new Date(chunk.created_at).toLocaleString(locale)}
            </span>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t("chunk.title")} />

      {stats ? (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: t("stat.chunks"), value: stats.total_chunks },
            { label: t("chunk.tokens"), value: (stats.total_tokens ?? 0).toLocaleString() },
            { label: t("chunk.avgChars"), value: stats.avg_chunk_chars ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${contentSurfaceClassName} flex-1 p-3 text-center`}
              style={{ flex: "1 1 120px" }}
            >
              <div style={{ fontSize: 20, fontWeight: 600 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "var(--mini-color-muted)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={openCreate}>
            {t("chunk.add")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("chunk.total", { n: displayTotal })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={docItems}
            value={docId || ALL_DOCS_VALUE}
            onValueChange={(value) => {
              setDocId(String(value));
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64 min-w-[220px]">
              {docItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span className="truncate">{item.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchToolbar
            field={searchField}
            onFieldChange={setSearchField}
            value={search}
            onValueChange={setSearch}
            nameLabel={t("view.name")}
            idLabel={t("view.id")}
            placeholder={searchField === "id" ? t("chunk.searchId") : t("chunk.searchContent")}
          />
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            listLabel={t("view.list")}
            directoryLabel={t("view.directory")}
            directoryIcon="grid"
          />
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : chunks.length === 0 ? (
        <EmptyState className={contentSurfaceClassName} message={t("chunk.empty")} />
      ) : viewMode === "list" ? (
        <div className={contentSurfaceClassName}>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 shrink-0 whitespace-nowrap">{t("chunk.colSeq")}</TableHead>
                <TableHead>{t("chunk.colId")}</TableHead>
                <TableHead>{t("chunk.colDoc")}</TableHead>
                <TableHead className="min-w-[280px]">{t("chunk.colContent")}</TableHead>
                <TableHead className="w-44 shrink-0 whitespace-nowrap">{t("chunk.colUpdated")}</TableHead>
                <TableHead className="w-32 shrink-0 whitespace-nowrap">{t("chunk.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunks.map((chunk) => {
                const path = headingPath(chunk.meta);
                return (
                  <TableRow key={chunk.id}>
                    <TableCell className="w-16 shrink-0 whitespace-nowrap font-medium">
                      #{chunk.seq + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[200px] items-center gap-1 font-mono text-xs">
                        <span className="truncate">{chunk.id}</span>
                        <CopyIdButton id={chunk.id} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[140px]">
                        <div className="flex items-center gap-1.5 font-medium">
                          <FileText className="size-3.5 text-muted-foreground" />
                          {docLabel(chunk.document_id)}
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {chunk.document_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {chunk.meta?.title ? (
                        <div className="mb-1 text-sm font-medium">{chunk.meta.title}</div>
                      ) : null}
                      {path ? <div className="mb-1 text-xs text-[#3538cd]">{path}</div> : null}
                      <div
                        className="text-[13px] text-[var(--mini-color-ink-soft)]"
                        style={{ maxHeight: 72, overflow: "hidden", whiteSpace: "pre-wrap" }}
                      >
                        {renderText(chunk.text)}
                      </div>
                    </TableCell>
                    <TableCell className="w-44 shrink-0 whitespace-nowrap text-muted-foreground">
                      {chunk.created_at ? new Date(chunk.created_at).toLocaleString(locale) : "—"}
                    </TableCell>
                    <TableCell className="w-32 shrink-0 whitespace-nowrap align-middle">
                      <ChunkActionButtons
                        viewLabel={t("chunk.view")}
                        editLabel={t("chunk.edit")}
                        deleteLabel={t("chunk.delete")}
                        onView={() => setViewChunk(chunk)}
                        onEdit={() => openEdit(chunk)}
                        onDelete={() => setDeleteChunk(chunk)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {chunks.map((chunk) => renderChunkCard(chunk))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        {totalPages > 1 ? (
          <>
            <Button
              variant="secondary"
              type="button"
              disabled={page === 0}
              style={{ fontSize: 12, height: 36 }}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("chunk.prev")}
            </Button>
            <span style={{ fontSize: 13, color: "var(--mini-color-muted)" }}>
              {t("chunk.page", { page: page + 1, total: totalPages, n: displayTotal })}
            </span>
            <Button
              variant="secondary"
              type="button"
              disabled={page >= totalPages - 1}
              style={{ fontSize: 12, height: 36 }}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("chunk.next")}
            </Button>
          </>
        ) : (
          <span style={{ fontSize: 13, color: "var(--mini-color-muted)" }}>
            {t("chunk.count", { n: displayTotal })}
          </span>
        )}
      </div>

      <ChunkFormModal
        open={formOpen}
        mode={formMode}
        chunk={activeChunk}
        docs={docs}
        defaultDocumentId={docId === ALL_DOCS_VALUE ? "" : docId}
        saving={saving}
        labels={formLabels}
        onClose={() => {
          setFormOpen(false);
          setActiveChunk(null);
        }}
        onSubmit={handleSubmit}
      />

      <ChunkViewModal
        open={viewChunk !== null}
        chunk={viewChunk}
        docs={docs}
        locale={locale}
        labels={{
          title: t("chunk.viewTitle"),
          doc: t("chunk.doc"),
          chunkTitle: t("chunk.chunkTitle"),
          content: t("chunk.content"),
          close: t("btn.close"),
          seq: t("chunk.colSeq"),
          chars: t("chunk.chars"),
          updatedAt: t("chunk.updatedAt"),
        }}
        onClose={() => setViewChunk(null)}
      />

      <DeleteConfirmDialog
        open={deleteChunk !== null}
        onOpenChange={(open) => !open && setDeleteChunk(null)}
        title={t("chunk.delete")}
        description={t("chunk.deleteConfirm")}
        confirmLabel={t("chunk.delete")}
        cancelLabel={t("btn.cancel")}
        confirming={deleting}
        onConfirm={confirmDeleteChunk}
      />
    </PageShell>
  );
}
