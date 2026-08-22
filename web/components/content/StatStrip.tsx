import type { ReactNode } from "react";

type StatStripItem = {
  label: string;
  value: string | number;
};

export function StatStrip({ items, className }: { items: StatStripItem[]; className?: string }) {
  return (
    <div className={className ?? "mb-6 flex flex-wrap gap-x-10 gap-y-4"}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {item.value}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function NoticeBanner({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "mb-4 rounded-[var(--mini-radius-control)] bg-muted/35 px-4 py-3 text-sm text-foreground"
      }
    >
      {children}
    </div>
  );
}
