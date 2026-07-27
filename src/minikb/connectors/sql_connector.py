"""SQL connector - fetch documents from SQL databases."""
from __future__ import annotations

import hashlib
import logging
from typing import Any, AsyncIterator

from minikb.connectors.base import Connector, SourceRecord

logger = logging.getLogger(__name__)

# Allowed database drivers for security
ALLOWED_DRIVERS = {
    "postgresql", "postgres",
    "mysql", "mariadb",
    "sqlite",
    "mssql",
}


class SQLConnector(Connector):
    """Fetch documents from SQL databases.

    Config:
        connection_string: str  - SQLAlchemy-compatible connection string
        query: str  - SQL query to execute
        chunk_mode: str  - 'per_row' (default) or 'per_column' or 'multi_row'
        multi_row_size: int  - Rows per chunk in multi_row mode (default: 10)
        title_column: str  - Column to use as document title (default: first column)
        content_columns: list[str]  - Columns to use as content (default: all)
    """

    kind = "sql"

    async def fetch(
        self,
        config: dict[str, Any],
        state: dict[str, Any] | None = None,
    ) -> AsyncIterator[SourceRecord]:
        connection_string = config.get("connection_string", "")
        query = config.get("query", "")
        chunk_mode = config.get("chunk_mode", "per_row")
        multi_row_size = config.get("multi_row_size", 10)
        title_column = config.get("title_column", "")
        content_columns = config.get("content_columns", [])

        if not connection_string or not query:
            return

        try:
            from sqlalchemy import create_engine, text
            from sqlalchemy.engine import Engine

            engine = create_engine(connection_string)
            with engine.connect() as conn:
                result = conn.execute(text(query))
                columns = list(result.keys())
                rows = result.fetchall()

            if not rows:
                return

            # Determine title and content columns
            if title_column and title_column in columns:
                title_idx = columns.index(title_column)
            else:
                title_idx = 0

            if content_columns:
                content_indices = [columns.index(c) for c in content_columns if c in columns]
            else:
                content_indices = list(range(len(columns)))

            if chunk_mode == "per_row":
                for i, row in enumerate(rows):
                    title = str(row[title_idx]) if row[title_idx] else f"row_{i}"
                    content = self._row_to_text(columns, row, content_indices)
                    content_bytes = content.encode("utf-8")

                    yield SourceRecord(
                        title=f"{title}",
                        content=content_bytes,
                        uri=f"sql://query/row/{i}",
                        mime="text/plain",
                        meta={
                            "source": "sql",
                            "row_index": i,
                            "columns": columns,
                            "total_rows": len(rows),
                        },
                        external_id=hashlib.sha256(
                            f"{query}:{i}".encode()
                        ).hexdigest()[:16],
                    )

            elif chunk_mode == "multi_row":
                for batch_start in range(0, len(rows), multi_row_size):
                    batch = rows[batch_start:batch_start + multi_row_size]
                    batch_texts = []
                    for i, row in enumerate(batch):
                        row_text = self._row_to_text(columns, row, content_indices)
                        batch_texts.append(row_text)

                    content = "\n\n---\n\n".join(batch_texts)
                    content_bytes = content.encode("utf-8")

                    yield SourceRecord(
                        title=f"rows_{batch_start}_{batch_start + len(batch)}",
                        content=content_bytes,
                        uri=f"sql://query/rows/{batch_start}",
                        mime="text/plain",
                        meta={
                            "source": "sql",
                            "row_start": batch_start,
                            "row_count": len(batch),
                            "columns": columns,
                            "total_rows": len(rows),
                        },
                        external_id=hashlib.sha256(
                            f"{query}:batch:{batch_start}".encode()
                        ).hexdigest()[:16],
                    )

            elif chunk_mode == "per_column":
                for col_idx in content_indices:
                    col_name = columns[col_idx]
                    values = [str(row[col_idx]) for row in rows if row[col_idx] is not None]
                    content = f"Column: {col_name}\n\n" + "\n".join(
                        f"- {v}" for v in values[:1000]  # Limit to 1000 values
                    )
                    content_bytes = content.encode("utf-8")

                    yield SourceRecord(
                        title=f"column:{col_name}",
                        content=content_bytes,
                        uri=f"sql://query/column/{col_name}",
                        mime="text/plain",
                        meta={
                            "source": "sql",
                            "column": col_name,
                            "value_count": len(values),
                            "columns": columns,
                        },
                        external_id=hashlib.sha256(
                            f"{query}:col:{col_name}".encode()
                        ).hexdigest()[:16],
                    )

        except ImportError:
            logger.error("SQLAlchemy not installed. Run: pip install sqlalchemy")
        except Exception as e:
            logger.error("SQL connector error: %s", e)

    def _row_to_text(
        self,
        columns: list[str],
        row: tuple,
        content_indices: list[int],
    ) -> str:
        """Convert a row to readable text."""
        parts = []
        for idx in content_indices:
            if idx < len(row) and row[idx] is not None:
                parts.append(f"{columns[idx]}: {row[idx]}")
        return " | ".join(parts)

    def validate_config(self, config: dict[str, Any]) -> tuple[bool, str | None]:
        connection_string = config.get("connection_string")
        if not connection_string:
            return False, "connection_string is required"

        # Check allowed drivers
        driver = connection_string.split("://")[0] if "://" in connection_string else ""
        if "+" in driver:
            driver = driver.split("+")[0]
        if driver not in ALLOWED_DRIVERS:
            return False, f"Database driver not allowed: {driver}. Allowed: {sorted(ALLOWED_DRIVERS)}"

        query = config.get("query")
        if not query:
            return False, "query is required"

        # Basic SQL injection protection - reject destructive operations
        query_upper = query.upper().strip()
        for keyword in ("DROP ", "DELETE ", "TRUNCATE ", "ALTER ", "CREATE ", "INSERT ", "UPDATE "):
            if query_upper.startswith(keyword):
                return False, f"Destructive SQL not allowed: {keyword.strip()}"

        return True, None

    async def probe(self, config: dict[str, Any]) -> dict[str, Any]:
        """Check database connectivity."""
        is_valid, error = self.validate_config(config)
        if not is_valid:
            return {"status": "error", "message": error}

        try:
            from sqlalchemy import create_engine, text

            engine = create_engine(config["connection_string"])
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
            return {"status": "ok", "message": "Database connection successful"}
        except Exception as e:
            return {"status": "error", "message": str(e)[:200]}
