import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  DateTimePicker,
  type DateTimePickerProps,
} from "@minikb/ui/components/ui/datetime-picker";

function DateTimePickerDemo({
  value: initialValue = null,
  onChange,
  ...props
}: DateTimePickerProps) {
  const [value, setValue] = useState<Date | null>(initialValue);
  return (
    <DateTimePicker
      {...props}
      className="w-80"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const meta = {
  title: "Components/表单/DateTimePicker 日期时间",
  component: DateTimePickerDemo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "受控日期时间选择器。值为 `Date | null`，日期与时间合并到同一个 `Date` 对象（本地时区）。",
      },
    },
  },
  argTypes: {
    value: { control: false, description: "当前日期时间" },
    onChange: { action: "changed", description: "变更时触发" },
    disabled: { control: "boolean", description: "禁用" },
    placeholder: { control: "text", description: "空值占位文案" },
    className: { control: false },
    "aria-label": { control: "text", description: "无障碍标签" },
  },
  args: {
    disabled: false,
  },
} satisfies Meta<typeof DateTimePickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { value: new Date(2026, 7, 20, 14, 30) },
};

export const Disabled: Story = {
  args: { disabled: true, value: new Date(2026, 7, 20, 14, 30) },
};
