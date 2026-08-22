import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ChatSender } from "@minikb/chat/components/chat-sender";
import type { ChatAttachment } from "@minikb/chat/types/attachment";

function useAttachmentDemo() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([
    {
      id: "seed-1",
      name: "spec.md",
      extension: "md",
      size: 12_288,
      status: "success",
    },
  ]);

  const addFiles = (files: FileList) => {
    const next = Array.from(files).map((file, index) => ({
      id: `${file.name}-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      mimeType: file.type || undefined,
      status: "uploading" as const,
      progress: 35,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((current) => [...current, ...next]);
  };

  const remove = (item: ChatAttachment) => {
    setAttachments((current) => current.filter((entry) => entry.id !== item.id));
  };

  return { attachments, addFiles, remove };
}

const meta = {
  title: "Chat/ChatSender 对话输入",
  component: ChatSender,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: "Ask anything…",
    uploadProps: {
      accept: "image/*,.pdf,.md,.txt",
      multiple: true,
    },
  },
} satisfies Meta<typeof ChatSender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    const demo = useAttachmentDemo();
    return (
      <ChatSender
        {...args}
        value={value}
        onChange={setValue}
        attachmentsProps={{
          items: demo.attachments,
          overflow: "scrollX",
          removable: true,
          onRemove: demo.remove,
        }}
        onFileSelect={demo.addFiles}
        onFileRemove={demo.remove}
        onSend={() => setValue("")}
      />
    );
  },
};

export const Loading: Story = {
  args: {
    value: "Drafting a response about deployment…",
    loading: true,
  },
};

export const WithHeaderSlot: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    return (
      <ChatSender
        {...args}
        value={value}
        onChange={setValue}
        slots={{
          header: (
            <div className="rounded-[var(--radius)] border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Model: Mini Agent · Workspace: docs
            </div>
          ),
          footerPrefix: <span className="text-xs text-muted-foreground">Shift+Enter for newline</span>,
        }}
        onSend={() => setValue("")}
      />
    );
  },
};
