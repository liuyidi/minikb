"use client";

import * as React from "react";
import { cn } from "@minikb/ui/lib/utils";
import { dateFromMonthSelection } from "@minikb/ui/lib/picker-format";
import {
  PickerPanelHeader,
  pickerCellClassName,
  pickerCellSelectedClassName,
  pickerPanelClassName,
} from "./picker-panel";

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export type MonthPanelProps = {
  value: Date | null;
  onChange: (next: Date) => void;
  onClose?: () => void;
};

export function MonthPanel({ value, onChange, onClose }: MonthPanelProps) {
  const [year, setYear] = React.useState(value?.getFullYear() ?? new Date().getFullYear());

  return (
    <div className={pickerPanelClassName}>
      <PickerPanelHeader
        label={`${year}年`}
        onPrev={() => setYear((current) => current - 1)}
        onNext={() => setYear((current) => current + 1)}
      />
      <div className="flex flex-wrap gap-2 px-1">
        {MONTH_LABELS.map((label, month) => {
          const selected = value?.getFullYear() === year && value.getMonth() === month;
          return (
            <button
              key={label}
              type="button"
              className={cn(pickerCellClassName, selected && pickerCellSelectedClassName)}
              onClick={() => {
                onChange(dateFromMonthSelection(year, month));
                onClose?.();
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
