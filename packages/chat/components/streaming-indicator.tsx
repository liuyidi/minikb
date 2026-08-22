"use client";

import { cn } from "@minikb/ui/lib/utils";

export interface StreamingIndicatorProps {
  className?: string;
  label?: string;
}

function StreamingIndicator({ className, label = "Generating" }: StreamingIndicatorProps) {
  return (
    <span
      data-slot="streaming-indicator"
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

export { StreamingIndicator };
