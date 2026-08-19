"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "border border-border bg-background text-foreground shadow-md",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
