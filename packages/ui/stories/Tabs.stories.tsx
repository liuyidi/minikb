import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@minikb/ui/components/ui/tabs";

const meta = {
  title: "Components/布局/Tabs 标签页",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="docs" className="w-96">
      <TabsList>
        <TabsTrigger value="docs">文档</TabsTrigger>
        <TabsTrigger value="sources">来源</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
      </TabsList>
      <TabsContent value="docs" className="text-sm text-muted-foreground">
        文档列表与检索结果。
      </TabsContent>
      <TabsContent value="sources" className="text-sm text-muted-foreground">
        已连接的数据源与同步状态。
      </TabsContent>
      <TabsContent value="settings" className="text-sm text-muted-foreground">
        知识库名称、slug 与权限。
      </TabsContent>
    </Tabs>
  ),
};
