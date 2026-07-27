"""Data source connectors package."""
from minikb.connectors.base import Connector, SourceRecord, SyncResult
from minikb.connectors.git_connector import GitConnector
from minikb.connectors.sql_connector import SQLConnector
from minikb.connectors.url_connector import URLConnector

__all__ = [
    "Connector",
    "SourceRecord",
    "SyncResult",
    "URLConnector",
    "GitConnector",
    "SQLConnector",
    "get_connector",
    "list_connectors",
]

# Connector registry
_CONNECTORS: dict[str, type[Connector]] = {
    "url": URLConnector,
    "git": GitConnector,
    "sql": SQLConnector,
}


def get_connector(kind: str) -> Connector:
    """Get a connector instance by kind."""
    cls = _CONNECTORS.get(kind)
    if cls is None:
        raise ValueError(f"Unknown connector kind: {kind}. Available: {list(_CONNECTORS.keys())}")
    return cls()


def list_connectors() -> list[str]:
    """List available connector kinds."""
    return list(_CONNECTORS.keys())
