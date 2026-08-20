// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimePicker } from "./time-picker";

afterEach(() => {
  cleanup();
});

describe("TimePicker", () => {
  it("opens the picker panel when the trigger is clicked", () => {
    render(<TimePicker value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "选择时间" }));

    expect(screen.getByText("时")).toBeTruthy();
    expect(screen.getByText("分")).toBeTruthy();
  });

  it("commits a selected time from the panel", () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:30" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "选择时间" }));
    fireEvent.click(screen.getByLabelText("时 14"));
    fireEvent.click(screen.getByLabelText("分 45"));

    expect(onChange).toHaveBeenCalledWith("14:45");
  });
});
