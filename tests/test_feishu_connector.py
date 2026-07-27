"""Tests for Feishu connector."""
from __future__ import annotations

import pytest

from minikb.connectors import FeishuConnector, get_connector, list_connectors


class TestFeishuConnector:
    def test_registered(self) -> None:
        assert "feishu" in list_connectors()
        connector = get_connector("feishu")
        assert isinstance(connector, FeishuConnector)
        assert connector.kind == "feishu"

    def test_validate_missing_app_id(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({"app_secret": "secret"})
        assert not is_valid
        assert "app_id" in error

    def test_validate_missing_app_secret(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({"app_id": "cli_xxx"})
        assert not is_valid
        assert "app_secret" in error

    def test_validate_space_no_space_id(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret", "entry_type": "space",
        })
        assert not is_valid
        assert "space_id" in error

    def test_validate_wiki_no_wiki_id(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret", "entry_type": "wiki",
        })
        assert not is_valid
        assert "wiki_id" in error

    def test_validate_docx_no_doc_token(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret", "entry_type": "docx",
        })
        assert not is_valid
        assert "doc_token" in error

    def test_validate_space_ok(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret",
            "entry_type": "space", "space_id": "sp_xxx",
        })
        assert is_valid
        assert error is None

    def test_validate_wiki_ok(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret",
            "entry_type": "wiki", "wiki_id": "wiki_xxx",
        })
        assert is_valid

    def test_validate_docx_ok(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret",
            "entry_type": "docx", "doc_token": "doxcn_xxx",
        })
        assert is_valid

    def test_validate_invalid_entry_type(self) -> None:
        connector = FeishuConnector()
        is_valid, error = connector.validate_config({
            "app_id": "cli_xxx", "app_secret": "secret", "entry_type": "invalid",
        })
        assert not is_valid

    def test_probe_invalid_config(self) -> None:
        connector = FeishuConnector()
        # No app_id
        result = connector.validate_config({})
        assert not result[0]

    @pytest.mark.asyncio
    async def test_fetch_empty_config(self) -> None:
        connector = FeishuConnector()
        records = []
        async for record in connector.fetch({}):
            records.append(record)
        assert len(records) == 0
