import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "@minikb/ui/components/ui/checkbox";

const meta = {
  title: "Components/表单/Checkbox 复选框",
  component: Checkbox,
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox defaultChecked />
      启用 API Key 校验
    </label>
  ),
};

export const Unchecked: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox />
        同步完成后通知我
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox disabled />
        Disabled
      </label>
    </div>
  ),
};
