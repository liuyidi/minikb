"use client";

import * as React from "react";

import { Markdown } from "@minikb/ui/markdown";
import { cn } from "@minikb/ui/lib/utils";
import { Attachments } from "@minikb/chat/components/attachments";
import { StreamingIndicator } from "@minikb/chat/components/streaming-indicator";
import type { ChatAttachment } from "@minikb/chat/types/attachment";

export type ChatBubbleRole = "user" | "assistant";

export interface ChatBubbleProps {
  role: ChatBubbleRole;
  children?: React.ReactNode;
  content?: string;
  attachments?: ChatAttachment[];
  streaming?: boolean;
  className?: string;
  contentClassName?: string;
  onAttachmentRemove?: (item: ChatAttachment) => void;
}

function ChatBubble({
  role,
  children,
  content,
  attachments = [],
  streaming = false,
  className,
  contentClassName,
  onAttachmentRemove,
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <article
      data-slot="chat-bubble"
      data-role={role}
      className={cn(
        "flex w-full max-w-[min(100%,42rem)] flex-col gap-2",
        isUser ? "ml-auto items-end" : "mr-auto items-start",
        className,
      )}
    >
      <div
        className={cn(
          "w-full rounded-[var(--radius-lg)] border px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "border-border/60 bg-chat-bubble-user text-foreground"
            : "border-border/50 bg-chat-bubble-assistant text-foreground",
          contentClassName,
        )}
      >
        {children ?? (content ? <Markdown>{content}</Markdown> : null)}
        {streaming ? <StreamingIndicator className="mt-2" /> : null}
      </div>
      {attachments.length > 0 ? (
        <Attachments
          items={attachments}
          overflow="wrap"
          compact={isUser}
          removable={Boolean(onAttachmentRemove)}
          onRemove={onAttachmentRemove}
          className={cn(isUser && "justify-end")}
        />
      ) : null}
    </article>
  );
}

export { ChatBubble };
