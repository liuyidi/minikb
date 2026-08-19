"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--mini-color-ink)",
    color: "#ffffff",
    border: "1px solid var(--mini-color-ink)",
  },
  secondary: {
    background: "transparent",
    color: "var(--mini-color-ink)",
    border: "1px solid var(--mini-color-border-soft)",
  },
  danger: {
    background: "var(--mini-color-danger)",
    color: "#ffffff",
    border: "1px solid var(--mini-color-danger)",
  },
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", style, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "var(--mini-control-height-compact)",
        padding: "0 16px",
        borderRadius: "var(--mini-radius-control)",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...variantStyles[variant],
        ...style,
      }}
    />
  );
}
