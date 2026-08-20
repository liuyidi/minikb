import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EmojiPicker } from "@minikb/ui/components/common/emoji-picker";

const meta = {
  title: "Components/浮层/EmojiPicker 表情选择器",
  component: EmojiPicker,
  tags: ["autodocs"],
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [picked, setPicked] = useState<string | null>(null);
    return (
      <div className="space-y-3">
        <EmojiPicker
          className="rounded-[var(--radius-lg)] border border-border"
          onSelect={setPicked}
        />
        {picked ? <p className="text-sm text-muted-foreground">已选择：{picked}</p> : null}
      </div>
    );
  },
};
