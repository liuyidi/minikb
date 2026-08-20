import type { Meta, StoryObj } from "@storybook/react-vite";
import { BreadcrumbItems } from "@minikb/ui/components/ui/breadcrumb";

const meta = {
  title: "Components/布局/Breadcrumb 面包屑",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const KbPath: Story = {
  render: () => (
    <BreadcrumbItems
      items={[
        { label: "知识库", href: "/kbs" },
        { label: "产品文档", href: "/kb/demo/documents" },
        { label: "设置" },
      ]}
    />
  ),
};
