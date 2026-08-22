// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  filterDocuments,
  getDocumentPath,
  getFileName,
  listDirectoryEntries,
} from "./document-tree";

describe("document-tree", () => {
  it("prefers meta.path over title", () => {
    expect(
      getDocumentPath({ id: "1", title: "ignored.txt", meta: { path: "src/lib/util.ts" } }),
    ).toBe("src/lib/util.ts");
  });

  it("uses title when it contains slashes", () => {
    expect(getDocumentPath({ id: "1", title: "docs/guide.md" })).toBe("docs/guide.md");
  });

  it("lists folders and files at current directory", () => {
    const docs = [
      { id: "a", title: "lark/readme.md" },
      { id: "b", title: "lark/nested/doc.md" },
      { id: "c", title: "notes.txt" },
    ];

    expect(listDirectoryEntries(docs, [])).toEqual([
      { kind: "folder", name: "lark" },
      { kind: "file", doc: { id: "c", title: "notes.txt" } },
    ]);

    expect(listDirectoryEntries(docs, ["lark"])).toEqual([
      { kind: "folder", name: "nested" },
      { kind: "file", doc: { id: "a", title: "lark/readme.md" } },
    ]);
  });

  it("filters by name or id", () => {
    const docs = [
      { id: "abc-123", title: "alpha.md" },
      { id: "def-456", title: "beta.md" },
    ];

    expect(filterDocuments(docs, "name", "beta")).toHaveLength(1);
    expect(filterDocuments(docs, "id", "abc")).toHaveLength(1);
    expect(getFileName("src/foo/bar.ts")).toBe("bar.ts");
  });
});
