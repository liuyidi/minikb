import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@minikb/ui/components/ui/dropdown-menu";

const meta = {
  title: "Components/浮层/DropdownMenu 下拉菜单",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const DocumentActions: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="更多" />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>文档操作</DropdownMenuLabel>
          <DropdownMenuItem>重新索引</DropdownMenuItem>
          <DropdownMenuItem>下载</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive">删除</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
