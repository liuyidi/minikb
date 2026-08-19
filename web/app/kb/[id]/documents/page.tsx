"use client";

import { notFound } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { Modal } from "@minikb/ui/components/ui/modal";
import { PageHeader, PageShell, statusBadgeVariant } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";

type DocItem = {
  id: string;
  title: string;
  mime?: string;
  size_bytes?: number;
  status: string;
  created_at?: string;
  error?: string;
};

const PROCESSING_STATUSES = new Set(["pending", "parsing", "chunking", "embedding"]);

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t, locale } = useLocale();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadItems, setUploadItems] = useState<{ name: string; status: "uploading" | "ok" | "fail" }[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadDocuments = useCallback(async () => {
    const kbResp = await api(`/v1/kb/${kbId}`);
    if (kbResp.status === 404) {
      notFound();
      return;
    }
    const resp = await api(`/v1/kb/${kbId}/documents`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { items: DocItem[] };
    setDocs(data.items ?? []);
    setLoading(false);

    const processing = (data.items ?? []).some((doc) => PROCESSING_STATUSES.has(doc.status));
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
        <Card style={{ padding: "12px 16px" }}>
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

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : docs.length === 0 ? (
        <EmptyState message={t("doc.empty")} />
      ) : (
        docs.map((doc) => (
          <Card key={doc.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{doc.title}</span>
              <Badge variant={statusBadgeVariant(doc.status)}>{doc.status}</Badge>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--mini-color-muted)" }}>
              {doc.mime ?? "unknown"} · {formatBytes(doc.size_bytes)}
              {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleString(locale)}` : ""}
            </p>
            {doc.error ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--mini-color-danger)" }}>{doc.error}</p>
            ) : null}
            <Button variant="danger" type="button" onClick={() => void deleteDoc(doc.id)} style={{ fontSize: 12, height: 36, padding: "0 12px" }}>
              {t("doc.delete")}
            </Button>
          </Card>
        ))
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
