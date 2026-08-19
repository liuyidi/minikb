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
    <Card data-slot="empty" className={cn("mb-0", className)} {...props}>
      {message ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">{message}</p>
      ) : (
        children
      )}
    </Card>
  );
}

/** @deprecated Prefer Empty — kept for page migration parity. */
function EmptyState({ message }: { message: string }) {
  return <Empty message={message} />;
}

export { Empty, EmptyState };
