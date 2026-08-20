import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterIcon } from "lucide-react";
import { Button } from "@minikb/ui/components/ui/button";
import { Label } from "@minikb/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";

const statusItems = [
  { value: "all", label: "全部" },
  { value: "ready", label: "就绪" },
  { value: "syncing", label: "同步中" },
  { value: "failed", label: "失败" },
];

const meta = {
  title: "Components/浮层/Popover 弹出层",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const FilterPanel: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <FilterIcon />
        筛选
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>筛选文档</PopoverTitle>
          <PopoverDescription>按状态过滤列表。</PopoverDescription>
        </PopoverHeader>
        <div className="space-y-2">
          <Label htmlFor="status-filter">状态</Label>
          <Select items={statusItems} defaultValue="all">
            <SelectTrigger id="status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
