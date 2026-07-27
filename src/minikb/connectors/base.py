"""Data source connectors - fetch documents from external sources."""
from __future__ import annotations

import hashlib
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)


@dataclass
class SourceRecord:
    """A record fetched from an external data source."""
    title: str
    content: bytes
    uri: str
    mime: str = "text/plain"
    meta: dict[str, Any] = field(default_factory=dict)
    external_id: str | None = None
    updated_at: datetime | None = None


@dataclass
class SyncResult:
    """Result of a sync operation."""
    total_records: int = 0
    new_records: int = 0
    updated_records: int = 0
    skipped_records: int = 0
    errors: list[str] = field(default_factory=list)
    state: dict[str, Any] = field(default_factory=dict)


class Connector(ABC):
    """Base class for data source connectors."""

    kind: str = "base"

    @abstractmethod
    async def fetch(
        self,
        config: dict[str, Any],
        state: dict[str, Any] | None = None,
    ) -> AsyncIterator[SourceRecord]:
        """Fetch records from the external source.

        Args:
            config: Connector-specific configuration
            state: Previous sync state for incremental fetching

        Yields:
            SourceRecord instances
        """
        ...

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> tuple[bool, str | None]:
        """Validate connector configuration.

        Returns:
            (is_valid, error_message)
        """
        ...

    async def probe(self, config: dict[str, Any]) -> dict[str, Any]:
        """Check connectivity and source health.

        Returns:
            Health report dict with 'status', 'message', 'details'
        """
        try:
            is_valid, error = self.validate_config(config)
            if not is_valid:
                return {"status": "error", "message": error or "Invalid config"}
            return {"status": "ok", "message": "Connection successful"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def preview(
        self,
        config: dict[str, Any],
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Preview records without full ingestion.

        Returns:
            List of record previews (title, uri, size, meta)
        """
        previews = []
        async for record in self.fetch(config):
            previews.append({
                "title": record.title,
                "uri": record.uri,
                "size": len(record.content),
                "mime": record.mime,
                "meta": record.meta,
            })
            if len(previews) >= limit:
                break
        return previews
