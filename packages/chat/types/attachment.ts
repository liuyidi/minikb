/** Upload lifecycle for composer attachments. Shared by web and future RN kits. */
export type ChatAttachmentStatus = "pending" | "uploading" | "success" | "error";

export type ChatAttachmentCardType = "file" | "image";

export type AttachmentsOverflow = "wrap" | "scrollX" | "scrollY";

export interface ChatAttachment {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  extension?: string;
  description?: string;
  url?: string;
  previewUrl?: string;
  status?: ChatAttachmentStatus;
  progress?: number;
  errorMessage?: string;
}
