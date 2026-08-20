import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "@minikb/ui/components/ui/label";

const meta = {
  title: "Components/表单/Label 标签",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: "邮箱",
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
