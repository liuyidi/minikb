"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { Calendar } from "@minikb/ui/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import { cn } from "@minikb/ui/lib/utils";
import {
  type DateRangeValue,
  formatDateByMode,
  formatDateRangeValue,
  isCompleteDateRange,
  normalizeDateRange,
} from "@minikb/ui/lib/picker-format";
import { pickerTriggerClassName } from "@minikb/ui/lib/picker-utils";

export type { DateRangeValue };

export type RangeDatePickerProps = {
  value: DateRangeValue | null;
  onChange: (next: DateRangeValue | null) => void;
  disabled?: boolean;
  /** Placeholder for start / end when empty. */
  placeholder?: [string, string];
  /** Number of months shown in the panel. Default `2`. */
  numberOfMonths?: number;
  className?: string;
  "aria-label"?: string;
};

const DEFAULT_PLACEHOLDER: [string, string] = ["开始日期", "结束日期"];

export function RangeDatePicker({
  value,
  onChange,
  disabled,
  placeholder = DEFAULT_PLACEHOLDER,
  numberOfMonths = 2,
  className,
  "aria-label": ariaLabel = "选择日期范围",
}: RangeDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined,
  );
  const [viewDate, setViewDate] = React.useState<Date>(value?.from ?? new Date());

  React.useEffect(() => {
    if (!open) return;
    setDraft(value ? { from: value.from, to: value.to } : undefined);
    setViewDate(value?.from ?? new Date());
  }, [open, value]);

  const startLabel = draft?.from
    ? formatDateByMode(draft.from, "date")
    : placeholder[0];
  const endLabel = draft?.to
    ? formatDateByMode(draft.to, "date")
    : placeholder[1];
  const hasValue = Boolean(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              pickerTriggerClassName,
              !hasValue && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
          <span className={cn("truncate", !draft?.from && "text-muted-foreground")}>
            {startLabel}
          </span>
          <span className="shrink-0 text-muted-foreground">~</span>
          <span className={cn("truncate", !draft?.to && "text-muted-foreground")}>
            {endLabel}
          </span>
        </span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={numberOfMonths}
          month={viewDate}
          onMonthChange={setViewDate}
          selected={draft}
          // First click starts `{ from, to: undefined }` instead of same-day complete.
          resetOnSelect
          onSelect={(range) => {
            setDraft(range);
            // Keep open while picking (shadcn range picker). Commit only when both ends exist.
            if (!isCompleteDateRange(range)) return;
            onChange(normalizeDateRange(range.from, range.to));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { formatDateRangeValue };
