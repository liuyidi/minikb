"use client";

import * as React from "react";
import { cn } from "@minikb/ui/lib/utils";
import { dateFromYearSelection } from "@minikb/ui/lib/picker-format";
import {
  PickerPanelHeader,
  pickerCellClassName,
  pickerCellSelectedClassName,
  pickerPanelClassName,
} from "./picker-panel";

function decadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

export type YearPanelProps = {
  value: Date | null;
  onChange: (next: Date) => void;
  onClose?: () => void;
};

export function YearPanel({ value, onChange, onClose }: YearPanelProps) {
  const [pageStart, setPageStart] = React.useState(decadeStart(value?.getFullYear() ?? new Date().getFullYear()));
  const years = Array.from({ length: 12 }, (_, index) => pageStart - 1 + index);

  return (
    <div className={pickerPanelClassName}>
      <PickerPanelHeader
        label={`${pageStart} - ${pageStart + 9}`}
        onPrevPage={() => setPageStart((current) => current - 10)}
        onNextPage={() => setPageStart((current) => current + 10)}
      />
      <div className="flex flex-wrap gap-2 px-1">
        {years.map((year) => {
          const selected = value?.getFullYear() === year;
          return (
            <button
              key={year}
              type="button"
              className={cn(pickerCellClassName, selected && pickerCellSelectedClassName)}
              onClick={() => {
                onChange(dateFromYearSelection(year));
                onClose?.();
              }}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
