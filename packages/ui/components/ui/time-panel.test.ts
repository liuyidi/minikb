import { describe, expect, it } from "vitest";
import {
  TIME_COLUMN_PAD,
  TIME_COLUMN_VIEWPORT,
  TIME_OPTION_HEIGHT,
  timeColumnScrollTop,
} from "./time-panel";

describe("timeColumnScrollTop", () => {
  it("centers index 0 at the top pad boundary", () => {
    expect(TIME_COLUMN_PAD).toBe((TIME_COLUMN_VIEWPORT - TIME_OPTION_HEIGHT) / 2);
    expect(timeColumnScrollTop(0)).toBe(0);
  });

  it("places hour 20 at a scroll offset that can sit mid-viewport with pads", () => {
    expect(timeColumnScrollTop(20)).toBe(20 * (TIME_OPTION_HEIGHT + 2));
  });
});
