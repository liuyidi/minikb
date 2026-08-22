"use client";

import * as React from "react";
import { ArrowUp, Loader2, Paperclip, Square } from "lucide-react";

import { Button } from "@minikb/ui/components/ui/button";
import { Textarea } from "@minikb/ui/components/ui/textarea";
import { cn } from "@minikb/ui/lib/utils";
import { Attachments, type AttachmentsProps } from "@minikb/chat/components/attachments";
import type { ChatAttachment } from "@minikb/chat/types/attachment";

export type ChatSenderAction = "attachment" | "send";

export interface ChatSenderUploadProps {
  accept?: string;
  multiple?: boolean;
}

export interface ChatSenderLabels {
  placeholder?: string;
  attach?: string;
  send?: string;
  stop?: string;
}

export interface ChatSenderSlots {
  header?: React.ReactNode;
  innerHeader?: React.ReactNode;
  inputPrefix?: React.ReactNode;
  footerPrefix?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface ChatSenderProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autosize?: { minRows?: number; maxRows?: number };
  actions?: ChatSenderAction[] | false;
  attachmentsProps?: Omit<AttachmentsProps, "items"> & { items?: ChatAttachment[] };
  uploadProps?: ChatSenderUploadProps;
  labels?: ChatSenderLabels;
  slots?: ChatSenderSlots;
  className?: string;
  textareaClassName?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onStop?: () => void;
  onFileSelect?: (files: FileList) => void;
  onFileRemove?: (item: ChatAttachment) => void;
}

function ChatSender({
  value,
  defaultValue = "",
  placeholder,
  disabled = false,
  loading = false,
  autosize = { minRows: 2, maxRows: 8 },
  actions = ["attachment", "send"],
  attachmentsProps,
  uploadProps,
  labels,
  slots,
  className,
  textareaClassName,
  onChange,
  onSend,
  onStop,
  onFileSelect,
  onFileRemove,
}: ChatSenderProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const resolvedValue = isControlled ? value : internalValue;
  const attachmentItems = attachmentsProps?.items ?? [];
  const showAttachmentAction = actions !== false && actions.includes("attachment");
  const showSendAction = actions !== false && actions.includes("send");
  const resolvedPlaceholder = placeholder ?? labels?.placeholder ?? "Message";

  const setValue = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  const handleSend = () => {
    if (disabled || loading) return;
    const trimmed = resolvedValue.trim();
    if (!trimmed && attachmentItems.length === 0) return;
    onSend?.(resolvedValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (loading) return;
    handleSend();
  };

  const defaultActions = (
    <>
      {showAttachmentAction ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={uploadProps?.accept}
            multiple={uploadProps?.multiple ?? true}
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length > 0) onFileSelect?.(files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={labels?.attach ?? "Attach files"}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>
        </>
      ) : null}
      {showSendAction ? (
        loading ? (
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label={labels?.stop ?? "Stop"}
            onClick={() => onStop?.()}
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="icon"
            disabled={disabled || (!resolvedValue.trim() && attachmentItems.length === 0)}
            aria-label={labels?.send ?? "Send"}
            onClick={handleSend}
          >
            <ArrowUp className="size-4" />
          </Button>
        )
      ) : null}
    </>
  );

  return (
    <div
      data-slot="chat-sender"
      className={cn(
        "flex w-full flex-col gap-2 rounded-[var(--radius-lg)] border border-chat-composer-border bg-chat-composer p-3 shadow-[0_1px_0_rgba(8,8,8,0.03)]",
        disabled && "opacity-60",
        className,
      )}
    >
      {slots?.header}
      {attachmentItems.length > 0 ? (
        <Attachments
          {...attachmentsProps}
          items={attachmentItems}
          overflow={attachmentsProps?.overflow ?? "scrollX"}
          compact
          onRemove={(item) => {
            attachmentsProps?.onRemove?.(item);
            onFileRemove?.(item);
          }}
        />
      ) : null}
      {slots?.innerHeader}
      <div className="flex items-end gap-2">
        {slots?.inputPrefix}
        <Textarea
          value={resolvedValue}
          disabled={disabled}
          placeholder={resolvedPlaceholder}
          rows={autosize.minRows ?? 2}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "min-h-[calc(var(--mini-control-height-compact)*1.1)] resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0",
            textareaClassName,
          )}
          style={{
            maxHeight: `${(autosize.maxRows ?? 8) * 1.5}rem`,
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">{slots?.footerPrefix}</div>
        <div className="flex shrink-0 items-center gap-1">
          {slots?.actions ?? defaultActions}
          {loading && !showSendAction ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { ChatSender };
