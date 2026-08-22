"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, FileText, Folder } from "lucide-react";
import { useLocale } from "@/app/providers";
import { SearchToolbar, type SearchField } from "@/components/content/SearchToolbar";
import { ViewModeToggle, type ViewMode } from "@/components/content/ViewModeToggle";
import { Button } from "@minikb/ui/components/ui/button";
import { Modal } from "@minikb/ui/components/ui/modal";
import { PageHeader, PageShell, statusBadgeVariant } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@minikb/ui/components/ui/table";
import { api } from "@/lib/api";
import {
  filterDocuments,
  getDocumentPath,
  getFileName,
  listDirectoryEntries,
} from "@/lib/document-tree";
import { fetchAllDocuments } from "@/lib/documents";
import { formatBytes } from "@/lib/format";
import { kbPath } from "@/lib/paths";

type DocItem = {
  id: string;
  title: string;
  mime?: string;
  size_bytes?: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  error?: string;
  meta?: Record<string, unknown>;
};

const PROCESSING_STATUSES = new Set(["pending", "parsing", "chunking", "embedding"]);

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy ID"
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
      onClick={() => {
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

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t, locale } = useLocale();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadItems, setUploadItems] = useState<{ name: string; status: "uploading" | "ok" | "fail" }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchField, setSearchField] = useState<SearchField>("name");
  const [search, setSearch] = useState("");
  const [currentDir, setCurrentDir] = useState<string[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadDocuments = useCallback(async () => {
    const kbResp = await api(`/v1/kb/${kbId}`);
    if (kbResp.status === 404) {
      notFound();
      return;
    }

    const items = await fetchAllDocuments(kbId);
    setDocs(items);
    setLoading(false);

    const processing = items.some((doc) => PROCESSING_STATUSES.has(doc.status));
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (processing) {
      refreshTimer.current = setTimeout(() => void loadDocuments(), 3000);
    }
  }, [kbId]);

  useEffect(() => {
    void loadDocuments();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadDocuments]);

  const filteredDocs = useMemo(
    () => filterDocuments(docs, searchField, search),
    [docs, searchField, search],
  );

  const directoryEntries = useMemo(
    () => listDirectoryEntries(filteredDocs, currentDir),
    [filteredDocs, currentDir],
  );

  async function deleteDoc(docId: string) {
    if (!kbId || !confirm(t("confirm.deleteDoc"))) return;
    await api(`/v1/kb/${kbId}/documents/${docId}`, { method: "DELETE" });
    void loadDocuments();
  }

  async function handleFiles(files: FileList | File[]) {
    if (!kbId) return;
    const list = Array.from(files);
    for (const file of list) {
      setUploadItems((prev) => [...prev, { name: file.name, status: "uploading" }]);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const resp = await api(`/v1/kb/${kbId}/documents`, { method: "POST", body: formData });
        setUploadItems((prev) =>
          prev.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: resp.ok ? "ok" : "fail" }
              : item,
          ),
        );
      } catch {
        setUploadItems((prev) =>
          prev.map((item) =>
            item.name === file.name && item.status === "uploading" ? { ...item, status: "fail" } : item,
          ),
        );
      }
    }
    void loadDocuments();
  }

  const total = docs.length;
  const ready = docs.filter((d) => d.status === "ready").length;
  const failed = docs.filter((d) => d.status === "failed").length;
  const processing = total - ready - failed;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;

  function renderDocNameCell(doc: DocItem) {
    const path = getDocumentPath(doc);
    const name = getFileName(path);
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{name}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate font-mono">{doc.id}</span>
          <CopyIdButton id={doc.id} />
        </div>
      </div>
    );
  }

  function renderDocActions(doc: DocItem) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`${kbPath(kbId, "chunks")}?document_id=${doc.id}`}
          className="text-xs font-medium text-[#3538cd] hover:underline"
        >
          {t("doc.viewChunks")}
        </Link>
        <Button
          variant="danger"
          type="button"
          onClick={() => void deleteDoc(doc.id)}
          style={{ fontSize: 12, height: 32, padding: "0 10px" }}
        >
          {t("doc.delete")}
        </Button>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("doc.title")}
        actions={
          <Button type="button" onClick={() => { setUploadItems([]); setUploadOpen(true); }}>
            {t("doc.upload")}
          </Button>
        }
      />

      {processing > 0 ? (
        <Card className="border border-border bg-card" style={{ padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span>
              Processing: <strong>{processing}</strong> / {total} docs
            </span>
            <span style={{ color: "#3538cd" }}>{pct}% done</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "var(--mini-color-surface)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--mini-color-ink)" }} />
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("doc.total", { n: filteredDocs.length })}</span>
        <div className="flex flex-wrap items-center gap-3">
          <SearchToolbar
            field={searchField}
            onFieldChange={(field) => {
              setSearchField(field);
              setCurrentDir([]);
            }}
            value={search}
            onValueChange={(value) => {
              setSearch(value);
              setCurrentDir([]);
            }}
            nameLabel={t("view.name")}
            idLabel={t("view.id")}
            placeholder={searchField === "id" ? t("doc.searchId") : t("doc.searchName")}
          />
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            listLabel={t("view.list")}
            directoryLabel={t("view.directory")}
          />
        </div>
      </div>

      {viewMode === "directory" ? (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button
            type="button"
            className="font-medium text-foreground hover:underline"
            onClick={() => setCurrentDir([])}
          >
            {t("doc.rootDir")}
          </button>
          {currentDir.map((segment, index) => (
            <span key={`${segment}-${index}`} className="inline-flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              <button
                type="button"
                className="font-medium text-foreground hover:underline"
                onClick={() => setCurrentDir(currentDir.slice(0, index + 1))}
              >
                {segment}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : filteredDocs.length === 0 ? (
        <EmptyState className="border border-border bg-card" message={t("doc.empty")} />
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-[var(--mini-radius-control)] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("doc.colName")}</TableHead>
                <TableHead>{t("doc.colStatus")}</TableHead>
                <TableHead>{t("doc.colSize")}</TableHead>
                <TableHead>{t("doc.colCreated")}</TableHead>
                <TableHead>{t("doc.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="max-w-[320px]">{renderDocNameCell(doc)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(doc.status)}>{doc.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.mime ?? "unknown"}
                    <br />
                    {formatBytes(doc.size_bytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.created_at ? new Date(doc.created_at).toLocaleString(locale) : "—"}
                  </TableCell>
                  <TableCell>{renderDocActions(doc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : directoryEntries.length === 0 ? (
        <EmptyState className="border border-border bg-card" message={t("doc.empty")} />
      ) : (
        <div className="overflow-hidden rounded-[var(--mini-radius-control)] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("doc.colName")}</TableHead>
                <TableHead>{t("doc.colStatus")}</TableHead>
                <TableHead>{t("doc.colSize")}</TableHead>
                <TableHead>{t("doc.colCreated")}</TableHead>
                <TableHead>{t("doc.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {directoryEntries.map((entry) =>
                entry.kind === "folder" ? (
                  <TableRow
                    key={`folder-${entry.name}`}
                    className="cursor-pointer"
                    onClick={() => setCurrentDir([...currentDir, entry.name])}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Folder className="size-4 text-[#3538cd]" />
                        {entry.name}
                      </div>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{t("doc.folder")}</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={entry.doc.id}>
                    <TableCell className="max-w-[320px]">{renderDocNameCell(entry.doc)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(entry.doc.status)}>{entry.doc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.doc.mime ?? "unknown"}
                      <br />
                      {formatBytes(entry.doc.size_bytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.doc.created_at
                        ? new Date(entry.doc.created_at).toLocaleString(locale)
                        : "—"}
                    </TableCell>
                    <TableCell>{renderDocActions(entry.doc)}</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        open={uploadOpen}
        title={t("modal.upload")}
        onClose={() => setUploadOpen(false)}
        closeLabel={t("btn.close")}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
          }}
          style={{
            border: `2px dashed ${dragOver ? "var(--mini-color-ink)" : "var(--mini-color-border-soft)"}`,
            borderRadius: "var(--mini-radius-control)",
            padding: 32,
            textAlign: "center",
            cursor: "pointer",
            color: "var(--mini-color-muted)",
            fontSize: 14,
          }}
        >
          {t("upload.hint")}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
        {uploadItems.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            {uploadItems.map((item) => (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 13,
                  borderBottom: "1px solid var(--mini-color-border-soft)",
                }}
              >
                <span>{item.name}</span>
                <Badge variant={item.status === "ok" ? "success" : item.status === "fail" ? "danger" : "info"}>
                  {item.status === "uploading"
                    ? t("upload.uploading")
                    : item.status === "ok"
                      ? t("upload.uploaded")
                      : t("upload.failed")}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </PageShell>
  );
}
