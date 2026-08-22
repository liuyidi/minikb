"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@minikb/ui/lib/utils";
import { Button } from "@minikb/ui/components/ui/button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-black/32", className)}
      {...props}
    />
  );
}

function DialogClose({
  className,
  label = "Close",
  ...props
}: DialogPrimitive.Close.Props & { label?: string }) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(className)}
      render={
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-[var(--radius)] text-muted-foreground hover:bg-muted/60 hover:text-foreground [&_svg]:size-4"
          aria-label={label}
        />
      }
      {...props}
    >
      <XIcon />
      <span className="sr-only">{label}</span>
    </DialogPrimitive.Close>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-[var(--radius-lg)] border-0 bg-background shadow-[0_12px_48px_rgba(8,8,8,0.14)] outline-none sm:max-w-[480px]",
          showCloseButton && "[&_[data-slot=dialog-header]]:pr-11",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose label={closeLabel} className="absolute top-5 right-5" />
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 px-6 pt-6 pb-0", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 px-6 pt-2 pb-6 sm:flex-row sm:justify-end",
        "[&_[data-slot=button]]:h-10 [&_[data-slot=button]]:min-w-[4.5rem] [&_[data-slot=button]]:px-4",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
