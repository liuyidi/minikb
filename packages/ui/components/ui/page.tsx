import type { ReactNode } from "react";
import { cn } from "@minikb/ui/lib/utils";
import { Label } from "@minikb/ui/components/ui/label";

function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("max-w-[960px] px-10 py-8", className)}>{children}</div>;
}

function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 mb-0 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </div>
  );
}

function FormGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type BadgeVariant = "success" | "warning" | "danger" | "info";

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === "ready" || status === "idle" || status === "completed") return "success";
  if (status === "failed" || status === "error") return "danger";
  if (status === "pending" || status === "syncing") return "warning";
  return "info";
}

export { PageShell, PageHeader, FormGroup, statusBadgeVariant };
export type { BadgeVariant };
