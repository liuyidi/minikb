import type { Meta, StoryObj } from "@storybook/react-vite";
import { Markdown } from "@minikb/ui/markdown";

const sample = `# 检索说明

支持 **Markdown** 与 \`inline code\`。

- 上传 PDF / Markdown
- 自动分块与向量化
- 在 QA 页面试问

> 引用块用于补充说明。`;

const meta = {
  title: "Components/数据展示/Markdown 渲染",
  component: Markdown,
  tags: ["autodocs"],
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[480px] rounded-[var(--radius-lg)] border border-border p-5">
      <Markdown>{sample}</Markdown>
    </div>
  ),
};
