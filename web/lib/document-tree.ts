export type DocLike = {
  id: string;
  title: string;
  meta?: Record<string, unknown>;
};

export type DirectoryEntry =
  | { kind: "folder"; name: string }
  | { kind: "file"; doc: DocLike };

export function getDocumentPath(doc: DocLike): string {
  const metaPath = doc.meta?.path;
  if (typeof metaPath === "string" && metaPath.trim()) {
    return metaPath.replace(/\\/g, "/");
  }
  return doc.title.replace(/\\/g, "/");
}

export function getPathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function getFileName(path: string): string {
  const segments = getPathSegments(path);
  return segments[segments.length - 1] ?? path;
}

export function listDirectoryEntries(docs: DocLike[], currentDir: string[]): DirectoryEntry[] {
  const folders = new Set<string>();
  const files: DocLike[] = [];

  for (const doc of docs) {
    const segments = getPathSegments(getDocumentPath(doc));
    if (segments.length < currentDir.length) continue;

    const matches = currentDir.every((segment, index) => segments[index] === segment);
    if (!matches) continue;

    const rest = segments.slice(currentDir.length);
    if (rest.length === 0) continue;

    if (rest.length === 1) {
      files.push(doc);
    } else {
      folders.add(rest[0]);
    }
  }

  const folderEntries: DirectoryEntry[] = Array.from(folders)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ kind: "folder", name }));

  const fileEntries: DirectoryEntry[] = files
    .slice()
    .sort((a, b) => getFileName(getDocumentPath(a)).localeCompare(getFileName(getDocumentPath(b))))
    .map((doc) => ({ kind: "file", doc }));

  return [...folderEntries, ...fileEntries];
}

export function filterDocuments(
  docs: DocLike[],
  field: "name" | "id",
  query: string,
): DocLike[] {
  const q = query.trim().toLowerCase();
  if (!q) return docs;

  if (field === "id") {
    return docs.filter((doc) => doc.id.toLowerCase().includes(q));
  }

  return docs.filter((doc) => {
    const path = getDocumentPath(doc);
    const name = getFileName(path);
    return (
      name.toLowerCase().includes(q) ||
      path.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q)
    );
  });
}
