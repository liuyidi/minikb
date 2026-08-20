import { pad2 } from "./time-segments";

export type DatePickerMode = "date" | "week" | "month" | "year";

export function startOfISOWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfISOWeek(date: Date): Date {
  const end = startOfISOWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isSameISOWeek(a: Date, b: Date): boolean {
  return startOfISOWeek(a).getTime() === startOfISOWeek(b).getTime();
}

export function getISOWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const week1 = new Date(target.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return { year: target.getFullYear(), week };
}

export function formatMonthValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function formatYearValue(date: Date): string {
  return String(date.getFullYear());
}

export function formatWeekValue(date: Date): string {
  const { year, week } = getISOWeekInfo(startOfISOWeek(date));
  return `${year}-${pad2(week)}周`;
}

export function formatDateByMode(date: Date, mode: DatePickerMode): string {
  switch (mode) {
    case "week":
      return formatWeekValue(date);
    case "month":
      return formatMonthValue(date);
    case "year":
      return formatYearValue(date);
    default:
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
}

export type DateRangeValue = {
  from: Date;
  to: Date;
};

export function formatDateRangeValue(
  value: DateRangeValue | null,
  separator = " ~ ",
): string | null {
  if (!value) return null;
  return `${formatDateByMode(value.from, "date")}${separator}${formatDateByMode(value.to, "date")}`;
}

export function normalizeDateRange(
  from: Date,
  to: Date,
): DateRangeValue {
  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }
  return { from: to, to: from };
}

export function isCompleteDateRange(
  range: { from?: Date; to?: Date } | undefined,
): range is DateRangeValue {
  return Boolean(range?.from && range?.to);
}

export function dateFromMonthSelection(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

export function dateFromYearSelection(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

export function defaultDraftTime(value: string | null): string {
  if (value) return value;
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}
