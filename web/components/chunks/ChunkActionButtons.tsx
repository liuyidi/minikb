"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { cn } from "@minikb/ui/lib/utils";

type ChunkActionButtonsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  viewLabel: string;
  editLabel: string;
  deleteLabel: string;
  /** Floating toolbar on grid cards */
  compact?: boolean;
  className?: string;
};

export function ChunkActionButtons({
  onView,
  onEdit,
  onDelete,
  viewLabel,
  editLabel,
  deleteLabel,
  compact = false,
  className,
}: ChunkActionButtonsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        compact &&
          "rounded-[var(--radius)] border border-border bg-background/95 p-0.5 shadow-sm",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={viewLabel}
        title={viewLabel}
        onClick={(event) => {
          event.stopPropagation();
          onView();
        }}
      >
        <Eye className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={editLabel}
        title={editLabel}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
