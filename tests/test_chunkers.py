"""Tests for text chunkers."""
from __future__ import annotations

import pytest

from minikb.ingest.chunkers import (
    Chunk,
    CodeAwareChunker,
    HeadingChunker,
    RecursiveChunker,
    SemanticChunker,
    SlidingWindowChunker,
    TableAwareChunker,
    get_chunker,
    list_strategies,
)


class TestRecursiveChunker:
    def test_basic_chunking(self) -> None:
        text = "Hello world. " * 100
        chunker = RecursiveChunker(max_tokens=50, overlap=10)
        chunks = chunker.chunk(text)
        assert len(chunks) > 1
        for chunk in chunks:
            assert chunk.text.strip()
            assert chunk.seq >= 0
            assert chunk.tokens is not None
            assert chunk.content_hash is not None

    def test_empty_text(self) -> None:
        chunker = RecursiveChunker()
        assert chunker.chunk("") == []
        assert chunker.chunk("   ") == []

    def test_short_text(self) -> None:
        chunker = RecursiveChunker(max_tokens=500)
        chunks = chunker.chunk("Hello world.")
        assert len(chunks) == 1
        assert chunks[0].text == "Hello world."

    def test_meta_propagation(self) -> None:
        chunker = RecursiveChunker(max_tokens=10)
        chunks = chunker.chunk("A " * 100, meta={"doc_id": "123"})
        assert all(c.meta["doc_id"] == "123" for c in chunks)

    def test_unique_hashes_for_different_content(self) -> None:
        chunker = RecursiveChunker(max_tokens=10)
        text = "Apple banana cherry. " * 20 + "Dog elephant fox. " * 20
        chunks = chunker.chunk(text)
        # At least some chunks should have different content
        texts = {c.text for c in chunks}
        assert len(texts) > 1


class TestHeadingChunker:
    def test_chunk_by_headings(self) -> None:
        text = """# Title

## Section 1

Content of section 1.

## Section 2

Content of section 2.

### Subsection

More content.
"""
        chunker = HeadingChunker(max_tokens=1000)
        chunks = chunker.chunk(text)
        # Should have chunks for content under each heading
        assert len(chunks) >= 3
        # Check heading paths
        paths = [c.meta.get("heading_path", []) for c in chunks]
        assert any("Section 1" in p for p in paths)
        assert any("Section 2" in p for p in paths)

    def test_fallback_to_recursive(self) -> None:
        text = "No headings here. Just plain text. " * 50
        chunker = HeadingChunker(max_tokens=100)
        chunks = chunker.chunk(text)
        assert len(chunks) > 1  # Falls back to recursive


class TestSemanticChunker:
    def test_sentence_boundary(self) -> None:
        text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence."
        chunker = SemanticChunker(max_tokens=10, min_sentences=2, max_sentences=3)
        chunks = chunker.chunk(text)
        assert len(chunks) >= 2
        # Each chunk should contain complete sentences
        for chunk in chunks:
            assert "." in chunk.text

    def test_chinese_sentences(self) -> None:
        text = "第一句话。第二句话。第三句话。第四句话。第五句话。"
        chunker = SemanticChunker(max_tokens=20, min_sentences=2)
        chunks = chunker.chunk(text)
        assert len(chunks) >= 1


class TestCodeAwareChunker:
    def test_python_functions(self) -> None:
        code = """
def foo():
    return 1

def bar():
    return 2

def baz():
    x = 1
    y = 2
    return x + y
"""
        chunker = CodeAwareChunker(language="python")
        chunks = chunker.chunk(code)
        assert len(chunks) >= 3
        # Check code blocks
        for chunk in chunks:
            assert "```python" in chunk.text

    def test_class_detection(self) -> None:
        code = """
class Foo:
    def method(self):
        pass

class Bar:
    pass
"""
        chunker = CodeAwareChunker(language="python")
        chunks = chunker.chunk(code)
        assert len(chunks) >= 2

    def test_language_meta(self) -> None:
        chunker = CodeAwareChunker(language="javascript")
        chunks = chunker.chunk("function hello() {}")
        assert chunks[0].meta["language"] == "javascript"


class TestTableAwareChunker:
    def test_markdown_table(self) -> None:
        text = """# Report

Some intro text.

| Name | Age | City |
| --- | --- | --- |
| Alice | 30 | NYC |
| Bob | 25 | SF |
| Charlie | 35 | LA |
| Dave | 28 | Chicago |

Conclusion text.
"""
        chunker = TableAwareChunker(mode="window", window_size=2, stride=2)
        chunks = chunker.chunk(text)
        assert len(chunks) >= 2
        # Check table content
        table_chunks = [c for c in chunks if c.meta.get("source") == "table"]
        assert len(table_chunks) >= 1

    def test_per_row_mode(self) -> None:
        text = """| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |"""
        chunker = TableAwareChunker(mode="per_row")
        chunks = chunker.chunk(text)
        table_chunks = [c for c in chunks if c.meta.get("source") == "table"]
        assert len(table_chunks) == 2

    def test_no_table_fallback(self) -> None:
        text = "Just plain text with no tables."
        chunker = TableAwareChunker()
        chunks = chunker.chunk(text)
        assert len(chunks) >= 1


class TestSlidingWindowChunker:
    def test_basic_window(self) -> None:
        text = "A" * 1000
        chunker = SlidingWindowChunker(window_size=50, stride=25, unit="tokens")
        chunks = chunker.chunk(text)
        assert len(chunks) > 1
        # Each chunk should be roughly window_size * 4 chars
        for chunk in chunks[:-1]:  # Skip last (may be shorter)
            assert len(chunk.text) <= 300  # 50 tokens * 4 chars + margin

    def test_overlap(self) -> None:
        text = "X" * 800
        chunker = SlidingWindowChunker(window_size=50, stride=25, unit="tokens")
        chunks = chunker.chunk(text)
        assert len(chunks) >= 2
        # Adjacent chunks should overlap
        if len(chunks) >= 2:
            # Check overlap exists
            end_of_first = chunks[0].text[-50:]
            assert any(c.text.startswith(end_of_first[:10]) for c in chunks[1:])


class TestChunkerRegistry:
    def test_list_strategies(self) -> None:
        strategies = list_strategies()
        assert "recursive" in strategies
        assert "heading" in strategies
        assert "semantic" in strategies
        assert "code_aware" in strategies
        assert "table_aware" in strategies
        assert "sliding_window" in strategies

    def test_get_chunker(self) -> None:
        for strategy in list_strategies():
            chunker = get_chunker(strategy)
            assert chunker is not None
            chunks = chunker.chunk("Test text. " * 10)
            assert isinstance(chunks, list)

    def test_unknown_strategy(self) -> None:
        with pytest.raises(ValueError, match="Unknown chunker"):
            get_chunker("nonexistent")


class TestChunkDataclass:
    def test_compute_hash(self) -> None:
        chunk = Chunk(text="Hello world", seq=0)
        hash1 = chunk.compute_hash()
        assert hash1
        assert chunk.content_hash == hash1

        # Same text should produce same hash
        chunk2 = Chunk(text="Hello world", seq=1)
        hash2 = chunk2.compute_hash()
        assert hash1 == hash2

    def test_different_text_different_hash(self) -> None:
        c1 = Chunk(text="Hello", seq=0)
        c2 = Chunk(text="World", seq=1)
        c1.compute_hash()
        c2.compute_hash()
        assert c1.content_hash != c2.content_hash
