import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@minikb/ui/components/ui/input";
import { Label } from "@minikb/ui/components/ui/label";

const meta = {
  title: "Components/表单/Input 输入框",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "邮箱",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="email">邮箱</Label>
      <Input id="email" {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: "disabled@example.com" },
};

export const Invalid: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="slug">Slug</Label>
      <Input id="slug" aria-invalid {...args} defaultValue="invalid slug" />
      <p className="text-sm text-destructive">仅允许小写字母、数字与连字符。</p>
    </div>
  ),
};
