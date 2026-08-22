"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@minikb/ui/lib/utils";

type ChunkActionButtonsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  viewLabel: string;
  editLabel: string;
  deleteLabel: string;
  variant?: "inline" | "hover";
  className?: string;
};

export function ChunkActionButtons({
  onView,
  onEdit,
  onDelete,
  viewLabel,
  editLabel,
  deleteLabel,
  variant = "inline",
  className,
}: ChunkActionButtonsProps) {
  if (variant === "inline") {
    return (
      <div className={cn("flex flex-nowrap items-center gap-2 text-xs whitespace-nowrap", className)}>
        <button
          type="button"
          className="font-medium text-[#3538cd] hover:underline"
          onClick={onView}
        >
          {viewLabel}
        </button>
        <button
          type="button"
          className="font-medium text-[#3538cd] hover:underline"
          onClick={onEdit}
        >
          {editLabel}
        </button>
        <button
          type="button"
          className="font-medium text-[var(--mini-color-danger)] hover:underline"
          onClick={onDelete}
        >
          {deleteLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[var(--mini-radius-control)] border border-border bg-background/95 p-1 shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        aria-label={viewLabel}
        title={viewLabel}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onView();
        }}
      >
        <Eye className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={editLabel}
        title={editLabel}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={deleteLabel}
        title={deleteLabel}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-[var(--mini-color-danger)]"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
