import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@minikb/ui/components/ui/button";
import { FormGroup, PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Input } from "@minikb/ui/components/ui/input";

const meta = {
  title: "Components/布局/Page 页面",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const HeaderAndForm: Story = {
  render: () => (
    <PageShell>
      <PageHeader
        title="知识库设置"
        subtitle="管理名称、描述与可见性。"
        actions={<Button>保存</Button>}
      />
      <FormGroup label="名称">
        <Input defaultValue="产品文档" />
      </FormGroup>
      <FormGroup label="Slug">
        <Input defaultValue="product-docs" />
      </FormGroup>
    </PageShell>
  ),
};
