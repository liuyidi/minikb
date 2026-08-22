"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "@minikb/ui/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import Providers from "./providers";

function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <ShellLayout>{children}</ShellLayout>
      <Toaster richColors closeButton position="top-center" />
    </Providers>
  );
}
