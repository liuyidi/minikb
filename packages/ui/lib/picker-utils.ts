import { pad2 } from "./time-segments";
import { fieldFocusClassName } from "./field-styles";

export function parseTimeString(value: string | null | undefined): { hours: number; minutes: number } {
  if (!value) return { hours: 0, minutes: 0 };
  const [hh, mm] = value.split(":");
  return {
    hours: parseInt(hh ?? "0", 10) || 0,
    minutes: parseInt(mm ?? "0", 10) || 0,
  };
}

export function normalizeTimeString(value: string): string {
  const { hours, minutes } = parseTimeString(value);
  const h = Math.min(23, Math.max(0, hours));
  const m = Math.min(59, Math.max(0, minutes));
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function timeStringFromDate(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatTimeString(date: Date): string {
  return timeStringFromDate(date);
}

export function formatDateTimeValue(date: Date): string {
  return `${formatDateValue(date)} ${timeStringFromDate(date)}`;
}

export function applyDateToDateTime(
  base: Date | null,
  selectedDate: Date,
  fallbackTime = "00:00",
): Date {
  const time = base ? timeStringFromDate(base) : fallbackTime;
  const { hours, minutes } = parseTimeString(time);
  const next = new Date(selectedDate);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function applyTimeToDateTime(base: Date | null, time: string): Date {
  const normalized = normalizeTimeString(time);
  const { hours, minutes } = parseTimeString(normalized);
  const next = base ? new Date(base) : new Date();
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export const pickerTriggerClassName =
  `inline-flex h-8 w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-normal transition-colors hover:bg-background outline-none disabled:cursor-not-allowed disabled:opacity-50 ${fieldFocusClassName}`;
