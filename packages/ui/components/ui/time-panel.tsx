"use client";

import * as React from "react";
import { cn } from "@minikb/ui/lib/utils";
import { parseTimeString } from "@minikb/ui/lib/picker-utils";
import { pad2 } from "@minikb/ui/lib/time-segments";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

/** Matches `h-8` + `gap-0.5` on option buttons. */
export const TIME_OPTION_HEIGHT = 32;
export const TIME_OPTION_GAP = 2;
/** Matches `h-56` on the scroll viewport. */
export const TIME_COLUMN_VIEWPORT = 224;
/** Top/bottom spacer so first/last options can sit in the visual center. */
export const TIME_COLUMN_PAD =
  (TIME_COLUMN_VIEWPORT - TIME_OPTION_HEIGHT) / 2;

export function timeColumnScrollTop(index: number): number {
  return index * (TIME_OPTION_HEIGHT + TIME_OPTION_GAP);
}

function TimeColumn({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (next: number) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const sync = () => {
      // Popover may report 0 height on the first closed/opening frame.
      if (container.clientHeight < TIME_COLUMN_VIEWPORT) return;
      container.scrollTop = timeColumnScrollTop(value);
    };

    sync();
    const frame = requestAnimationFrame(sync);
    const CanObserve = typeof ResizeObserver !== "undefined";
    const observer = CanObserve ? new ResizeObserver(sync) : null;
    observer?.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [value]);

  return (
    <div className="flex-1">
      <div className="px-2 pb-1 text-center text-xs text-muted-foreground">{label}</div>
      <div
        ref={listRef}
        className="h-56 overflow-y-auto overscroll-contain px-1"
      >
        {/* Spacers: without these, late hours (e.g. 20) cannot sit in the middle. */}
        <div style={{ height: TIME_COLUMN_PAD }} aria-hidden className="shrink-0" />
        <div className="flex flex-col gap-0.5">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                data-value={option}
                aria-label={`${label} ${pad2(option)}`}
                className={cn(
                  "h-8 shrink-0 rounded-[var(--radius)] text-sm tabular-nums transition-colors hover:bg-muted",
                  selected && "bg-primary/10 font-medium text-primary",
                )}
                onClick={() => onChange(option)}
              >
                {pad2(option)}
              </button>
            );
          })}
        </div>
        <div style={{ height: TIME_COLUMN_PAD }} aria-hidden className="shrink-0" />
      </div>
    </div>
  );
}

export type TimePanelProps = {
  value: string;
  onChange: (next: string) => void;
  hourOnly?: boolean;
  className?: string;
};

export function TimePanel({ value, onChange, hourOnly = false, className }: TimePanelProps) {
  const { hours, minutes } = parseTimeString(value);

  return (
    <div className={cn("flex w-[168px] divide-x divide-border", className)}>
      <TimeColumn
        label="时"
        value={hours}
        options={HOURS}
        onChange={(nextHour) => onChange(`${pad2(nextHour)}:${pad2(minutes)}`)}
      />
      {!hourOnly ? (
        <TimeColumn
          label="分"
          value={minutes}
          options={MINUTES}
          onChange={(nextMinute) => onChange(`${pad2(hours)}:${pad2(nextMinute)}`)}
        />
      ) : null}
    </div>
  );
}
