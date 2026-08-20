import type { Meta, StoryObj } from "@storybook/react-vite";
import { Empty } from "@minikb/ui/components/ui/empty";

const meta = {
  title: "Components/数据展示/Empty 空状态",
  component: Empty,
  tags: ["autodocs"],
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: "暂无知识库，点击右上角新建。" },
  render: (args) => <Empty {...args} className="w-96" />,
};
