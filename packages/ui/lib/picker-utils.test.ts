// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyDateToDateTime,
  applyTimeToDateTime,
  formatDateTimeValue,
  formatDateValue,
  formatTimeString,
  normalizeTimeString,
  parseTimeString,
  timeStringFromDate,
} from "./picker-utils";

describe("normalizeTimeString", () => {
  it("pads single-digit parts", () => {
    expect(normalizeTimeString("9:5")).toBe("09:05");
  });

  it("clamps hours and minutes", () => {
    expect(normalizeTimeString("25:70")).toBe("23:59");
  });

  it("handles empty input as midnight", () => {
    expect(normalizeTimeString("")).toBe("00:00");
  });
});

describe("parseTimeString", () => {
  it("parses HH:MM", () => {
    expect(parseTimeString("09:30")).toEqual({ hours: 9, minutes: 30 });
  });

  it("returns zeros for null", () => {
    expect(parseTimeString(null)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("formatDateValue", () => {
  it("formats local date as YYYY-MM-DD", () => {
    const date = new Date(2026, 7, 20);
    expect(formatDateValue(date)).toBe("2026-08-20");
  });
});

describe("timeStringFromDate", () => {
  it("formats local time as HH:MM", () => {
    const date = new Date(2026, 7, 20, 9, 5);
    expect(timeStringFromDate(date)).toBe("09:05");
  });
});

describe("formatDateTimeValue", () => {
  it("combines date and time", () => {
    const date = new Date(2026, 7, 20, 14, 30);
    expect(formatDateTimeValue(date)).toBe("2026-08-20 14:30");
  });
});

describe("applyDateToDateTime", () => {
  it("keeps time from base date", () => {
    const base = new Date(2026, 0, 1, 14, 30);
    const selected = new Date(2026, 7, 20);
    const result = applyDateToDateTime(base, selected);
    expect(formatDateValue(result)).toBe("2026-08-20");
    expect(formatTimeString(result)).toBe("14:30");
  });

  it("uses fallback time when base is null", () => {
    const selected = new Date(2026, 7, 20);
    const result = applyDateToDateTime(null, selected);
    expect(formatDateValue(result)).toBe("2026-08-20");
    expect(formatTimeString(result)).toBe("00:00");
  });
});

describe("applyTimeToDateTime", () => {
  it("keeps date from base", () => {
    const base = new Date(2026, 7, 20, 10, 0);
    const result = applyTimeToDateTime(base, "15:45");
    expect(formatDateValue(result)).toBe("2026-08-20");
    expect(formatTimeString(result)).toBe("15:45");
  });

  it("uses today when base is null", () => {
    const today = new Date();
    const result = applyTimeToDateTime(null, "09:30");
    expect(result.getFullYear()).toBe(today.getFullYear());
    expect(result.getMonth()).toBe(today.getMonth());
    expect(result.getDate()).toBe(today.getDate());
    expect(formatTimeString(result)).toBe("09:30");
  });
});
