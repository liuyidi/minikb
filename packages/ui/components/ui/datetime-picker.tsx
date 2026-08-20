"use client";

import * as React from "react";
import { CalendarClockIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { Calendar } from "@minikb/ui/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import { TimePanel } from "@minikb/ui/components/ui/time-panel";
import { cn } from "@minikb/ui/lib/utils";
import { defaultDraftTime } from "@minikb/ui/lib/picker-format";
import {
  applyDateToDateTime,
  applyTimeToDateTime,
  formatDateTimeValue,
  pickerTriggerClassName,
  timeStringFromDate,
} from "@minikb/ui/lib/picker-utils";

export type DateTimePickerProps = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "请选择日期和时间",
  className,
  "aria-label": ariaLabel = "选择日期和时间",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draftTime, setDraftTime] = React.useState(() =>
    value ? timeStringFromDate(value) : defaultDraftTime(null),
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftTime(value ? timeStringFromDate(value) : defaultDraftTime(null));
    }
    setOpen(next);
  };

  const label = value ? formatDateTimeValue(value) : placeholder;

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
        <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            defaultMonth={value ?? undefined}
            className="border-b border-border sm:border-b-0 sm:border-r"
            onSelect={(date) => {
              if (!date) return;
              onChange(applyDateToDateTime(value, date));
            }}
          />
          <div className="p-2">
            <TimePanel
              key={open ? "open" : "closed"}
              value={draftTime}
              onChange={(next) => {
                setDraftTime(next);
                onChange(applyTimeToDateTime(value, next));
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
