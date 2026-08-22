"use client";

import * as React from "react";
import { FileIcon, ImageIcon, Loader2, XIcon } from "lucide-react";

import { Button } from "@minikb/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";
import { Progress } from "@minikb/ui/components/ui/progress";
import { cn } from "@minikb/ui/lib/utils";
import {
  attachmentCardType,
  attachmentExtensionLabel,
  attachmentPreviewUrl,
} from "@minikb/chat/lib/attachment-meta";
import { formatBytes } from "@minikb/chat/lib/format-bytes";
import type { ChatAttachment, ChatAttachmentCardType } from "@minikb/chat/types/attachment";

export interface AttachmentCardProps {
  item: ChatAttachment;
  cardType?: ChatAttachmentCardType;
  removable?: boolean;
  disabled?: boolean;
  imageViewer?: boolean;
  compact?: boolean;
  className?: string;
  onRemove?: (item: ChatAttachment) => void;
  labels?: {
    remove?: string;
    openImage?: string;
    unavailable?: string;
  };
}

function AttachmentCard({
  item,
  cardType,
  removable = true,
  disabled = false,
  imageViewer = true,
  compact = false,
  className,
  onRemove,
  labels,
}: AttachmentCardProps) {
  const resolvedType = cardType ?? attachmentCardType(item);
  const previewUrl = attachmentPreviewUrl(item);
  const isUploading = item.status === "uploading" || item.status === "pending";
  const isError = item.status === "error";
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);

  const removeLabel = labels?.remove ?? "Remove attachment";
  const openImageLabel = labels?.openImage ?? `Open ${item.name}`;

  const removeButton = removable ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={removeLabel}
      className={cn(
        "absolute top-1 right-1 size-7 rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground",
        compact && "size-6",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove?.(item);
      }}
    >
      <XIcon className="size-3.5" />
    </Button>
  ) : null;

  if (resolvedType === "image" && previewUrl && !imageFailed) {
    const imageBody = (
      <img
        src={previewUrl}
        alt={item.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setImageFailed(true)}
        className={cn(
          "block h-full w-full object-cover",
          imageViewer && !disabled && "cursor-zoom-in",
        )}
      />
    );

    return (
      <>
        <div
          data-slot="attachment-card"
          data-card-type="image"
          className={cn(
            "relative overflow-hidden rounded-[var(--radius)] border border-border/70 bg-background",
            compact
              ? "h-[var(--mini-chat-attachment-height)] w-[var(--mini-chat-attachment-width)]"
              : "h-28 w-36",
            isError && "border-destructive/50",
            className,
          )}
        >
          {imageViewer && !disabled ? (
            <button
              type="button"
              className="block h-full w-full"
              aria-label={openImageLabel}
              onClick={() => setPreviewOpen(true)}
            >
              {imageBody}
            </button>
          ) : (
            imageBody
          )}
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {removeButton}
        </div>
        {imageViewer ? (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none sm:max-w-4xl">
              <DialogTitle className="sr-only">{item.name}</DialogTitle>
              <img
                src={previewUrl}
                alt={item.name}
                className="max-h-[80vh] w-full rounded-[var(--radius-lg)] object-contain"
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </>
    );
  }

  const FileKindIcon = resolvedType === "image" ? ImageIcon : FileIcon;

  return (
    <div
      data-slot="attachment-card"
      data-card-type="file"
      className={cn(
        "relative flex min-w-0 items-center gap-2.5 rounded-[var(--radius)] border border-border/70 bg-muted/35 px-3 py-2",
        compact ? "max-w-[14rem]" : "max-w-[18rem]",
        isError && "border-destructive/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-[10px] font-semibold tracking-wide text-muted-foreground">
        {resolvedType === "file" ? (
          <span>{attachmentExtensionLabel(item).slice(0, 4)}</span>
        ) : (
          <FileKindIcon className="size-4" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{item.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {isError
            ? (item.errorMessage ?? labels?.unavailable ?? "Upload failed")
            : item.size != null
              ? formatBytes(item.size)
              : item.description}
        </span>
        {isUploading && item.progress != null ? (
          <Progress value={item.progress} className="mt-2 h-1" />
        ) : null}
      </span>
      {removeButton}
    </div>
  );
}

export { AttachmentCard };
