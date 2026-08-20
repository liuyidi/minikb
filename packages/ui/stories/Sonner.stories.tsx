import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@minikb/ui/components/ui/button";
import { toast } from "@minikb/ui/components/ui/sonner";

const meta = {
  title: "Components/反馈/Sonner 消息提示",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Success: Story = {
  render: () => (
    <Button type="button" onClick={() => toast.success("知识库已保存")}>
      显示成功提示
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button type="button" variant="danger" onClick={() => toast.error("同步失败，请稍后重试")}>
      显示错误提示
    </Button>
  ),
};
