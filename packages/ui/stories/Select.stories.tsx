import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import type { ControlSize } from "@minikb/ui/lib/popup-styles";
import { Field, FieldDescription, FieldLabel } from "@minikb/ui/components/ui/field";

const chunkerItems = [
  { value: "recursive", label: "Recursive" },
  { value: "heading", label: "By Heading" },
  { value: "semantic", label: "Semantic" },
  { value: "code_aware", label: "Code Aware" },
];

type SelectDemoProps = {
  size?: ControlSize;
  disabled?: boolean;
};

function SelectDemo({ size = "default", disabled }: SelectDemoProps) {
  const [value, setValue] = useState("recursive");
  return (
    <Select
      size={size}
      items={chunkerItems}
      value={value}
      onValueChange={(next) => setValue(next ?? "recursive")}
      disabled={disabled}
    >
      <SelectTrigger className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chunkerItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const meta = {
  title: "Components/表单/Select 选择器",
  component: SelectDemo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "下拉选择器（复合组件）。在 `Select` 上设置 `size`，`SelectTrigger` 与 `SelectItem` 高度会自动对齐（`default` = 44px，`sm` = 32px）。",
      },
    },
  },
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "尺寸：`default`（h-11）或 `sm`（h-8）",
    },
    disabled: { control: "boolean", description: "禁用整个选择器" },
  },
  args: {
    size: "default",
    disabled: false,
  },
} satisfies Meta<typeof SelectDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithField: Story = {
  render: () => {
    const [value, setValue] = useState("recursive");
    return (
      <Field className="w-80">
        <FieldLabel htmlFor="chunker">分块策略</FieldLabel>
        <Select items={chunkerItems} value={value} onValueChange={setValue}>
          <SelectTrigger id="chunker">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chunkerItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>修改后需重新索引文档。</FieldDescription>
      </Field>
    );
  },
};
