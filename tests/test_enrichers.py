"""Tests for text enrichers."""
from __future__ import annotations

import pytest

from minikb.ingest.chunkers import Chunk
from minikb.ingest.enrichers import (
    DocumentSummaryEnricher,
    EnricherConfig,
    EnricherPipeline,
    HeadingPathEnricher,
    MetadataPrefixEnricher,
    enrich_chunks,
)


def _make_chunk(text: str, seq: int = 0, **meta: object) -> Chunk:
    chunk = Chunk(text=text, seq=seq, meta=dict(meta))
    chunk.compute_hash()
    return chunk


class TestHeadingPathEnricher:
    def test_add_heading_path(self) -> None:
        chunks = [_make_chunk("Content here.", heading_path=["Chapter 1", "Section 2"])]
        enricher = HeadingPathEnricher()
        result = enricher.enrich(chunks, {"doc_title": "My Doc"})
        assert "[Context: My Doc > Chapter 1 > Section 2]" in result[0].text
        assert "Content here." in result[0].text

    def test_add_doc_title_only(self) -> None:
        chunks = [_make_chunk("Content here.")]
        enricher = HeadingPathEnricher()
        result = enricher.enrich(chunks, {"doc_title": "My Doc"})
        assert "[Context: My Doc]" in result[0].text

    def test_no_context(self) -> None:
        chunks = [_make_chunk("Content here.")]
        enricher = HeadingPathEnricher()
        result = enricher.enrich(chunks, {})
        assert result[0].text == "Content here."

    def test_recomputes_hash(self) -> None:
        chunks = [_make_chunk("Content.", heading_path=["A"])]
        original_hash = chunks[0].content_hash
        enricher = HeadingPathEnricher()
        result = enricher.enrich(chunks, {"doc_title": "Doc"})
        assert result[0].content_hash != original_hash


class TestDocumentSummaryEnricher:
    def test_add_summary(self) -> None:
        chunks = [_make_chunk("Content.")]
        enricher = DocumentSummaryEnricher()
        result = enricher.enrich(chunks, {"description": "A test document about things."})
        assert "[Document: A test document about things.]" in result[0].text

    def test_truncate_long_summary(self) -> None:
        chunks = [_make_chunk("Content.")]
        long_summary = "word " * 200
        enricher = DocumentSummaryEnricher(max_summary_chars=50)
        result = enricher.enrich(chunks, {"description": long_summary})
        assert len(result[0].text) < len(long_summary) + 100

    def test_no_summary(self) -> None:
        chunks = [_make_chunk("Content.")]
        enricher = DocumentSummaryEnricher()
        result = enricher.enrich(chunks, {})
        assert result[0].text == "Content."


class TestMetadataPrefixEnricher:
    def test_add_metadata(self) -> None:
        chunks = [_make_chunk("Content.")]
        enricher = MetadataPrefixEnricher(fields=["author", "source"])
        result = enricher.enrich(chunks, {"author": "Alice", "source": "wiki"})
        assert "author: Alice" in result[0].text
        assert "source: wiki" in result[0].text

    def test_skip_missing_fields(self) -> None:
        chunks = [_make_chunk("Content.")]
        enricher = MetadataPrefixEnricher(fields=["author", "missing_field"])
        result = enricher.enrich(chunks, {"author": "Alice"})
        assert "author: Alice" in result[0].text
        assert "missing_field" not in result[0].text


class TestEnricherPipeline:
    def test_default_pipeline(self) -> None:
        chunks = [_make_chunk("Content.", heading_path=["Ch1"])]
        config = EnricherConfig(heading_path=True, document_summary=False)
        result = enrich_chunks(chunks, {"doc_title": "Doc"}, config)
        assert "[Context: Doc > Ch1]" in result[0].text

    def test_empty_pipeline(self) -> None:
        chunks = [_make_chunk("Content.")]
        config = EnricherConfig(
            heading_path=False,
            document_summary=False,
            metadata_prefix=False,
            table_to_markdown=False,
        )
        result = enrich_chunks(chunks, {"doc_title": "Doc"}, config)
        assert result[0].text == "Content."

    def test_chained_enrichers(self) -> None:
        chunks = [_make_chunk("Content.", heading_path=["Section"])]
        config = EnricherConfig(heading_path=True, document_summary=True)
        result = enrich_chunks(
            chunks,
            {"doc_title": "Doc", "description": "A test doc."},
            config,
        )
        # Should have both enrichments (heading path added first, then summary prepended)
        assert "Section" in result[0].text
        assert "A test doc." in result[0].text
