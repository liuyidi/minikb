import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  RangeDatePicker,
  type DateRangeValue,
  type RangeDatePickerProps,
} from "@minikb/ui/components/ui/range-date-picker";
import { formatDateRangeValue } from "@minikb/ui/lib/picker-format";

function RangeDatePickerDemo({
  value: initialValue = null,
  onChange,
  ...props
}: RangeDatePickerProps) {
  const [value, setValue] = useState<DateRangeValue | null>(initialValue);
  return (
    <div className="space-y-2">
      <RangeDatePicker
        {...props}
        className="w-[320px]"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {formatDateRangeValue(value) ?? "未选择"}
      </p>
    </div>
  );
}

const meta = {
  title: "Components/表单/RangeDatePicker 日期范围",
  component: RangeDatePickerDemo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "受控日期范围选择器（对齐 [shadcn Range Picker](https://ui.shadcn.com/docs/components/base/date-picker#range-picker)）。值为 `{ from: Date; to: Date } | null`。默认双月；先选开始再选结束，选齐后提交但不自动关闭（点外部关闭）。",
      },
    },
  },
  argTypes: {
    value: { control: false, description: "当前日期范围" },
    onChange: { action: "changed", description: "范围选齐或清空时触发" },
    numberOfMonths: {
      control: { type: "number", min: 1, max: 3 },
      description: "面板显示月数，默认 2",
    },
    disabled: { control: "boolean", description: "禁用" },
    placeholder: { control: false, description: "开始/结束占位文案 `[string, string]`" },
    className: { control: false },
    "aria-label": { control: "text", description: "无障碍标签" },
  },
  args: {
    numberOfMonths: 2,
    disabled: false,
  },
} satisfies Meta<typeof RangeDatePickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    value: {
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 20),
    },
  },
};

export const SingleMonth: Story = {
  name: "单月面板",
  args: {
    numberOfMonths: 1,
    value: {
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 20),
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: {
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 20),
    },
  },
};
