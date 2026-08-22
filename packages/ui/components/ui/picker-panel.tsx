"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { cn } from "@minikb/ui/lib/utils";

export const pickerPanelClassName = "w-[280px] bg-popover p-2 text-sm";

export function PickerNavButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="icon" className={cn("size-7", className)} {...props}>
      {children}
    </Button>
  );
}

export function PickerPanelHeader({
  label,
  onPrev,
  onNext,
  onPrevPage,
  onNextPage,
  className,
}: {
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between px-1", className)}>
      <div className="flex items-center gap-0.5">
        {onPrevPage ? (
          <PickerNavButton onClick={onPrevPage}>
            <ChevronsLeftIcon className="size-3.5" />
          </PickerNavButton>
        ) : null}
        {onPrev ? (
          <PickerNavButton onClick={onPrev}>
            <ChevronLeftIcon className="size-3.5" />
          </PickerNavButton>
        ) : null}
      </div>
      <div className="px-1 font-medium">{label}</div>
      <div className="flex items-center gap-0.5">
        {onNext ? (
          <PickerNavButton onClick={onNext}>
            <ChevronRightIcon className="size-3.5" />
          </PickerNavButton>
        ) : null}
        {onNextPage ? (
          <PickerNavButton onClick={onNextPage}>
            <ChevronsRightIcon className="size-3.5" />
          </PickerNavButton>
        ) : null}
      </div>
    </div>
  );
}

export const pickerCellClassName =
  "inline-flex h-8 w-[calc(33.333%-0.5rem)] cursor-pointer items-center justify-center rounded-[var(--radius)] text-sm transition-colors hover:bg-muted";

export const pickerCellSelectedClassName = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";
