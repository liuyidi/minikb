"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
};

export function Modal({ open, title, onClose, children, footer, closeLabel = "Close" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(8, 8, 8, 0.32)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--mini-color-canvas)",
          border: "1px solid var(--mini-color-border-soft)",
          borderRadius: "var(--mini-radius-surface)",
          boxShadow: "0 24px 48px rgba(8, 8, 8, 0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--mini-color-border-soft)",
          }}
        >
          <h2
            id="modal-title"
            style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            {title}
          </h2>
          <Button variant="secondary" type="button" onClick={onClose} aria-label={closeLabel}>
            {closeLabel}
          </Button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
        {footer ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              padding: "16px 24px 24px",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
