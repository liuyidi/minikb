// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  attachmentCardType,
  attachmentExtensionLabel,
} from "./attachment-meta";
import type { ChatAttachment } from "../types/attachment";

describe("attachmentCardType", () => {
  it("detects images by mime or extension", () => {
    expect(attachmentCardType({ id: "1", name: "a.png", mimeType: "image/png" })).toBe("image");
    expect(attachmentCardType({ id: "2", name: "photo.JPG" })).toBe("image");
    expect(attachmentCardType({ id: "3", name: "brief.pdf" })).toBe("file");
  });
});

describe("attachmentExtensionLabel", () => {
  it("prefers explicit extension", () => {
    const item: ChatAttachment = { id: "1", name: "notes", extension: "md" };
    expect(attachmentExtensionLabel(item)).toBe("MD");
  });
});
