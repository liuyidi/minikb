import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  TimePicker,
  type TimePickerProps,
} from "@minikb/ui/components/ui/time-picker";

function TimePickerDemo({
  value: initialValue = null,
  onChange,
  ...props
}: TimePickerProps) {
  const [value, setValue] = useState<string | null>(initialValue);
  return (
    <TimePicker
      {...props}
      className="w-72"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const meta = {
  title: "Components/表单/TimePicker 时间选择",
  component: TimePickerDemo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "受控时间选择器。值为 `string | null`，格式 `HH:MM`（24 小时制）。弹层为 Ant Design 风格的双列滚动面板。",
      },
    },
  },
  argTypes: {
    value: { control: false, description: '当前时间，如 `"09:30"`' },
    onChange: { action: "changed", description: "时间变更时触发" },
    disabled: { control: "boolean", description: "禁用" },
    hourOnly: { control: "boolean", description: "仅选择小时（输出 `HH:00`）" },
    placeholder: { control: "text", description: "空值占位文案" },
    className: { control: false },
    "aria-label": { control: "text", description: "无障碍标签" },
  },
  args: {
    disabled: false,
    hourOnly: false,
  },
} satisfies Meta<typeof TimePickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { value: "09:30" },
};

export const HourOnly: Story = {
  args: { hourOnly: true, value: "14:00" },
};

export const Disabled: Story = {
  args: { disabled: true, value: "18:30" },
};
