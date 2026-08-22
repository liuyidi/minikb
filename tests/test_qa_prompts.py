"""Tests for QA default prompts."""
from __future__ import annotations

from minikb.qa.prompts import (
    DEFAULT_OPENING_STATEMENT_ZH,
    DEFAULT_QA_TEMPLATE,
    DEFAULT_QA_TEMPLATE_EN,
    get_default_template,
)


def test_default_qa_template_covers_broad_questions() -> None:
    assert "宽泛问题" in DEFAULT_QA_TEMPLATE
    assert "不要拒绝回答" in DEFAULT_QA_TEMPLATE
    assert "换一种问法" in DEFAULT_QA_TEMPLATE


def test_default_qa_template_en_covers_broad_questions() -> None:
    assert "broad questions" in DEFAULT_QA_TEMPLATE_EN.lower()
    assert "do not refuse" in DEFAULT_QA_TEMPLATE_EN.lower()


def test_default_opening_statement_present() -> None:
    assert "文档" in DEFAULT_OPENING_STATEMENT_ZH


def test_get_default_template_zh() -> None:
    assert get_default_template("zh") == DEFAULT_QA_TEMPLATE
