"use client";

import type { CSSProperties, ReactNode } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  height: "var(--mini-control-height-compact)",
  padding: "0 12px",
  borderRadius: "var(--mini-radius-control)",
  border: "1px solid var(--mini-color-border-soft)",
  background: "var(--mini-color-canvas)",
  color: "var(--mini-color-ink)",
  fontSize: 14,
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: 80,
  padding: "10px 12px",
  resize: "vertical",
};

export function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ padding: "32px 40px", maxWidth: 960 }}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        {subtitle ? (
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--mini-color-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>{actions}</div> : null}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--mini-color-canvas)",
        border: "1px solid var(--mini-color-border-soft)",
        borderRadius: "var(--mini-radius-surface)",
        padding: 20,
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type BadgeVariant = "success" | "warning" | "danger" | "info";

const badgeColors: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: "#ecfdf3", color: "#027a48" },
  warning: { bg: "#fffaeb", color: "#b54708" },
  danger: { bg: "var(--mini-color-danger-surface)", color: "var(--mini-color-danger)" },
  info: { bg: "#f0f4ff", color: "#3538cd" },
};

export function Badge({ children, variant = "info" }: { children: ReactNode; variant?: BadgeVariant }) {
  const colors = badgeColors[variant];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: colors.bg,
        color: colors.color,
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p style={{ margin: 0, textAlign: "center", color: "var(--mini-color-muted)", padding: "24px 0" }}>
        {message}
      </p>
    </Card>
  );
}

export function FormGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

export function statusBadgeVariant(
  status: string,
): BadgeVariant {
  if (status === "ready" || status === "idle" || status === "completed") return "success";
  if (status === "failed" || status === "error") return "danger";
  if (status === "pending" || status === "syncing") return "warning";
  return "info";
}
