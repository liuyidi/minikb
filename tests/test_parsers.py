"""Tests for document parsers."""
from __future__ import annotations

import json

import pytest

from minikb.ingest.parsers import (
    CSVParser,
    CodeParser,
    HTMLParser,
    MarkdownParser,
    NotebookParser,
    TextParser,
    get_parser,
    parse_document,
    supported_extensions,
)


class TestTextParser:
    def test_parse_utf8(self) -> None:
        parser = TextParser()
        result = parser.parse(b"Hello, world!", "text/plain", "test.txt")
        assert result.text == "Hello, world!"
        assert result.meta["encoding"] == "utf-8"

    def test_parse_latin1_fallback(self) -> None:
        parser = TextParser()
        content = "Héllo".encode("latin-1")
        result = parser.parse(content, "text/plain", "test.txt")
        assert "H" in result.text

    def test_can_parse(self) -> None:
        parser = TextParser()
        assert parser.can_parse("text/plain", "test.txt")
        assert parser.can_parse("text/plain", "test.log")
        assert not parser.can_parse("application/pdf", "test.pdf")


class TestMarkdownParser:
    def test_parse_headings(self) -> None:
        parser = MarkdownParser()
        content = b"# Title\n\nSome text.\n\n## Section 1\n\nMore text.\n\n### Subsection\n\nDeep text."
        result = parser.parse(content, "text/markdown", "test.md")
        assert "# Title" in result.text
        assert len(result.sections) == 3
        assert result.sections[0]["heading"] == "Title"
        assert result.sections[1]["path"] == ["Title", "Section 1"]
        assert result.sections[2]["path"] == ["Title", "Section 1", "Subsection"]

    def test_can_parse(self) -> None:
        parser = MarkdownParser()
        assert parser.can_parse("text/markdown", "test.md")
        assert parser.can_parse("text/plain", "test.markdown")
        assert not parser.can_parse("text/plain", "test.txt")


class TestHTMLParser:
    def test_strip_tags(self) -> None:
        parser = HTMLParser()
        content = b"<html><body><h1>Title</h1><p>Some <b>bold</b> text.</p></body></html>"
        result = parser.parse(content, "text/html", "test.html")
        assert "Title" in result.text
        assert "bold" in result.text
        assert "<" not in result.text

    def test_extract_title(self) -> None:
        parser = HTMLParser()
        content = b"<html><head><title>My Page</title></head><body>Hello</body></html>"
        result = parser.parse(content, "text/html", "test.html")
        assert result.meta.get("title") == "My Page"

    def test_remove_scripts(self) -> None:
        parser = HTMLParser()
        content = b"<p>Text</p><script>alert('xss')</script><p>More</p>"
        result = parser.parse(content, "text/html", "test.html")
        assert "alert" not in result.text
        assert "Text" in result.text


class TestCSVParser:
    def test_parse_csv(self) -> None:
        parser = CSVParser()
        content = b"Name,Age,City\nAlice,30,NYC\nBob,25,SF"
        result = parser.parse(content, "text/csv", "test.csv")
        assert "| Name | Age | City |" in result.text
        assert "| Alice | 30 | NYC |" in result.text
        assert result.meta["rows"] == 3
        assert result.meta["columns"] == 3
        assert len(result.tables) == 1

    def test_empty_csv(self) -> None:
        parser = CSVParser()
        result = parser.parse(b"", "text/csv", "empty.csv")
        assert result.text == ""


class TestNotebookParser:
    def test_parse_notebook(self) -> None:
        notebook = {
            "cells": [
                {
                    "cell_type": "markdown",
                    "source": ["# Title\n", "Some text."],
                },
                {
                    "cell_type": "code",
                    "source": ["print('hello')"],
                    "outputs": [
                        {
                            "output_type": "stream",
                            "text": ["hello\n"],
                        }
                    ],
                },
            ],
            "metadata": {},
            "nbformat": 4,
            "nbformat_minor": 5,
        }
        content = json.dumps(notebook).encode("utf-8")
        parser = NotebookParser()
        result = parser.parse(content, "application/x-ipynb+json", "test.ipynb")
        assert "# Title" in result.text
        assert "```python" in result.text
        assert "print('hello')" in result.text
        assert "hello" in result.text  # Output included
        assert result.meta["cells"] == 2


class TestCodeParser:
    def test_parse_python(self) -> None:
        parser = CodeParser()
        content = b"def hello():\n    return 'world'\n\nclass Foo:\n    pass"
        result = parser.parse(content, "text/x-python", "test.py")
        assert "```python" in result.text
        assert "def hello" in result.text
        assert result.meta["language"] == "python"
        assert result.meta["lines"] == 5

    def test_parse_javascript(self) -> None:
        parser = CodeParser()
        content = b"function hello() {\n  return 'world';\n}\n"
        result = parser.parse(content, "text/javascript", "test.js")
        assert "```javascript" in result.text
        assert result.meta["language"] == "javascript"

    def test_extract_structure(self) -> None:
        parser = CodeParser()
        content = b"class Foo:\n    def bar(self):\n        pass\n\ndef baz():\n    pass"
        result = parser.parse(content, "text/x-python", "test.py")
        assert len(result.sections) >= 2
        section_names = [s["name"] for s in result.sections]
        assert "Foo" in section_names
        assert "baz" in section_names

    def test_can_parse_many_extensions(self) -> None:
        parser = CodeParser()
        for ext in [".py", ".js", ".ts", ".java", ".go", ".rs", ".rb", ".c", ".cpp"]:
            assert parser.can_parse("", f"test{ext}")


class TestParserRegistry:
    def test_get_parser_pdf(self) -> None:
        parser = get_parser("application/pdf", "test.pdf")
        assert parser is not None

    def test_get_parser_markdown(self) -> None:
        parser = get_parser("text/markdown", "test.md")
        assert isinstance(parser, MarkdownParser)

    def test_get_parser_unknown(self) -> None:
        parser = get_parser("application/octet-stream", "test.xyz")
        # Unknown extension falls through to TextParser or None
        # TextParser only handles specific extensions, so .xyz returns None
        assert parser is None  # Falls through all parsers

    def test_supported_extensions(self) -> None:
        exts = supported_extensions()
        assert ".py" in exts
        assert len(exts) > 30

    def test_parse_document_text(self) -> None:
        result = parse_document(b"Hello world", "text/plain", "test.txt")
        assert result.text == "Hello world"
