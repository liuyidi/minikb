import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ChatBubble } from "@minikb/chat/components/chat-bubble";
import type { ChatAttachment } from "@minikb/chat/types/attachment";

const attachments: ChatAttachment[] = [
  {
    id: "img-1",
    name: "screenshot.png",
    mimeType: "image/png",
    url: "https://picsum.photos/seed/mini-bubble/480/320",
    status: "success",
  },
];

const meta = {
  title: "Chat/ChatBubble 消息气泡",
  component: ChatBubble,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = {
  args: {
    role: "user",
    content: "Summarize this screenshot and list follow-up tasks.",
    attachments,
  },
};

export const Assistant: Story = {
  args: {
    role: "assistant",
    content: "The screenshot shows a quiet analytics panel with three KPI cards.\n\n**Next steps**\n- Add export\n- Wire alerts",
  },
};

export const AssistantStreaming: Story = {
  args: {
    role: "assistant",
    content: "Working through the document",
    streaming: true,
  },
};

export const Conversation: Story = {
  render: () => (
    <>
      <ChatBubble role="user" content="What changed in the release notes?" />
      <ChatBubble
        role="assistant"
        content="Two user-facing updates landed:\n\n1. Attachment strip in the composer\n2. Markdown rendering in bubbles"
        streaming={false}
      />
    </>
  ),
};

export const WithRemovableAttachments: Story = {
  render: () => {
    const [items, setItems] = useState(attachments);
    return (
      <ChatBubble
        role="user"
        content="Please review these files."
        attachments={items}
        onAttachmentRemove={(item) => setItems((current) => current.filter((entry) => entry.id !== item.id))}
      />
    );
  },
};
