// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  endOfISOWeek,
  formatDateByMode,
  formatDateRangeValue,
  formatMonthValue,
  formatWeekValue,
  formatYearValue,
  getISOWeekInfo,
  isCompleteDateRange,
  isSameISOWeek,
  normalizeDateRange,
  startOfISOWeek,
} from "./picker-format";

describe("picker-format", () => {
  it("formats month and year values", () => {
    const date = new Date(2026, 7, 20);
    expect(formatMonthValue(date)).toBe("2026-08");
    expect(formatYearValue(date)).toBe("2026");
  });

  it("formats week value from ISO week", () => {
    const date = new Date(2026, 7, 20);
    expect(formatWeekValue(date)).toBe("2026-34周");
  });

  it("starts ISO week on Monday", () => {
    const wednesday = new Date(2026, 7, 20);
    const monday = startOfISOWeek(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(17);
  });

  it("ends ISO week on Sunday", () => {
    const wednesday = new Date(2026, 7, 20);
    const sunday = endOfISOWeek(wednesday);
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getDate()).toBe(23);
  });

  it("compares same ISO week", () => {
    expect(isSameISOWeek(new Date(2026, 7, 17), new Date(2026, 7, 23))).toBe(true);
    expect(isSameISOWeek(new Date(2026, 7, 17), new Date(2026, 7, 24))).toBe(false);
  });

  it("formats by picker mode", () => {
    const date = new Date(2026, 7, 20);
    expect(formatDateByMode(date, "date")).toBe("2026-08-20");
    expect(formatDateByMode(date, "month")).toBe("2026-08");
    expect(formatDateByMode(date, "year")).toBe("2026");
    expect(getISOWeekInfo(date).week).toBe(34);
  });

  it("formats and normalizes date ranges", () => {
    expect(
      formatDateRangeValue({
        from: new Date(2026, 7, 10),
        to: new Date(2026, 7, 20),
      }),
    ).toBe("2026-08-10 ~ 2026-08-20");

    expect(normalizeDateRange(new Date(2026, 7, 20), new Date(2026, 7, 10))).toEqual({
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 20),
    });

    expect(isCompleteDateRange({ from: new Date(2026, 7, 10) })).toBe(false);
    expect(
      isCompleteDateRange({
        from: new Date(2026, 7, 10),
        to: new Date(2026, 7, 20),
      }),
    ).toBe(true);
  });
});
