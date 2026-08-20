"use client";

import * as React from "react";
import { DayPicker, useDayPicker, type DayButtonProps } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { PickerNavButton } from "@minikb/ui/components/ui/picker-panel";
import { cn } from "@minikb/ui/lib/utils";

function SwitchableCaptionLabel({
  className,
  onYearClick,
  onMonthClick,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  onYearClick?: () => void;
  onMonthClick?: () => void;
}) {
  const { months } = useDayPicker();
  const date = months[0]?.date;

  if (!date || (!onYearClick && !onMonthClick)) {
    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  }

  return (
    <span
      {...props}
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1", className)}
    >
      <button
        type="button"
        className="rounded-sm px-0.5 font-medium transition-colors hover:text-primary"
        onClick={onYearClick}
      >
        {date.getFullYear()}年
      </button>
      <button
        type="button"
        className="rounded-sm px-0.5 font-medium transition-colors hover:text-primary"
        onClick={onMonthClick}
      >
        {date.getMonth() + 1}月
      </button>
    </span>
  );
}

/**
 * Day cell button. Selected / range endpoints keep primary fill and skip muted hover
 * (aria-selected is on the parent cell, so CSS aria-selected:hover on the button never wins).
 */
function CalendarDayButton({
  className,
  day: _day,
  modifiers,
  ...props
}: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isSolidSelected =
    Boolean(modifiers.selected) && !modifiers.range_middle;

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[var(--radius)] p-0 font-normal transition-colors",
        // Selected days intentionally have no hover style (conflicts with primary fill).
        !isSolidSelected && "hover:bg-muted",
        // shadcn-style today: soft accent fill when not selected.
        modifiers.today &&
          !isSolidSelected &&
          "bg-accent text-accent-foreground hover:bg-accent",
        isSolidSelected && "bg-primary text-primary-foreground",
        modifiers.range_middle && "rounded-none bg-transparent",
        className,
      )}
    />
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /** Click year in caption to switch panel (Ant-style). */
  onYearClick?: () => void;
  /** Click month in caption to switch panel (Ant-style). */
  onMonthClick?: () => void;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout = "around",
  onYearClick,
  onMonthClick,
  components: userComponents,
  ...props
}: CalendarProps) {
  const components: React.ComponentProps<typeof DayPicker>["components"] = {
    PreviousMonthButton: ({ className, ...buttonProps }) => (
      <PickerNavButton
        className={className}
        disabled={buttonProps["aria-disabled"] === true || buttonProps.disabled}
        {...buttonProps}
      >
        <ChevronLeftIcon className="size-3.5" />
      </PickerNavButton>
    ),
    NextMonthButton: ({ className, ...buttonProps }) => (
      <PickerNavButton
        className={className}
        disabled={buttonProps["aria-disabled"] === true || buttonProps.disabled}
        {...buttonProps}
      >
        <ChevronRightIcon className="size-3.5" />
      </PickerNavButton>
    ),
    CaptionLabel: (captionProps) => (
      <SwitchableCaptionLabel
        {...captionProps}
        onYearClick={onYearClick}
        onMonthClick={onMonthClick}
      />
    ),
    DayButton: CalendarDayButton,
    ...userComponents,
  };

  return (
    <DayPicker
      locale={zhCN}
      navLayout={navLayout}
      components={components}
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "relative space-y-2",
        month_caption: "mb-2 flex h-7 items-center justify-center px-8",
        caption_label: "text-sm font-medium",
        button_previous: "absolute left-1 top-0 z-10",
        button_next: "absolute right-1 top-0 z-10",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "inline-flex size-8 items-center justify-center text-center text-xs font-normal text-muted-foreground",
        week: "mt-1 flex w-full items-center",
        day: "relative p-0 text-center text-sm",
        day_button: "",
        selected: "bg-primary text-primary-foreground",
        range_start: "rounded-l-[var(--radius)] bg-primary text-primary-foreground",
        range_middle: "rounded-none bg-primary/12 text-foreground",
        range_end: "rounded-r-[var(--radius)] bg-primary text-primary-foreground",
        // Soft accent chip (shadcn today); selected state overrides via DayButton.
        today: "rounded-[var(--radius)] bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-45",
        disabled: "text-muted-foreground opacity-35",
        week_number_header:
          "inline-flex size-8 items-center justify-center text-xs text-muted-foreground",
        week_number:
          "inline-flex size-8 items-center justify-center text-xs font-normal text-muted-foreground",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
