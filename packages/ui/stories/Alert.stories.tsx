import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "@minikb/ui/components/ui/alert";

const meta = {
  title: "Components/反馈/Alert 提示",
  component: Alert,
  tags: ["autodocs"],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-96">
      <AlertTitle>索引进行中</AlertTitle>
      <AlertDescription>文档向量化完成后会自动刷新列表。</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-96">
      <AlertTitle>同步失败</AlertTitle>
      <AlertDescription>请检查 OpenAI API Key 或网络连接后重试。</AlertDescription>
    </Alert>
  ),
};
