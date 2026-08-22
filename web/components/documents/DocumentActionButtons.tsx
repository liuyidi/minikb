"use client";

import Link from "next/link";
import { Layers, Trash2 } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { cn } from "@minikb/ui/lib/utils";

type DocumentActionButtonsProps = {
  chunksHref: string;
  viewChunksLabel: string;
  deleteLabel: string;
  onDelete: () => void;
  className?: string;
};

export function DocumentActionButtons({
  chunksHref,
  viewChunksLabel,
  deleteLabel,
  onDelete,
  className,
}: DocumentActionButtonsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={viewChunksLabel}
        title={viewChunksLabel}
        nativeButton={false}
        render={<Link href={chunksHref} />}
      >
        <Layers className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
