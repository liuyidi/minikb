"""Document parsers - extract text from various file formats."""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParsedContent:
    """Result of parsing a document."""
    text: str
    meta: dict[str, Any] = field(default_factory=dict)
    html: str | None = None
    sections: list[dict[str, Any]] = field(default_factory=list)


class Parser(ABC):
    """Base class for document parsers."""

    @abstractmethod
    def parse(self, content: bytes, mime_type: str, filename: str) -> ParsedContent:
        """Parse document content and extract text."""
        pass

    @abstractmethod
    def can_parse(self, mime_type: str, filename: str) -> bool:
        """Check if this parser can handle the given file."""
        pass


class TextParser(Parser):
    """Parser for plain text files."""

    SUPPORTED_MIMES = {"text/plain", "text/markdown", "text/csv", "text/html"}
    SUPPORTED_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".html", ".htm", ".rst"}

    def can_parse(self, mime_type: str, filename: str) -> bool:
        if mime_type in self.SUPPORTED_MIMES:
            return True
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        return ext in self.SUPPORTED_EXTENSIONS

    def parse(self, content: bytes, mime_type: str, filename: str) -> ParsedContent:
        # Try UTF-8 first, fall back to latin-1
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

        # Clean up whitespace
        text = text.strip()

        return ParsedContent(
            text=text,
            meta={"encoding": "utf-8"},
        )


class MarkdownParser(Parser):
    """Parser for Markdown files with heading structure extraction."""

    def can_parse(self, mime_type: str, filename: str) -> bool:
        if mime_type == "text/markdown":
            return True
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        return ext in {".md", ".markdown"}

    def parse(self, content: bytes, mime_type: str, filename: str) -> ParsedContent:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

        # Extract heading structure
        sections = []
        current_heading_path: list[str] = []

        for line in text.split("\n"):
            match = re.match(r"^(#{1,6})\s+(.+)$", line)
            if match:
                level = len(match.group(1))
                heading = match.group(2).strip()

                # Adjust heading path
                while len(current_heading_path) >= level:
                    current_heading_path.pop()
                current_heading_path.append(heading)

                sections.append({
                    "heading": heading,
                    "level": level,
                    "path": list(current_heading_path),
                })

        return ParsedContent(
            text=text.strip(),
            meta={"format": "markdown"},
            sections=sections,
        )


class PDFParser(Parser):
    """Parser for PDF files using PyPDF2 or pdfminer."""

    def can_parse(self, mime_type: str, filename: str) -> bool:
        if mime_type == "application/pdf":
            return True
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        return ext == ".pdf"

    def parse(self, content: bytes, mime_type: str, filename: str) -> ParsedContent:
        from io import BytesIO

        text_parts = []
        meta: dict[str, Any] = {"format": "pdf", "pages": 0}

        try:
            # Try PyPDF2 first
            from PyPDF2 import PdfReader
            reader = PdfReader(BytesIO(content))
            meta["pages"] = len(reader.pages)

            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(f"--- Page {i + 1} ---\n{page_text}")

        except ImportError:
            # Fall back to pdfminer
            try:
                from pdfminer.high_level import extract_text
                text = extract_text(BytesIO(content))
                text_parts.append(text)
                meta["parser"] = "pdfminer"
            except ImportError:
                raise RuntimeError(
                    "No PDF parser available. Install PyPDF2 or pdfminer.six"
                )

        return ParsedContent(
            text="\n\n".join(text_parts).strip(),
            meta=meta,
        )


# Parser registry
_PARSERS: list[Parser] = [
    PDFParser(),
    MarkdownParser(),
    TextParser(),
]


def get_parser(mime_type: str, filename: str) -> Parser | None:
    """Get the appropriate parser for a file."""
    for parser in _PARSERS:
        if parser.can_parse(mime_type, filename):
            return parser
    return None


def parse_document(content: bytes, mime_type: str, filename: str) -> ParsedContent:
    """Parse a document and extract text."""
    parser = get_parser(mime_type, filename)
    if parser is None:
        raise ValueError(f"No parser available for {mime_type} ({filename})")
    return parser.parse(content, mime_type, filename)
