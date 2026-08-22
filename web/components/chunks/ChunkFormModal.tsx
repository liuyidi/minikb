"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";
import { FormGroup } from "@minikb/ui/components/ui/page";
import { Input } from "@minikb/ui/components/ui/input";
import { Textarea } from "@minikb/ui/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { getDocumentPath, getFileName } from "@/lib/document-tree";
import { fetchAllDocuments, type DocListItem } from "@/lib/documents";

export const CHUNK_MAX_CHARS = 8000;

export type ChunkFormValues = {
  documentId: string;
  title: string;
  text: string;
};

type DocOption = DocListItem;

type ChunkFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  chunk?: {
    id: string;
    seq: number;
    document_id: string;
    text: string;
    meta?: { title?: string };
  } | null;
  docs: DocOption[];
  defaultDocumentId?: string;
  saving?: boolean;
  labels: {
    createTitle: string;
    editTitle: string;
    doc: string;
    docPlaceholder: string;
    title: string;
    titlePlaceholder: string;
    content: string;
    contentPlaceholder: string;
    cancel: string;
    create: string;
    save: string;
    reembedHint: string;
    seq: string;
    chars: string;
    requiredDoc: string;
    requiredContent: string;
    tooLong: string;
  };
  onClose: () => void;
  onSubmit: (values: ChunkFormValues) => void | Promise<void>;
};

export function ChunkFormModal({
  open,
  mode,
  chunk,
  docs,
  defaultDocumentId,
  saving = false,
  labels,
  onClose,
  onSubmit,
}: ChunkFormModalProps) {
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const docItems = useMemo(
    () =>
      docs.map((doc) => ({
        value: doc.id,
        label: getFileName(getDocumentPath(doc)),
      })),
    [docs],
  );

  useEffect(() => {
    if (!open) return;
    const fallback =
      chunk?.document_id ||
      (defaultDocumentId && defaultDocumentId.length > 0 ? defaultDocumentId : "") ||
      docItems[0]?.value ||
      "";
    setDocumentId(fallback);
    setTitle(chunk?.meta?.title ?? "");
    setText(chunk?.text ?? "");
    setError(null);
  }, [open, chunk, defaultDocumentId, docItems]);

  useEffect(() => {
    if (!open || documentId || docItems.length === 0) return;
    setDocumentId(docItems[0]?.value ?? "");
  }, [open, documentId, docItems]);

  async function handleSubmit() {
    if (!documentId) {
      setError(labels.requiredDoc);
      return;
    }
    if (!text.trim()) {
      setError(labels.requiredContent);
      return;
    }
    if (text.length > CHUNK_MAX_CHARS) {
      setError(labels.tooLong);
      return;
    }
    setError(null);
    await onSubmit({ documentId, title, text });
  }

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
            <DialogTitle>{mode === "create" ? labels.createTitle : labels.editTitle}</DialogTitle>
            {mode === "edit" && chunk ? (
              <>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {labels.seq} #{chunk.seq + 1}
                </span>
                <span className="max-w-[260px] truncate rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  ID {chunk.id}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {labels.chars} {text.length}
                </span>
              </>
            ) : null}
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <FormGroup label={`${labels.doc} *`}>
            {docItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.docPlaceholder}</p>
            ) : (
              <Select
                items={docItems}
                value={documentId || docItems[0]?.value}
                onValueChange={(value) => setDocumentId(String(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.docPlaceholder} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {docItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormGroup>

          <FormGroup label={labels.title}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={labels.titlePlaceholder}
            />
          </FormGroup>

          <FormGroup label={`${labels.content} *`}>
            <div className="relative">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={labels.contentPlaceholder}
                className="min-h-[220px] resize-y pr-16"
              />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground">
                {text.length}/{CHUNK_MAX_CHARS}
              </span>
            </div>
          </FormGroup>

          {mode === "edit" ? (
            <div className="rounded-[var(--mini-radius-control)] bg-[#eef4ff] px-3 py-2 text-xs text-[#3538cd]">
              {labels.reembedHint}
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--mini-color-danger)]">{error}</p> : null}
        </div>

        <DialogFooter className="border-t border-border/40 px-6 py-4">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {mode === "create" ? labels.create : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
