import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Attachments } from "@minikb/chat/components/attachments";
import type { ChatAttachment } from "@minikb/chat/types/attachment";

const sampleItems: ChatAttachment[] = [
  {
    id: "1",
    name: "architecture.png",
    mimeType: "image/png",
    size: 245_760,
    status: "success",
    url: "https://picsum.photos/seed/mini-chat/320/240",
  },
  {
    id: "2",
    name: "brief.pdf",
    extension: "pdf",
    size: 1_048_576,
    status: "success",
  },
  {
    id: "3",
    name: "dataset.csv",
    extension: "csv",
    size: 4_194_304,
    status: "uploading",
    progress: 62,
  },
  {
    id: "4",
    name: "notes.txt",
    extension: "txt",
    size: 2048,
    status: "error",
    errorMessage: "Network error",
  },
];

const meta = {
  title: "Chat/Attachments 附件列表",
  component: Attachments,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    items: sampleItems,
    removable: true,
    overflow: "scrollX",
    compact: true,
  },
  argTypes: {
    overflow: {
      control: "select",
      options: ["wrap", "scrollX", "scrollY"],
    },
  },
} satisfies Meta<typeof Attachments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollX: Story = {};

export const Wrap: Story = {
  args: { overflow: "wrap" },
};

export const ScrollY: Story = {
  args: { overflow: "scrollY" },
};

export const Interactive: Story = {
  render: (args) => {
    const [items, setItems] = useState(args.items);
    return (
      <Attachments
        {...args}
        items={items}
        onRemove={(item) => setItems((current) => current.filter((entry) => entry.id !== item.id))}
      />
    );
  },
};
