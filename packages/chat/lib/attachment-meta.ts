import type { ChatAttachment } from "@minikb/chat/types/attachment";

export function attachmentPreviewUrl(item: ChatAttachment): string | undefined {
  return item.previewUrl ?? item.url;
}

export function attachmentCardType(item: ChatAttachment): "file" | "image" {
  if (item.mimeType?.startsWith("image/")) return "image";
  const ext = (item.extension ?? item.name.split(".").pop() ?? "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) {
    return "image";
  }
  return "file";
}

export function attachmentExtensionLabel(item: ChatAttachment): string {
  if (item.extension) return item.extension.toUpperCase();
  const ext = item.name.includes(".") ? item.name.split(".").pop() ?? "" : "";
  return ext ? ext.toUpperCase() : "FILE";
}
