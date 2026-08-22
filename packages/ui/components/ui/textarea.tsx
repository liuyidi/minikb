import * as React from "react";
import { fieldFocusClassName } from "@minikb/ui/lib/field-styles";
import { cn } from "@minikb/ui/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        fieldFocusClassName,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
