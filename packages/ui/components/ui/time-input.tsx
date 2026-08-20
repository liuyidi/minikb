"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@minikb/ui/lib/utils";
import { arrowValue, getValidNumber, pad2, splitTime } from "@minikb/ui/lib/time-segments";

interface SegmentInputProps {
  value: string;
  min: number;
  max: number;
  clearTo?: number;
  onValueChange: (next: string) => void;
  onLeftFocus?: () => void;
  onRightFocus?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  slot?: string;
  autoFocus?: boolean;
}

const SegmentInput = React.forwardRef<HTMLInputElement, SegmentInputProps>(function SegmentInput(
  { value, min, max, clearTo, onValueChange, onLeftFocus, onRightFocus, disabled, ariaLabel, slot, autoFocus },
  ref,
) {
  const [pendingFirst, setPendingFirst] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pendingFirst === null) return;
    const t = setTimeout(() => setPendingFirst(null), 2000);
    return () => clearTimeout(t);
  }, [pendingFirst]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onRightFocus?.();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onLeftFocus?.();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.key === "ArrowUp" ? 1 : -1;
      onValueChange(arrowValue(value, step, min, max));
      setPendingFirst(null);
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      if (pendingFirst !== null) {
        onValueChange(getValidNumber(pendingFirst + e.key, { max, min }));
        setPendingFirst(null);
        onRightFocus?.();
      } else {
        onValueChange(getValidNumber("0" + e.key, { max, min }));
        setPendingFirst(e.key);
      }
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onValueChange(pad2(clearTo ?? min));
      setPendingFirst(null);
    }
  };

  return (
    <input
      ref={ref}
      data-slot={slot}
      autoFocus={autoFocus}
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setPendingFirst(null)}
      className="w-7 bg-transparent text-center text-sm tabular-nums outline-none caret-transparent focus:text-foreground disabled:opacity-50"
    />
  );
});

export interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
  hourOnly?: boolean;
  hourMin?: number;
  hourClearTo?: number;
  hourLabel?: string;
  minuteLabel?: string;
  segmentSlot?: string;
  autoFocus?: boolean;
}

export function TimeInput({
  value,
  onChange,
  disabled,
  className,
  showIcon = true,
  hourOnly = false,
  hourMin = 0,
  hourClearTo,
  hourLabel = "Hour",
  minuteLabel = "Minute",
  segmentSlot,
  autoFocus,
}: TimeInputProps) {
  const { hh, mm } = splitTime(value, hourMin);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const minuteRef = React.useRef<HTMLInputElement>(null);

  const setHour = (next: string) => onChange(`${next}:${mm}`);
  const setMinute = (next: string) => onChange(`${hh}:${next}`);

  return (
    <div
      data-slot="time-input"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hourRef.current?.focus();
        }
      }}
      className={cn(
        "flex h-11 items-center gap-1 rounded-[var(--radius)] border border-input bg-background px-2.5 text-sm transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
    >
      {showIcon && (
        <Clock className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      )}
      <SegmentInput
        ref={hourRef}
        min={hourMin}
        max={23}
        clearTo={hourClearTo}
        value={hh}
        onValueChange={setHour}
        onRightFocus={hourOnly ? undefined : () => minuteRef.current?.focus()}
        disabled={disabled}
        ariaLabel={hourLabel}
        slot={segmentSlot}
        autoFocus={autoFocus}
      />
      {!hourOnly && (
        <>
          <span className="pointer-events-none -translate-y-px select-none text-muted-foreground">:</span>
          <SegmentInput
            ref={minuteRef}
            min={0}
            max={59}
            value={mm}
            onValueChange={setMinute}
            onLeftFocus={() => hourRef.current?.focus()}
            disabled={disabled}
            ariaLabel={minuteLabel}
            slot={segmentSlot}
          />
        </>
      )}
    </div>
  );
}
