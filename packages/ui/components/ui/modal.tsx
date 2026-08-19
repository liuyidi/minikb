"use client";

import type { ReactNode } from "react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
};

/** App-friendly dialog wrapper (open / title / onClose) used by minikb pages. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  closeLabel = "Close",
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-[520px] p-0">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>{title}</DialogTitle>
          <Button variant="secondary" type="button" onClick={onClose} aria-label={closeLabel}>
            {closeLabel}
          </Button>
        </DialogHeader>
        <div className="px-6 py-5">{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
