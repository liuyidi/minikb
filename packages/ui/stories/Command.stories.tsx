import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@minikb/ui/components/ui/command";

const meta = {
  title: "Components/浮层/Command 命令面板",
  component: Command,
  tags: ["autodocs"],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="w-96 border border-border shadow-sm">
      <CommandInput placeholder="搜索知识库…" />
      <CommandList>
        <CommandEmpty>无结果</CommandEmpty>
        <CommandGroup heading="知识库">
          <CommandItem>产品文档</CommandItem>
          <CommandItem>内部 Wiki</CommandItem>
          <CommandItem>客服 FAQ</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
