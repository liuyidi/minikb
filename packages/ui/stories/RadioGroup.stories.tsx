import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Label } from "@minikb/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@minikb/ui/components/ui/radio-group";
import { Field, FieldDescription, FieldLabel } from "@minikb/ui/components/ui/field";

const meta = {
  title: "Components/表单/RadioGroup 单选组",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("hybrid");
    return (
      <Field className="w-80">
        <FieldLabel>检索模式</FieldLabel>
        <RadioGroup value={value} onValueChange={setValue}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="hybrid" id="hybrid" />
            <Label htmlFor="hybrid">混合检索</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="vector" id="vector" />
            <Label htmlFor="vector">向量</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="keyword" id="keyword" />
            <Label htmlFor="keyword">关键词</Label>
          </div>
        </RadioGroup>
        <FieldDescription>当前：{value}</FieldDescription>
      </Field>
    );
  },
};
