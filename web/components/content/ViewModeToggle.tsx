"use client";

import { FolderTree, LayoutGrid, List } from "lucide-react";
import { cn } from "@minikb/ui/lib/utils";

export type ViewMode = "list" | "directory";

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  listLabel: string;
  directoryLabel: string;
  /** Chunks use a card grid for directory mode; documents use a folder tree. */
  directoryIcon?: "folder" | "grid";
  className?: string;
};

export function ViewModeToggle({
  value,
  onChange,
  listLabel,
  directoryLabel,
  directoryIcon = "folder",
  className,
}: ViewModeToggleProps) {
  const DirectoryIcon = directoryIcon === "grid" ? LayoutGrid : FolderTree;

  return (
    <div
      className={cn(
        "inline-flex rounded-[var(--mini-radius-control)] border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label={listLabel}
    >
      <button
        type="button"
        aria-pressed={value === "list"}
        title={listLabel}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[calc(var(--mini-radius-control)-2px)] px-2.5 text-xs font-medium transition-colors",
          value === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-3.5" />
        <span className="hidden sm:inline">{listLabel}</span>
      </button>
      <button
        type="button"
        aria-pressed={value === "directory"}
        title={directoryLabel}
        onClick={() => onChange("directory")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[calc(var(--mini-radius-control)-2px)] px-2.5 text-xs font-medium transition-colors",
          value === "directory"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <DirectoryIcon className="size-3.5" />
        <span className="hidden sm:inline">{directoryLabel}</span>
      </button>
    </div>
  );
}
