"""Text chunkers - split documents into smaller chunks."""
from __future__ import annotations

import hashlib
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Chunk:
    """A chunk of text."""
    text: str
    seq: int
    tokens: int | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    content_hash: str | None = None

    def compute_hash(self) -> str:
        """Compute content hash for deduplication."""
        self.content_hash = hashlib.sha256(self.text.encode()).hexdigest()[:32]
        return self.content_hash


class Chunker(ABC):
    """Base class for text chunkers."""

    @abstractmethod
    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        """Split text into chunks."""
        pass


class RecursiveChunker(Chunker):
    """Recursive text chunker with configurable separators.

    Tries to split on larger separators first (paragraphs, sentences),
    then falls back to smaller ones (words, characters).
    """

    DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]

    def __init__(
        self,
        max_tokens: int = 500,
        overlap: int = 50,
        separators: list[str] | None = None,
    ):
        self.max_tokens = max_tokens
        self.overlap = overlap
        self.separators = separators or self.DEFAULT_SEPARATORS

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough: 4 chars per token for English)."""
        return len(text) // 4

    def _split_text(self, text: str, separator: str) -> list[str]:
        """Split text by separator."""
        if separator == "":
            return list(text)
        return text.split(separator)

    def _merge_splits(self, splits: list[str], separator: str) -> list[str]:
        """Merge splits into chunks that fit within max_tokens."""
        chunks = []
        current_chunk: list[str] = []
        current_length = 0

        for split in splits:
            split_length = len(split)

            # If single split is too large, split it further recursively
            if split_length > self.max_tokens * 4:
                # Try next separator
                idx = self.separators.index(separator) if separator in self.separators else 0
                if idx + 1 < len(self.separators):
                    sub_chunks = self._recursive_chunk(
                        split,
                        self.separators[idx + 1:],
                    )
                    chunks.extend(sub_chunks)
                    continue

            # Check if adding this split would exceed max size
            new_length = current_length + split_length + (len(separator) if current_chunk else 0)

            if new_length > self.max_tokens * 4 and current_chunk:
                # Save current chunk and start new one
                chunks.append(separator.join(current_chunk))
                # Keep overlap
                overlap_text = separator.join(current_chunk)
                overlap_chars = self.overlap * 4
                if len(overlap_text) > overlap_chars:
                    current_chunk = [overlap_text[-overlap_chars:]]
                    current_length = overlap_chars
                else:
                    current_chunk = []
                    current_length = 0

            current_chunk.append(split)
            current_length = new_length

        # Don't forget the last chunk
        if current_chunk:
            chunks.append(separator.join(current_chunk))

        return chunks

    def _recursive_chunk(
        self,
        text: str,
        separators: list[str],
    ) -> list[str]:
        """Recursively chunk text with decreasing separators."""
        if not separators:
            # Last resort: split by character
            return [text[i:i + self.max_tokens * 4] for i in range(0, len(text), self.max_tokens * 4 - self.overlap * 4)]

        separator = separators[0]
        rest_separators = separators[1:]

        # Split by current separator
        splits = self._split_text(text, separator)

        # If we only got one piece, try next separator
        if len(splits) <= 1 and rest_separators:
            return self._recursive_chunk(text, rest_separators)

        # Merge splits into appropriate-sized chunks
        return self._merge_splits(splits, separator)

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        """Split text into chunks."""
        if not text.strip():
            return []

        # Get raw text chunks
        raw_chunks = self._recursive_chunk(text, self.separators)

        # Convert to Chunk objects
        chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            chunk_text = chunk_text.strip()
            if not chunk_text:
                continue

            chunk = Chunk(
                text=chunk_text,
                seq=i,
                tokens=self._estimate_tokens(chunk_text),
                meta=dict(meta or {}),
            )
            chunk.compute_hash()
            chunks.append(chunk)

        return chunks


class HeadingChunker(Chunker):
    """Chunk by headings in structured documents."""

    def __init__(self, max_tokens: int = 1000):
        self.max_tokens = max_tokens
        self.fallback_chunker = RecursiveChunker(max_tokens=max_tokens)

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        """Split text by headings."""
        if not text.strip():
            return []

        # Find all headings
        heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
        matches = list(heading_pattern.finditer(text))

        if not matches:
            # No headings, fall back to recursive
            return self.fallback_chunker.chunk(text, meta)

        chunks = []
        current_heading_path: list[str] = []
        current_text_parts: list[str] = []
        seq = 0

        for i, match in enumerate(matches):
            # Save previous section
            if current_text_parts:
                section_text = "\n".join(current_text_parts).strip()
                if section_text:
                    # If section is too large, split it
                    if len(section_text) > self.max_tokens * 4:
                        sub_chunks = self.fallback_chunker.chunk(
                            section_text,
                            {**(meta or {}), "heading_path": list(current_heading_path)},
                        )
                        for sub in sub_chunks:
                            sub.seq = seq
                            chunks.append(sub)
                            seq += 1
                    else:
                        chunks.append(Chunk(
                            text=section_text,
                            seq=seq,
                            tokens=len(section_text) // 4,
                            meta={
                                **(meta or {}),
                                "heading_path": list(current_heading_path),
                            },
                        ))
                        seq += 1
                        current_text_parts = []

            # Update heading path
            level = len(match.group(1))
            heading = match.group(2).strip()

            while len(current_heading_path) >= level:
                current_heading_path.pop()
            current_heading_path.append(heading)

        # Don't forget the last section
        if current_text_parts:
            section_text = "\n".join(current_text_parts).strip()
            if section_text:
                chunks.append(Chunk(
                    text=section_text,
                    seq=seq,
                    tokens=len(section_text) // 4,
                    meta={
                        **(meta or {}),
                        "heading_path": list(current_heading_path),
                    },
                ))

        # Compute hashes
        for chunk in chunks:
            chunk.compute_hash()

        return chunks


# Chunker registry
_CHUNKERS: dict[str, type[Chunker]] = {
    "recursive": RecursiveChunker,
    "heading": HeadingChunker,
}


def get_chunker(strategy: str = "recursive", **kwargs: Any) -> Chunker:
    """Get a chunker by strategy name."""
    cls = _CHUNKERS.get(strategy)
    if cls is None:
        raise ValueError(f"Unknown chunker strategy: {strategy}")
    return cls(**kwargs)
