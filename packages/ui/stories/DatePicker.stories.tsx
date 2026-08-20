import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  DatePicker,
  type DatePickerProps,
} from "@minikb/ui/components/ui/date-picker";

function DatePickerDemo({
  value: initialValue = null,
  onChange,
  ...props
}: DatePickerProps) {
  const [value, setValue] = useState<Date | null>(initialValue);
  return (
    <DatePicker
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
  title: "Components/表单/DatePicker 日期选择",
  component: DatePickerDemo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "受控日期选择器。支持 `date` / `week` / `month` / `year` 四种面板模式，值类型为 `Date | null`。`date` 模式下默认可通过头部年月切换面板（`allowPanelSwitch`）。",
      },
    },
  },
  argTypes: {
    value: { control: false, description: "当前选中日期" },
    onChange: { action: "changed", description: "选中或清空时触发" },
    picker: {
      control: "select",
      options: ["date", "week", "month", "year"],
      description: "面板模式",
    },
    allowPanelSwitch: {
      control: "boolean",
      description: "date 模式下点击头部年月切换到月/年面板（默认 true）",
    },
    disabled: { control: "boolean", description: "禁用" },
    placeholder: { control: "text", description: "空值占位文案" },
    className: { control: false },
    "aria-label": { control: "text", description: "无障碍标签" },
  },
  args: {
    picker: "date",
    allowPanelSwitch: true,
    disabled: false,
  },
} satisfies Meta<typeof DatePickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { value: new Date(2026, 7, 20) },
};

export const Week: Story = {
  args: { picker: "week", value: new Date(2026, 7, 20) },
};

export const Month: Story = {
  args: { picker: "month", value: new Date(2026, 7, 1) },
};

export const Year: Story = {
  args: { picker: "year", value: new Date(2026, 0, 1) },
};

export const WithoutPanelSwitch: Story = {
  name: "禁用头部年月切换",
  args: { allowPanelSwitch: false, value: new Date(2026, 7, 20) },
};

export const Disabled: Story = {
  args: { disabled: true, value: new Date(2026, 7, 20) },
};
