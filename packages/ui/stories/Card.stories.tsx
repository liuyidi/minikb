import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@minikb/ui/components/ui/card";
import { Button } from "@minikb/ui/components/ui/button";

const meta = {
  title: "Components/布局/Card 卡片",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>知识库</CardTitle>
        <CardDescription>安静的面板，适合扫描式阅读。</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          浅色面板、细边框、紧凑文案；品牌色只用于焦点与状态。
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary">取消</Button>
        <Button>保存</Button>
      </CardFooter>
    </Card>
  ),
};
