"use client";

import * as React from "react";

import { cn } from "@minikb/ui/lib/utils";
import { AttachmentCard, type AttachmentCardProps } from "@minikb/chat/components/attachment-card";
import type { AttachmentsOverflow, ChatAttachment } from "@minikb/chat/types/attachment";

export interface AttachmentsProps
  extends Pick<
    AttachmentCardProps,
    "removable" | "disabled" | "imageViewer" | "compact" | "labels"
  > {
  items: ChatAttachment[];
  overflow?: AttachmentsOverflow;
  className?: string;
  onRemove?: (item: ChatAttachment) => void;
}

const overflowClassName: Record<AttachmentsOverflow, string> = {
  wrap: "flex flex-wrap gap-2",
  scrollX: "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]",
  scrollY: "flex max-h-40 flex-col gap-2 overflow-y-auto pr-1",
};

function Attachments({
  items,
  overflow = "wrap",
  removable = true,
  disabled = false,
  imageViewer = true,
  compact = false,
  className,
  labels,
  onRemove,
}: AttachmentsProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-slot="attachments"
      data-overflow={overflow}
      className={cn(overflowClassName[overflow], className)}
      role="list"
      aria-label="Attachments"
    >
      {items.map((item) => (
        <div key={item.id} role="listitem" className="shrink-0">
          <AttachmentCard
            item={item}
            removable={removable}
            disabled={disabled}
            imageViewer={imageViewer}
            compact={compact}
            labels={labels}
            onRemove={onRemove}
          />
        </div>
      ))}
    </div>
  );
}

export { Attachments };
