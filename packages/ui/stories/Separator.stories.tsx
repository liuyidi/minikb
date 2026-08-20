import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "@minikb/ui/components/ui/separator";

const meta = {
  title: "Components/布局/Separator 分隔线",
  component: Separator,
  tags: ["autodocs"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-80 space-y-4 text-sm">
      <p>上方内容</p>
      <Separator />
      <p>下方内容</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-10 items-center gap-4 text-sm">
      <span>文档</span>
      <Separator orientation="vertical" className="h-6" />
      <span>来源</span>
      <Separator orientation="vertical" className="h-6" />
      <span>设置</span>
    </div>
  ),
};
