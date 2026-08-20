import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoIcon, Trash2Icon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@minikb/ui/components/ui/tooltip";

const meta = {
  title: "Components/浮层/Tooltip 提示",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="说明" />}>
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent>检索模式说明</TooltipContent>
    </Tooltip>
  ),
};

export const DestructiveAction: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="删除" />}>
        <Trash2Icon />
      </TooltipTrigger>
      <TooltipContent side="bottom">删除文档（不可恢复）</TooltipContent>
    </Tooltip>
  ),
};
