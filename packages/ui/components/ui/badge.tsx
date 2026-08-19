import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@minikb/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "bg-[var(--success-foreground)] text-[var(--success)]",
        warning: "bg-[var(--warning-foreground)] text-[var(--warning)]",
        danger: "bg-[var(--mini-color-danger-surface)] text-destructive",
        destructive: "bg-[var(--mini-color-danger-surface)] text-destructive",
        info: "bg-[var(--info-foreground)] text-[var(--info)]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
