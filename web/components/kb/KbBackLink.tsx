"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useLocale } from "@/app/providers";

export function KbBackLink() {
  const { t } = useLocale();

  return (
    <div className="px-10 pt-4 pb-1">
      <Link
        href="/kbs"
        className="inline-flex items-center gap-1 text-sm text-[var(--mini-color-muted)] transition-colors hover:text-[var(--mini-color-ink)]"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        {t("kb.backToList")}
      </Link>
    </div>
  );
}
