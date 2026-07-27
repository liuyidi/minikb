"""Tests for P4 connector modules."""
from __future__ import annotations

import pytest

from minikb.connectors import (
    Connector,
    GitConnector,
    SourceRecord,
    SQLConnector,
    URLConnector,
    get_connector,
    list_connectors,
)


class TestConnectorRegistry:
    def test_list_connectors(self) -> None:
        kinds = list_connectors()
        assert "url" in kinds
        assert "git" in kinds
        assert "sql" in kinds

    def test_get_url_connector(self) -> None:
        connector = get_connector("url")
        assert isinstance(connector, URLConnector)
        assert connector.kind == "url"

    def test_get_git_connector(self) -> None:
        connector = get_connector("git")
        assert isinstance(connector, GitConnector)
        assert connector.kind == "git"

    def test_get_sql_connector(self) -> None:
        connector = get_connector("sql")
        assert isinstance(connector, SQLConnector)
        assert connector.kind == "sql"

    def test_unknown_connector(self) -> None:
        with pytest.raises(ValueError, match="Unknown connector"):
            get_connector("nonexistent")


class TestURLConnector:
    def test_validate_valid(self) -> None:
        connector = URLConnector()
        is_valid, error = connector.validate_config({"urls": ["https://example.com"]})
        assert is_valid
        assert error is None

    def test_validate_string_url(self) -> None:
        connector = URLConnector()
        is_valid, error = connector.validate_config({"urls": "https://example.com"})
        assert is_valid

    def test_validate_empty(self) -> None:
        connector = URLConnector()
        is_valid, error = connector.validate_config({"urls": []})
        assert not is_valid

    def test_validate_missing(self) -> None:
        connector = URLConnector()
        is_valid, error = connector.validate_config({})
        assert not is_valid

    def test_validate_invalid_url(self) -> None:
        connector = URLConnector()
        is_valid, error = connector.validate_config({"urls": ["not-a-url"]})
        assert not is_valid

    def test_extract_text(self) -> None:
        connector = URLConnector()
        html = "<html><body><h1>Title</h1><p>Hello <b>world</b></p></body></html>"
        text = connector._extract_text(html)
        assert "Title" in text
        assert "Hello" in text
        assert "world" in text
        assert "<" not in text

    def test_extract_text_removes_scripts(self) -> None:
        connector = URLConnector()
        html = "<p>Text</p><script>alert('xss')</script><p>More</p>"
        text = connector._extract_text(html)
        assert "alert" not in text
        assert "Text" in text

    def test_extract_title_from_url(self) -> None:
        connector = URLConnector()
        title = connector._extract_title("https://example.com/docs/readme", b"", "text/plain")
        assert "readme" in title

    @pytest.mark.asyncio
    async def test_fetch_empty_config(self) -> None:
        connector = URLConnector()
        records = []
        async for record in connector.fetch({}):
            records.append(record)
        assert len(records) == 0


class TestGitConnector:
    def test_validate_valid(self) -> None:
        connector = GitConnector()
        is_valid, error = connector.validate_config({"repo_url": "https://github.com/user/repo"})
        assert is_valid

    def test_validate_ssh_url(self) -> None:
        connector = GitConnector()
        is_valid, error = connector.validate_config({"repo_url": "git@github.com:user/repo"})
        assert is_valid

    def test_validate_empty(self) -> None:
        connector = GitConnector()
        is_valid, error = connector.validate_config({})
        assert not is_valid

    def test_validate_invalid(self) -> None:
        connector = GitConnector()
        is_valid, error = connector.validate_config({"repo_url": "not-a-git-url"})
        assert not is_valid

    def test_should_exclude(self) -> None:
        connector = GitConnector()
        assert connector._should_exclude(".git/config", {".git"})
        assert connector._should_exclude("src/__pycache__/foo.pyc", {"__pycache__"})
        assert not connector._should_exclude("src/main.py", {".git", "__pycache__"})

    def test_should_include(self) -> None:
        connector = GitConnector()
        assert connector._should_include("main.py", {"*.py"}, [])
        assert connector._should_include("README.md", {"README*"}, [])
        assert not connector._should_include("main.py", {"*.js"}, [])

    def test_should_include_language_hints(self) -> None:
        connector = GitConnector()
        assert connector._should_include("main.py", {"*.py"}, ["python"])
        assert not connector._should_include("main.py", {"*.py"}, ["javascript"])
        assert connector._should_include("app.js", {"*.js"}, ["javascript"])


class TestSQLConnector:
    def test_validate_valid(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "postgresql://user:pass@host/db",
            "query": "SELECT * FROM docs",
        })
        assert is_valid

    def test_validate_missing_conn(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({"query": "SELECT 1"})
        assert not is_valid

    def test_validate_missing_query(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({"connection_string": "postgresql://localhost/db"})
        assert not is_valid

    def test_validate_rejects_drop(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "postgresql://localhost/db",
            "query": "DROP TABLE users",
        })
        assert not is_valid
        assert "Destructive" in error

    def test_validate_rejects_delete(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "postgresql://localhost/db",
            "query": "DELETE FROM users WHERE 1=1",
        })
        assert not is_valid

    def test_validate_rejects_insert(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "postgresql://localhost/db",
            "query": "INSERT INTO users VALUES (1, 'test')",
        })
        assert not is_valid

    def test_validate_allows_select(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "postgresql://localhost/db",
            "query": "SELECT title, content FROM documents WHERE id > 10",
        })
        assert is_valid

    def test_validate_rejects_unsupported_driver(self) -> None:
        connector = SQLConnector()
        is_valid, error = connector.validate_config({
            "connection_string": "mongodb://localhost/db",
            "query": "db.find()",
        })
        assert not is_valid
        assert "not allowed" in error

    def test_row_to_text(self) -> None:
        connector = SQLConnector()
        columns = ["id", "title", "content"]
        row = (1, "Test Doc", "Some content here")
        text = connector._row_to_text(columns, row, [1, 2])
        assert "title: Test Doc" in text
        assert "content: Some content here" in text
        assert "id" not in text  # Not in content_indices

    @pytest.mark.asyncio
    async def test_fetch_empty_config(self) -> None:
        connector = SQLConnector()
        records = []
        async for record in connector.fetch({}):
            records.append(record)
        assert len(records) == 0
