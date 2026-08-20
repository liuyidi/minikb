import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DatePicker } from "@minikb/ui/components/ui/date-picker";
import { DateTimePicker } from "@minikb/ui/components/ui/datetime-picker";
import { TimePicker } from "@minikb/ui/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { Field, FieldDescription, FieldLabel } from "@minikb/ui/components/ui/field";
import {
  RangeDatePicker,
  type DateRangeValue,
} from "@minikb/ui/components/ui/range-date-picker";
import type { DatePickerMode } from "@minikb/ui/lib/picker-format";
import { formatDateRangeValue } from "@minikb/ui/lib/picker-format";

const meta = {
  title: "Components/表单/Pickers 概览",
  parameters: {
    docs: {
      disable: true,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const pickerTypeItems = [
  { value: "time", label: "Time" },
  { value: "date", label: "Date" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

type SwitchablePickerType = (typeof pickerTypeItems)[number]["value"];

export const SwitchablePicker: Story = {
  name: "Switchable 可切换",
  render: () => {
    const [type, setType] = useState<SwitchablePickerType>("time");
    const [dateValue, setDateValue] = useState<Date | null>(new Date(2026, 7, 20));
    const [timeValue, setTimeValue] = useState<string | null>("14:30");

    return (
      <div className="flex flex-wrap items-start gap-3">
        <Select
          size="sm"
          items={pickerTypeItems}
          value={type}
          onValueChange={(next) => setType((next ?? "time") as SwitchablePickerType)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pickerTypeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type === "time" ? (
          <TimePicker value={timeValue} onChange={setTimeValue} className="w-56" />
        ) : (
          <DatePicker
            picker={type as DatePickerMode}
            value={dateValue}
            onChange={setDateValue}
            className="w-56"
          />
        )}
      </div>
    );
  },
};

export const DatePickerDefault: Story = {
  name: "DatePicker 日期",
  render: () => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <div className="w-72 space-y-2">
        <DatePicker value={value} onChange={setValue} />
        <p className="text-sm text-muted-foreground">
          {value ? value.toLocaleDateString("zh-CN") : "未选择"}
        </p>
      </div>
    );
  },
};

export const DatePickerWeek: Story = {
  name: "DatePicker 周",
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 7, 20));
    return <DatePicker picker="week" value={value} onChange={setValue} className="w-72" />;
  },
};

export const DatePickerMonth: Story = {
  name: "DatePicker 月",
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 7, 1));
    return <DatePicker picker="month" value={value} onChange={setValue} className="w-72" />;
  },
};

export const DatePickerYear: Story = {
  name: "DatePicker 年",
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 0, 1));
    return <DatePicker picker="year" value={value} onChange={setValue} className="w-72" />;
  },
};

export const DatePickerWithValue: Story = {
  name: "DatePicker 有值",
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 7, 20));
    return <DatePicker value={value} onChange={setValue} className="w-72" />;
  },
};

export const DatePickerDisabled: Story = {
  name: "DatePicker 禁用",
  render: () => (
    <DatePicker
      value={new Date(2026, 7, 20)}
      onChange={() => {}}
      disabled
      className="w-72"
    />
  ),
};

export const TimePickerDefault: Story = {
  name: "TimePicker 时间",
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <div className="w-72 space-y-2">
        <TimePicker value={value} onChange={setValue} />
        <p className="text-sm text-muted-foreground">{value ?? "未选择"}</p>
      </div>
    );
  },
};

export const TimePickerSamples: Story = {
  name: "TimePicker 示例时间",
  render: () => {
    const samples = ["09:15", "12:45", "18:30", "23:50"] as const;
    const [value, setValue] = useState<string | null>("09:15");
    return (
      <div className="w-80 space-y-3">
        <TimePicker value={value} onChange={setValue} />
        <div className="flex flex-wrap gap-2">
          {samples.map((sample) => (
            <button
              key={sample}
              type="button"
              className="rounded-[var(--radius)] border border-border px-2.5 py-1 text-sm hover:bg-muted"
              onClick={() => setValue(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">当前值：{value ?? "未选择"}</p>
      </div>
    );
  },
};

export const TimePickerWithValue: Story = {
  name: "TimePicker 有值",
  render: () => {
    const [value, setValue] = useState<string | null>("09:30");
    return <TimePicker value={value} onChange={setValue} className="w-72" />;
  },
};

export const TimePickerHourOnly: Story = {
  name: "TimePicker 仅小时",
  render: () => {
    const [value, setValue] = useState<string | null>("14:00");
    return <TimePicker value={value} onChange={setValue} hourOnly className="w-72" />;
  },
};

export const DateTimePickerDefault: Story = {
  name: "DateTimePicker 日期时间",
  render: () => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <div className="w-80 space-y-2">
        <DateTimePicker value={value} onChange={setValue} />
        <p className="text-sm text-muted-foreground">
          {value ? value.toLocaleString("zh-CN") : "未选择"}
        </p>
      </div>
    );
  },
};

export const DateTimePickerWithValue: Story = {
  name: "DateTimePicker 有值",
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 7, 20, 14, 30));
    return <DateTimePicker value={value} onChange={setValue} className="w-80" />;
  },
};

export const WithField: Story = {
  name: "Field 表单",
  render: () => {
    const [date, setDate] = useState<Date | null>(null);
    const [range, setRange] = useState<DateRangeValue | null>(null);
    const [time, setTime] = useState<string | null>("18:30");
    const [dateTime, setDateTime] = useState<Date | null>(new Date(2026, 7, 20, 14, 30));
    return (
      <div className="flex max-w-sm flex-col gap-4">
        <Field>
          <FieldLabel>截止日期</FieldLabel>
          <DatePicker value={date} onChange={setDate} />
          <FieldDescription>选择知识库同步截止日期</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>统计区间</FieldLabel>
          <RangeDatePicker value={range} onChange={setRange} />
          <FieldDescription>{formatDateRangeValue(range) ?? "未选择区间"}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>提醒时间</FieldLabel>
          <TimePicker value={time} onChange={setTime} />
        </Field>
        <Field>
          <FieldLabel>计划执行</FieldLabel>
          <DateTimePicker value={dateTime} onChange={setDateTime} />
        </Field>
      </div>
    );
  },
};
