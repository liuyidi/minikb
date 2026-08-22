"use client";

import { FileText } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";
import { getDocumentPath, getFileName } from "@/lib/document-tree";

type DocOption = { id: string; title: string; meta?: Record<string, unknown> };

type ChunkViewModalProps = {
  open: boolean;
  chunk: {
    id: string;
    seq: number;
    text: string;
    document_id: string;
    created_at?: string;
    meta?: { title?: string };
  } | null;
  docs: DocOption[];
  locale: string;
  labels: {
    title: string;
    doc: string;
    chunkTitle: string;
    content: string;
    close: string;
    seq: string;
    chars: string;
    updatedAt: string;
  };
  onClose: () => void;
};

export function ChunkViewModal({
  open,
  chunk,
  docs,
  locale,
  labels,
  onClose,
}: ChunkViewModalProps) {
  if (!chunk) return null;

  const doc = docs.find((item) => item.id === chunk.document_id);
  const docName = doc ? getFileName(getDocumentPath(doc)) : chunk.document_id;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[720px] gap-0 p-0">
        <DialogHeader className="space-y-3 border-b border-border/40 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{labels.title}</DialogTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {labels.seq} #{chunk.seq + 1}
            </span>
            <span className="max-w-[260px] truncate rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              ID {chunk.id}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {labels.chars} {chunk.text.length}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">{labels.doc}</div>
            <div className="inline-flex items-center gap-1.5 text-sm font-medium">
              <FileText className="size-3.5 text-muted-foreground" />
              {docName}
            </div>
          </div>

          {chunk.meta?.title ? (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{labels.chunkTitle}</div>
              <div className="text-sm">{chunk.meta.title}</div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-xs text-muted-foreground">{labels.content}</div>
            <div className="max-h-[420px] overflow-auto rounded-[var(--mini-radius-control)] bg-muted/25 p-3 text-sm whitespace-pre-wrap">
              {chunk.text}
            </div>
          </div>

          {chunk.created_at ? (
            <div className="text-xs text-muted-foreground">
              {labels.updatedAt} {new Date(chunk.created_at).toLocaleString(locale)}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/40 px-6 py-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            {labels.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
