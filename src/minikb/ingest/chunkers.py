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


def _estimate_tokens(text: str) -> int:
    """Estimate token count (rough: 4 chars per token for English, ~2 for CJK)."""
    return len(text) // 4


def _finalize_chunks(raw_texts: list[str], base_meta: dict[str, Any]) -> list[Chunk]:
    """Convert raw text list to Chunk objects with hashes."""
    chunks: list[Chunk] = []
    seq = 0
    for text in raw_texts:
        text = text.strip()
        if not text:
            continue
        chunk = Chunk(
            text=text,
            seq=seq,
            tokens=_estimate_tokens(text),
            meta=dict(base_meta),
        )
        chunk.compute_hash()
        chunks.append(chunk)
        seq += 1
    return chunks


class Chunker(ABC):
    """Base class for text chunkers."""

    @abstractmethod
    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        """Split text into chunks."""
        pass


# ─── Recursive ───────────────────────────────────────────────────────────────


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

    def _split_text(self, text: str, separator: str) -> list[str]:
        if separator == "":
            return list(text)
        return text.split(separator)

    def _merge_splits(self, splits: list[str], separator: str) -> list[str]:
        chunks: list[str] = []
        current_chunk: list[str] = []
        current_length = 0
        max_chars = self.max_tokens * 4

        for split in splits:
            split_length = len(split)

            # If single split is too large, recurse with next separator
            if split_length > max_chars:
                idx = self.separators.index(separator) if separator in self.separators else 0
                if idx + 1 < len(self.separators):
                    sub_chunks = self._recursive_chunk(split, self.separators[idx + 1:])
                    chunks.extend(sub_chunks)
                    continue

            new_length = current_length + split_length + (len(separator) if current_chunk else 0)

            if new_length > max_chars and current_chunk:
                chunks.append(separator.join(current_chunk))
                # Keep overlap from end of previous chunk
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

        if current_chunk:
            chunks.append(separator.join(current_chunk))

        return chunks

    def _recursive_chunk(self, text: str, separators: list[str]) -> list[str]:
        if not separators:
            max_chars = self.max_tokens * 4
            step = max(1, max_chars - self.overlap * 4)
            return [text[i:i + max_chars] for i in range(0, len(text), step)]

        separator = separators[0]
        rest = separators[1:]
        splits = self._split_text(text, separator)

        if len(splits) <= 1 and rest:
            return self._recursive_chunk(text, rest)

        return self._merge_splits(splits, separator)

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []
        raw_chunks = self._recursive_chunk(text, self.separators)
        return _finalize_chunks(raw_chunks, meta or {})


# ─── Heading ─────────────────────────────────────────────────────────────────


class HeadingChunker(Chunker):
    """Chunk by headings in structured documents."""

    def __init__(self, max_tokens: int = 1000):
        self.max_tokens = max_tokens
        self.fallback = RecursiveChunker(max_tokens=max_tokens)

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        heading_re = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
        matches = list(heading_re.finditer(text))

        if not matches:
            return self.fallback.chunk(text, meta)

        chunks: list[Chunk] = []
        heading_path: list[str] = []
        seq = 0
        base_meta = dict(meta or {})

        # Split text into sections by heading positions
        sections: list[tuple[list[str], str, int]] = []  # (path, text, level)

        # Text before first heading
        preamble = text[:matches[0].start()].strip()

        for i, match in enumerate(matches):
            # Update heading path
            level = len(match.group(1))
            heading = match.group(2).strip()
            while len(heading_path) >= level:
                heading_path.pop()
            heading_path.append(heading)

            # Get text between this heading and the next
            start = match.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section_text = text[start:end].strip()

            if section_text:
                sections.append((list(heading_path), section_text, level))

        # Process sections
        for path, section_text, level in sections:
            if len(section_text) > self.max_tokens * 4:
                sub = self.fallback.chunk(section_text, {**base_meta, "heading_path": path})
                for s in sub:
                    s.seq = seq
                    chunks.append(s)
                    seq += 1
            else:
                chunks.append(Chunk(
                    text=section_text, seq=seq,
                    tokens=_estimate_tokens(section_text),
                    meta={**base_meta, "heading_path": path},
                ))
                seq += 1

        # If there was a preamble but no sections had content, add preamble
        if not chunks and preamble:
            chunks = self.fallback.chunk(preamble, base_meta)

        for c in chunks:
            c.compute_hash()
        return chunks


# ─── Semantic (sentence boundary) ───────────────────────────────────────────


class SemanticChunker(Chunker):
    """Chunk by sentence boundaries, grouping semantically related sentences.

    Uses simple heuristics: sentence-ending punctuation, then groups sentences
    that are close in embedding space (if available) or just by length.
    """

    # Sentence-ending patterns
    SENTENCE_ENDS = re.compile(r"(?<=[.!?。！？])\s+")

    def __init__(self, max_tokens: int = 500, min_sentences: int = 1, max_sentences: int = 15):
        self.max_tokens = max_tokens
        self.min_sentences = min_sentences
        self.max_sentences = max_sentences

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        sentences = self.SENTENCE_ENDS.split(text)
        return [s.strip() for s in sentences if s.strip()]

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        sentences = self._split_sentences(text)
        if not sentences:
            return []

        max_chars = self.max_tokens * 4
        chunks_raw: list[str] = []
        current: list[str] = []
        current_len = 0

        for sentence in sentences:
            sent_len = len(sentence)

            # If single sentence is too long, just add it as its own chunk
            if sent_len > max_chars:
                if current:
                    chunks_raw.append(" ".join(current))
                    current = []
                    current_len = 0
                chunks_raw.append(sentence)
                continue

            new_len = current_len + sent_len + 1

            # Check if we should start a new chunk
            if (
                current
                and (
                    new_len > max_chars
                    or len(current) >= self.max_sentences
                )
                and len(current) >= self.min_sentences
            ):
                chunks_raw.append(" ".join(current))
                current = []
                current_len = 0

            current.append(sentence)
            current_len += sent_len + 1

        if current:
            chunks_raw.append(" ".join(current))

        return _finalize_chunks(chunks_raw, meta or {})


# ─── Code-Aware ──────────────────────────────────────────────────────────────


class CodeAwareChunker(Chunker):
    """Chunk source code by logical units (functions, classes, modules).

    Tries to keep complete function/class definitions together.
    Falls back to sliding window for large blocks.
    """

    # Patterns that define a "unit" boundary
    UNIT_START = {
        "python": [
            re.compile(r"^(?:async\s+)?def\s+\w+", re.MULTILINE),
            re.compile(r"^class\s+\w+", re.MULTILINE),
        ],
        "javascript": [
            re.compile(r"^(?:async\s+)?function\s+\w+", re.MULTILINE),
            re.compile(r"^(?:export\s+)?(?:class|const|let|var)\s+\w+", re.MULTILINE),
            re.compile(r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?\([^)]*\)\s*=>", re.MULTILINE),
        ],
        "typescript": [
            re.compile(r"^(?:async\s+)?function\s+\w+", re.MULTILINE),
            re.compile(r"^(?:export\s+)?(?:class|interface|type|enum|const|let|var)\s+\w+", re.MULTILINE),
        ],
        "java": [
            re.compile(r"^(?:public|private|protected|static|\s)*\s*(?:class|interface|enum)\s+\w+", re.MULTILINE),
            re.compile(r"^(?:public|private|protected|static|\s)*\s*\w+\s+\w+\s*\(", re.MULTILINE),
        ],
        "go": [
            re.compile(r"^func\s+", re.MULTILINE),
            re.compile(r"^type\s+\w+\s+(?:struct|interface)", re.MULTILINE),
        ],
        "rust": [
            re.compile(r"^(?:pub\s+)?(?:async\s+)?fn\s+\w+", re.MULTILINE),
            re.compile(r"^(?:pub\s+)?(?:struct|enum|trait|impl)\s+\w*", re.MULTILINE),
        ],
    }

    def __init__(self, max_tokens: int = 500, language: str = "python"):
        self.max_tokens = max_tokens
        self.language = language
        self.fallback = RecursiveChunker(max_tokens=max_tokens)

    def _find_unit_boundaries(self, text: str) -> list[int]:
        """Find line indices where new units start."""
        patterns = self.UNIT_START.get(self.language, [])
        if not patterns:
            return []

        boundaries: list[int] = []
        lines = text.split("\n")
        for i, line in enumerate(lines):
            for pattern in patterns:
                if pattern.match(line):
                    boundaries.append(i)
                    break

        return sorted(set(boundaries))

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        boundaries = self._find_unit_boundaries(text)
        lines = text.split("\n")
        base_meta = dict(meta or {})
        base_meta["language"] = self.language

        if not boundaries:
            # No structure found, fall back to recursive with code awareness
            code_text = f"```{self.language}\n{text}\n```"
            raw = self.fallback.chunk(code_text, base_meta)
            return raw

        # Split by unit boundaries
        chunks_raw: list[str] = []
        max_chars = self.max_tokens * 4

        for i, start_line in enumerate(boundaries):
            end_line = boundaries[i + 1] if i + 1 < len(boundaries) else len(lines)
            unit_text = "\n".join(lines[start_line:end_line])

            if len(unit_text) > max_chars:
                # Large unit - split further with sliding window
                sub_chunks = self._split_large_unit(unit_text, max_chars)
                chunks_raw.extend(sub_chunks)
            else:
                chunks_raw.append(unit_text)

        # Add any preamble before first boundary
        if boundaries and boundaries[0] > 0:
            preamble = "\n".join(lines[:boundaries[0]]).strip()
            if preamble:
                chunks_raw.insert(0, preamble)

        # Wrap in code blocks
        wrapped = [f"```{self.language}\n{c.strip()}\n```" for c in chunks_raw if c.strip()]

        return _finalize_chunks(wrapped, base_meta)

    def _split_large_unit(self, text: str, max_chars: int) -> list[str]:
        """Split a large code unit into smaller pieces."""
        lines = text.split("\n")
        chunks: list[str] = []
        current: list[str] = []
        current_len = 0

        for line in lines:
            line_len = len(line) + 1
            if current_len + line_len > max_chars and current:
                chunks.append("\n".join(current))
                current = []
                current_len = 0
            current.append(line)
            current_len += line_len

        if current:
            chunks.append("\n".join(current))

        return chunks


# ─── Table-Aware ─────────────────────────────────────────────────────────────


class TableAwareChunker(Chunker):
    """Chunk with table awareness - keeps table rows together.

    For table-heavy documents, can chunk by:
    - per_row: each row is a chunk (with header context)
    - per_column: each column becomes a chunk
    - window: sliding window of N rows
    """

    def __init__(
        self,
        max_tokens: int = 500,
        mode: str = "window",
        window_size: int = 10,
        stride: int = 5,
    ):
        self.max_tokens = max_tokens
        self.mode = mode  # "per_row", "per_column", "window"
        self.window_size = window_size
        self.stride = stride
        self.fallback = RecursiveChunker(max_tokens=max_tokens)

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        base_meta = dict(meta or {})

        # Check if text contains markdown tables
        table_pattern = re.compile(r"^\|.+\|$", re.MULTILINE)
        lines = text.split("\n")
        table_blocks: list[list[str]] = []
        non_table_parts: list[str] = []
        current_table: list[str] = []
        in_table = False

        for line in lines:
            if table_pattern.match(line.strip()):
                if not in_table:
                    in_table = True
                    current_table = []
                current_table.append(line.strip())
            else:
                if in_table:
                    if current_table:
                        table_blocks.append(current_table)
                    current_table = []
                    in_table = False
                if line.strip():
                    non_table_parts.append(line)

        if in_table and current_table:
            table_blocks.append(current_table)

        if not table_blocks:
            # No tables found, fall back to recursive
            return self.fallback.chunk(text, meta)

        # Process text between tables
        text_chunks = self.fallback.chunk("\n".join(non_table_parts), meta) if non_table_parts else []

        # Process tables
        table_chunks: list[Chunk] = []
        seq = len(text_chunks)

        for table_lines in table_blocks:
            # Parse markdown table
            rows = []
            for line in table_lines:
                cells = [c.strip() for c in line.strip("|").split("|")]
                # Skip separator row
                if all(set(c) <= {"-", ":", " "} for c in cells):
                    continue
                rows.append(cells)

            if not rows:
                continue

            header = rows[0] if rows else []
            data_rows = rows[1:] if len(rows) > 1 else []

            if self.mode == "per_row":
                for row in data_rows:
                    row_text = self._row_to_text(header, row)
                    table_chunks.append(Chunk(
                        text=row_text, seq=seq,
                        tokens=_estimate_tokens(row_text),
                        meta={**base_meta, "source": "table"},
                    ))
                    seq += 1

            elif self.mode == "window":
                for i in range(0, len(data_rows), self.stride):
                    window_rows = data_rows[i:i + self.window_size]
                    table_md = self._rows_to_markdown(header, window_rows)
                    table_chunks.append(Chunk(
                        text=table_md, seq=seq,
                        tokens=_estimate_tokens(table_md),
                        meta={**base_meta, "source": "table", "row_start": i + 1},
                    ))
                    seq += 1

            else:  # per_column
                for col_idx in range(len(header)):
                    col_name = header[col_idx] if col_idx < len(header) else f"col_{col_idx}"
                    col_values = []
                    for row in data_rows:
                        if col_idx < len(row):
                            col_values.append(row[col_idx])
                    col_text = f"Column: {col_name}\n" + "\n".join(f"- {v}" for v in col_values)
                    table_chunks.append(Chunk(
                        text=col_text, seq=seq,
                        tokens=_estimate_tokens(col_text),
                        meta={**base_meta, "source": "table", "column": col_name},
                    ))
                    seq += 1

        # Re-number all chunks
        all_chunks = text_chunks + table_chunks
        for i, c in enumerate(all_chunks):
            c.seq = i
            c.compute_hash()

        return all_chunks

    def _row_to_text(self, header: list[str], row: list[str]) -> str:
        """Convert a single row to readable text."""
        parts = []
        for i, cell in enumerate(row):
            col_name = header[i] if i < len(header) else f"col_{i}"
            parts.append(f"{col_name}: {cell}")
        return " | ".join(parts)

    def _rows_to_markdown(self, header: list[str], rows: list[list[str]]) -> str:
        """Convert rows back to markdown table."""
        lines = ["| " + " | ".join(header) + " |"]
        lines.append("| " + " | ".join("---" for _ in header) + " |")
        for row in rows:
            padded = row + [""] * (len(header) - len(row))
            lines.append("| " + " | ".join(padded[:len(header)]) + " |")
        return "\n".join(lines)


# ─── Sliding Window ──────────────────────────────────────────────────────────


class SlidingWindowChunker(Chunker):
    """Simple sliding window chunker with fixed size and stride.

    Good for transcripts, meeting notes, and sequential text where
    context overlap is important.
    """

    def __init__(self, window_size: int = 500, stride: int = 250, unit: str = "tokens"):
        self.window_size = window_size
        self.stride = stride
        self.unit = unit  # "tokens" or "chars"

    def chunk(self, text: str, meta: dict[str, Any] | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        # Convert to character counts
        if self.unit == "tokens":
            window_chars = self.window_size * 4
            stride_chars = self.stride * 4
        else:
            window_chars = self.window_size
            stride_chars = self.stride

        chunks_raw: list[str] = []
        text_len = len(text)
        pos = 0

        while pos < text_len:
            end = min(pos + window_chars, text_len)
            chunk_text = text[pos:end].strip()
            if chunk_text:
                chunks_raw.append(chunk_text)

            if end >= text_len:
                break
            pos += stride_chars

        return _finalize_chunks(chunks_raw, meta or {})


# ─── Registry ────────────────────────────────────────────────────────────────

_CHUNKERS: dict[str, type[Chunker]] = {
    "recursive": RecursiveChunker,
    "heading": HeadingChunker,
    "semantic": SemanticChunker,
    "code_aware": CodeAwareChunker,
    "table_aware": TableAwareChunker,
    "sliding_window": SlidingWindowChunker,
}


def get_chunker(strategy: str = "recursive", **kwargs: Any) -> Chunker:
    """Get a chunker by strategy name."""
    cls = _CHUNKERS.get(strategy)
    if cls is None:
        raise ValueError(f"Unknown chunker strategy: {strategy}. Available: {list(_CHUNKERS.keys())}")
    return cls(**kwargs)


def list_strategies() -> list[str]:
    """List available chunker strategies."""
    return list(_CHUNKERS.keys())
