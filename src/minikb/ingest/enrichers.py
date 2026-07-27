"""Text enrichers - add context to chunks before embedding.

Enrichers modify chunk text to improve retrieval quality by adding
contextual information like document title, heading path, etc.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from minikb.ingest.chunkers import Chunk


class Enricher(ABC):
    """Base class for chunk enrichers."""

    @abstractmethod
    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        """Enrich chunks with additional context.

        Args:
            chunks: List of chunks to enrich (modified in place)
            context: Document-level context (title, metadata, etc.)

        Returns:
            The same list of chunks (modified in place)
        """
        pass


class HeadingPathEnricher(Enricher):
    """Add heading path prefix to chunk text.

    Prepends the document structure path to each chunk, e.g.:
    "[Doc Title] > Chapter 1 > Section 2"

    This helps retrieval by giving each chunk contextual location info.
    Inspired by Anthropic's Contextual Retrieval approach.
    """

    def __init__(self, separator: str = " > ", prefix: str = ""):
        self.separator = separator
        self.prefix = prefix

    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        doc_title = context.get("doc_title", "")
        base_parts: list[str] = []

        if self.prefix:
            base_parts.append(self.prefix)
        if doc_title:
            base_parts.append(doc_title)

        for chunk in chunks:
            heading_path = chunk.meta.get("heading_path", [])
            if isinstance(heading_path, list) and heading_path:
                full_path = base_parts + list(heading_path)
                path_str = self.separator.join(full_path)
                chunk.text = f"[Context: {path_str}]\n\n{chunk.text}"
                chunk.meta["enriched_heading_path"] = path_str
            elif doc_title:
                chunk.text = f"[Context: {doc_title}]\n\n{chunk.text}"

            # Recompute hash after modification
            chunk.compute_hash()

        return chunks


class DocumentSummaryEnricher(Enricher):
    """Add a document summary/description prefix to each chunk.

    Useful when documents have a description or abstract that provides
    overall context.
    """

    def __init__(self, max_summary_chars: int = 200):
        self.max_summary_chars = max_summary_chars

    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        summary = context.get("description", "") or context.get("summary", "")
        if not summary:
            return chunks

        # Truncate if needed
        if len(summary) > self.max_summary_chars:
            summary = summary[:self.max_summary_chars].rsplit(" ", 1)[0] + "..."

        for chunk in chunks:
            chunk.text = f"[Document: {summary}]\n\n{chunk.text}"
            chunk.compute_hash()

        return chunks


class MetadataPrefixEnricher(Enricher):
    """Add selected metadata fields as prefix to chunk text."""

    def __init__(self, fields: list[str] | None = None):
        self.fields = fields or ["source", "author", "date"]

    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        meta_parts: list[str] = []
        for field_name in self.fields:
            value = context.get(field_name)
            if value:
                meta_parts.append(f"{field_name}: {value}")

        if not meta_parts:
            return chunks

        prefix = " | ".join(meta_parts)
        for chunk in chunks:
            chunk.text = f"[{prefix}]\n\n{chunk.text}"
            chunk.compute_hash()

        return chunks


class TableToMarkdownEnricher(Enricher):
    """Convert table data in meta to markdown format and prepend to chunk."""

    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        for chunk in chunks:
            tables = chunk.meta.get("tables", [])
            if not tables:
                continue

            md_tables: list[str] = []
            for table in tables:
                if not table or not isinstance(table, list):
                    continue
                # Convert to markdown
                header = table[0] if table else []
                md_lines = ["| " + " | ".join(str(c) for c in header) + " |"]
                md_lines.append("| " + " | ".join("---" for _ in header) + " |")
                for row in table[1:]:
                    md_lines.append("| " + " | ".join(str(c) for c in row) + " |")
                md_tables.append("\n".join(md_lines))

            if md_tables:
                chunk.meta["tables_markdown"] = md_tables

        return chunks


# ─── Pipeline ────────────────────────────────────────────────────────────────


@dataclass
class EnricherConfig:
    """Configuration for the enricher pipeline."""
    heading_path: bool = True
    document_summary: bool = False
    metadata_prefix: bool = False
    metadata_fields: list[str] = field(default_factory=lambda: ["source", "author", "date"])
    table_to_markdown: bool = True


class EnricherPipeline:
    """Chain of enrichers applied in order."""

    def __init__(self, config: EnricherConfig | None = None):
        self.config = config or EnricherConfig()
        self.enrichers: list[Enricher] = []

        if self.config.heading_path:
            self.enrichers.append(HeadingPathEnricher())
        if self.config.document_summary:
            self.enrichers.append(DocumentSummaryEnricher())
        if self.config.metadata_prefix:
            self.enrichers.append(MetadataPrefixEnricher(fields=self.config.metadata_fields))
        if self.config.table_to_markdown:
            self.enrichers.append(TableToMarkdownEnricher())

    def enrich(self, chunks: list[Chunk], context: dict[str, Any]) -> list[Chunk]:
        """Apply all enrichers in order."""
        for enricher in self.enrichers:
            chunks = enricher.enrich(chunks, context)
        return chunks


def enrich_chunks(
    chunks: list[Chunk],
    context: dict[str, Any],
    config: EnricherConfig | None = None,
) -> list[Chunk]:
    """Convenience function to enrich chunks."""
    pipeline = EnricherPipeline(config)
    return pipeline.enrich(chunks, context)
