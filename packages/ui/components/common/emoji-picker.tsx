"use client";

import * as React from "react";
import { cn } from "@minikb/ui/lib/utils";

const QUICK = ["👍", "👎", "✅", "❌", "🎉", "🔥", "💡", "📌"];

type EmojiPickerProps = {
  className?: string;
  onSelect?: (emoji: string) => void;
};

function EmojiPicker({ className, onSelect }: EmojiPickerProps) {
  return (
    <div data-slot="emoji-picker" className={cn("flex flex-wrap gap-1 p-2", className)}>
      {QUICK.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="size-8 rounded-[var(--radius)] text-lg hover:bg-muted"
          onClick={() => onSelect?.(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export { EmojiPicker };
