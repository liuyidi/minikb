import * as React from "react";
import { cn } from "@minikb/ui/lib/utils";
import { Card } from "@minikb/ui/components/ui/card";

function Empty({
  className,
  message,
  children,
  ...props
}: React.ComponentProps<"div"> & { message?: string }) {
  return (
    <Card data-slot="empty" className={cn("mb-0 border-0 bg-muted/20 shadow-none", className)} {...props}>
      {message ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">{message}</p>
      ) : (
        children
      )}
    </Card>
  );
}

/** @deprecated Prefer Empty — kept for page migration parity. */
function EmptyState({ message, className }: { message: string; className?: string }) {
  return <Empty message={message} className={className} />;
}

export { Empty, EmptyState };
