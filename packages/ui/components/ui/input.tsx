import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { fieldFocusClassName } from "@minikb/ui/lib/field-styles";
import { cn } from "@minikb/ui/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        fieldFocusClassName,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
