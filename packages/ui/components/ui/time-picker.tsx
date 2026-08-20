"use client";

import * as React from "react";
import { ClockIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import { TimePanel } from "@minikb/ui/components/ui/time-panel";
import { cn } from "@minikb/ui/lib/utils";
import { defaultDraftTime } from "@minikb/ui/lib/picker-format";
import { normalizeTimeString, pickerTriggerClassName } from "@minikb/ui/lib/picker-utils";

export type TimePickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  hourOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function TimePicker({
  value,
  onChange,
  disabled,
  placeholder = "请选择时间",
  hourOnly = false,
  className,
  "aria-label": ariaLabel = "选择时间",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(() => defaultDraftTime(value));

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(defaultDraftTime(value));
    setOpen(next);
  };

  const label = value ? (hourOnly ? `${value.split(":")[0]}:00` : value) : placeholder;

  const commit = (next: string) => {
    const normalized = normalizeTimeString(next);
    onChange(hourOnly ? `${normalized.split(":")[0]}:00` : normalized);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              pickerTriggerClassName,
              !value && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        {/* Remount when opened so column scroll sync runs on a visible panel. */}
        <TimePanel
          key={open ? "open" : "closed"}
          value={draft}
          hourOnly={hourOnly}
          onChange={(next) => {
            setDraft(next);
            commit(next);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
