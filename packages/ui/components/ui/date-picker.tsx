"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { Calendar } from "@minikb/ui/components/ui/calendar";
import { MonthPanel } from "@minikb/ui/components/ui/month-panel";
import { YearPanel } from "@minikb/ui/components/ui/year-panel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import { cn } from "@minikb/ui/lib/utils";
import {
  type DatePickerMode,
  endOfISOWeek,
  formatDateByMode,
  isSameISOWeek,
  startOfISOWeek,
} from "@minikb/ui/lib/picker-format";
import { pickerTriggerClassName } from "@minikb/ui/lib/picker-utils";

export type DatePickerProps = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  picker?: DatePickerMode;
  /**
   * When `picker="date"`, allow clicking header year/month to switch to year/month panels
   * (Ant Design DatePicker behavior). Default `true`.
   */
  allowPanelSwitch?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

type PanelView = "date" | "week" | "month" | "year";

const PLACEHOLDERS: Record<DatePickerMode, string> = {
  date: "请选择日期",
  week: "请选择周",
  month: "请选择月份",
  year: "请选择年份",
};

export function DatePicker({
  value,
  onChange,
  picker = "date",
  allowPanelSwitch = true,
  disabled,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<PanelView>(picker);
  const [viewDate, setViewDate] = React.useState<Date>(value ?? new Date());
  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null);

  const resolvedPlaceholder = placeholder ?? PLACEHOLDERS[picker];
  const label = value ? formatDateByMode(value, picker) : resolvedPlaceholder;

  React.useEffect(() => {
    if (!open) return;
    setPanel(picker);
    setViewDate(value ?? new Date());
    setHoveredDate(null);
  }, [open, picker, value]);

  const commitDate = (date: Date) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel ?? resolvedPlaceholder}
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
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {panel === "month" || picker === "month" ? (
          <MonthPanel
            value={picker === "month" ? value : viewDate}
            onChange={(date) => {
              if (picker === "month") {
                commitDate(date);
                return;
              }
              setViewDate(date);
              setPanel("date");
            }}
          />
        ) : panel === "year" || picker === "year" ? (
          <YearPanel
            value={picker === "year" ? value : viewDate}
            onChange={(date) => {
              if (picker === "year") {
                commitDate(date);
                return;
              }
              setViewDate(
                new Date(
                  date.getFullYear(),
                  viewDate.getMonth(),
                  Math.min(viewDate.getDate(), 28),
                ),
              );
              setPanel("date");
            }}
          />
        ) : picker === "week" ? (
          <Calendar
            mode="range"
            ISOWeek
            showWeekNumber
            month={viewDate}
            onMonthChange={setViewDate}
            selected={
              value
                ? { from: startOfISOWeek(value), to: endOfISOWeek(value) }
                : undefined
            }
            modifiers={{
              hoveredWeek: hoveredDate
                ? (date) => {
                    if (value && isSameISOWeek(date, value)) return false;
                    return isSameISOWeek(date, hoveredDate);
                  }
                : undefined,
            }}
            modifiersClassNames={{
              hoveredWeek: "bg-muted [&_button]:hover:bg-transparent",
            }}
            onDayMouseEnter={setHoveredDate}
            onDayMouseLeave={() => setHoveredDate(null)}
            onSelect={(_range, triggerDate) => {
              commitDate(startOfISOWeek(triggerDate));
            }}
            onWeekNumberClick={(_weekNumber, dates) => {
              const first = Array.isArray(dates) ? dates[0] : undefined;
              if (first instanceof Date) {
                commitDate(startOfISOWeek(first));
              }
            }}
          />
        ) : (
          <Calendar
            mode="single"
            month={viewDate}
            onMonthChange={setViewDate}
            selected={value ?? undefined}
            onSelect={(date) => {
              if (!date) {
                onChange(null);
                return;
              }
              commitDate(date);
            }}
            onYearClick={
              allowPanelSwitch
                ? () => {
                    setPanel("year");
                  }
                : undefined
            }
            onMonthClick={
              allowPanelSwitch
                ? () => {
                    setPanel("month");
                  }
                : undefined
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
