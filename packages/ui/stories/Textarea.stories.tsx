import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "@minikb/ui/components/ui/textarea";
import { Label } from "@minikb/ui/components/ui/label";

const meta = {
  title: "Components/表单/Textarea 多行输入",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "描述知识库用途…",
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex w-96 flex-col gap-2">
      <Label htmlFor="desc">描述</Label>
      <Textarea id="desc" {...args} />
    </div>
  ),
};
