"""Feishu/Lark connector - fetch documents from Feishu spaces, wikis, and docs.

Supports three entry points:
- space: Feishu Drive space (folder)
- wiki: Feishu Wiki knowledge base
- docx: Individual document by token

Auth: tenant_access_token via app_id + app_secret.
Incremental sync: tracks updated_time per document.
"""
from __future__ import annotations

import logging
import time
from typing import Any, AsyncIterator

import httpx

from minikb.connectors.base import Connector, SourceRecord

logger = logging.getLogger(__name__)

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"


class FeishuConnector(Connector):
    """Fetch documents from Feishu/Lark.

    Config:
        app_id: str  - Feishu app ID
        app_secret: str  - Feishu app secret
        entry_type: str  - 'space', 'wiki', or 'docx'
        space_id: str  - Space ID (for entry_type='space')
        wiki_id: str  - Wiki ID (for entry_type='wiki')
        doc_token: str  - Document token (for entry_type='docx')
        folder_token: str  - Folder token within space (optional)
    """

    kind = "feishu"

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires: float = 0

    async def _get_token(self, app_id: str, app_secret: str) -> str:
        """Get or refresh tenant_access_token."""
        if self._token and time.time() < self._token_expires - 60:
            return self._token

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal",
                json={"app_id": app_id, "app_secret": app_secret},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 0:
            raise RuntimeError(f"Feishu auth failed: {data.get('msg')}")

        self._token = data["tenant_access_token"]
        self._token_expires = time.time() + data.get("expire", 7200)
        return self._token

    async def _api_get(self, client: httpx.AsyncClient, path: str, params: dict | None = None) -> dict:
        """Make authenticated GET request to Feishu API."""
        headers = {"Authorization": f"Bearer {self._token}"}
        resp = await client.get(f"{FEISHU_BASE_URL}{path}", headers=headers, params=params or {})
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"Feishu API error ({path}): {data.get('msg')} (code={data.get('code')})")
        return data

    async def _fetch_docx(self, client: httpx.AsyncClient, doc_token: str) -> str:
        """Fetch docx content as markdown-like text."""
        data = await self._api_get(client, f"/docx/v1/documents/{doc_token}/raw_content")
        # The raw_content API returns markdown-like format
        content = data.get("data", {}).get("content", "")
        return content

    async def _list_space_files(
        self,
        client: httpx.AsyncClient,
        space_id: str,
        folder_token: str | None = None,
        page_token: str | None = None,
    ) -> tuple[list[dict], str | None]:
        """List files in a Feishu space folder."""
        params: dict[str, str] = {"folder_token": folder_token or space_id}
        if page_token:
            params["page_token"] = page_token

        data = await self._api_get(client, "/drive/v1/files", params=params)
        files = data.get("data", {}).get("files", [])
        next_page = data.get("data", {}).get("next_page_token")
        return files, next_page or None

    async def _list_wiki_nodes(
        self,
        client: httpx.AsyncClient,
        wiki_id: str,
        page_token: str | None = None,
    ) -> tuple[list[dict], str | None]:
        """List nodes in a Feishu wiki."""
        params: dict[str, str] = {"space_id": wiki_id}
        if page_token:
            params["page_token"] = page_token

        data = await self._api_get(client, "/wiki/v2/spaces/get_node", params=params)
        # The wiki API returns a tree structure
        node = data.get("data", {}).get("node", {})
        children = data.get("data", {}).get("children", [])
        return [node] + children if node else children, data.get("data", {}).get("has_more") and data.get("data", {}).get("page_token") or None

    async def fetch(
        self,
        config: dict[str, Any],
        state: dict[str, Any] | None = None,
    ) -> AsyncIterator[SourceRecord]:
        app_id = config.get("app_id", "")
        app_secret = config.get("app_secret", "")
        entry_type = config.get("entry_type", "space")

        if not app_id or not app_secret:
            return

        token = await self._get_token(app_id, app_secret)
        state = state or {}
        last_sync_time = state.get("last_sync_time", 0)

        async with httpx.AsyncClient(timeout=60.0) as client:
            if entry_type == "docx":
                doc_token = config.get("doc_token", "")
                if not doc_token:
                    return

                content = await self._fetch_docx(client, doc_token)
                yield SourceRecord(
                    title=f"Feishu Doc: {doc_token}",
                    content=content.encode("utf-8"),
                    uri=f"feishu://docx/{doc_token}",
                    mime="text/markdown",
                    meta={"source": "feishu", "entry_type": "docx", "doc_token": doc_token},
                    external_id=doc_token,
                )

            elif entry_type == "space":
                space_id = config.get("space_id", "")
                folder_token = config.get("folder_token")
                if not space_id:
                    return

                page_token: str | None = None
                while True:
                    files, page_token = await self._list_space_files(client, space_id, folder_token, page_token)

                    for f in files:
                        file_token = f.get("token", "")
                        file_type = f.get("type", "")  # doc, sheet, docx, etc.
                        updated_time = f.get("updated_time", 0)

                        # Incremental: skip if not updated since last sync
                        if updated_time <= last_sync_time:
                            continue

                        # Only fetch supported document types
                        if file_type not in ("doc", "docx"):
                            continue

                        try:
                            content = await self._fetch_docx(client, file_token)
                            title = f.get("name", file_token)
                            yield SourceRecord(
                                title=title,
                                content=content.encode("utf-8"),
                                uri=f"feishu://space/{space_id}/{file_token}",
                                mime="text/markdown",
                                meta={
                                    "source": "feishu",
                                    "entry_type": "space",
                                    "space_id": space_id,
                                    "file_token": file_token,
                                    "file_type": file_type,
                                    "updated_time": updated_time,
                                },
                                external_id=file_token,
                                updated_at=None,  # Feishu uses unix timestamp
                            )
                        except Exception as e:
                            logger.error("Failed to fetch Feishu doc %s: %s", file_token, e)

                    if not page_token:
                        break

            elif entry_type == "wiki":
                wiki_id = config.get("wiki_id", "")
                if not wiki_id:
                    return

                # Recursively fetch wiki nodes
                async def _fetch_wiki_recursive(wiki_space_id: str, nodes: list[dict]) -> None:
                    for node in nodes:
                        obj_token = node.get("obj_token", "")
                        obj_type = node.get("obj_type", "")
                        updated_time = node.get("updated_time", 0)
                        title = node.get("title", "")

                        if updated_time <= last_sync_time:
                            continue

                        if obj_type == "docx" and obj_token:
                            try:
                                content = await self._fetch_docx(client, obj_token)
                                yield SourceRecord(
                                    title=title or obj_token,
                                    content=content.encode("utf-8"),
                                    uri=f"feishu://wiki/{wiki_space_id}/{obj_token}",
                                    mime="text/markdown",
                                    meta={
                                        "source": "feishu",
                                        "entry_type": "wiki",
                                        "wiki_id": wiki_space_id,
                                        "obj_token": obj_token,
                                        "obj_type": obj_type,
                                        "updated_time": updated_time,
                                    },
                                    external_id=obj_token,
                                )
                            except Exception as e:
                                logger.error("Failed to fetch Feishu wiki doc %s: %s", obj_token, e)

                page_token = None
                while True:
                    nodes, page_token = await self._list_wiki_nodes(client, wiki_id, page_token)
                    async for record in _fetch_wiki_recursive(wiki_id, nodes):
                        yield record
                    if not page_token:
                        break

        # Update state for next incremental sync
        state["last_sync_time"] = int(time.time())

    def validate_config(self, config: dict[str, Any]) -> tuple[bool, str | None]:
        app_id = config.get("app_id", "").strip()
        app_secret = config.get("app_secret", "").strip()
        if not app_id:
            return False, "app_id is required"
        if not app_secret:
            return False, "app_secret is required"

        entry_type = config.get("entry_type", "space")
        if entry_type not in ("space", "wiki", "docx"):
            return False, f"entry_type must be 'space', 'wiki', or 'docx', got: {entry_type}"

        if entry_type == "space" and not config.get("space_id"):
            return False, "space_id is required for entry_type='space'"
        if entry_type == "wiki" and not config.get("wiki_id"):
            return False, "wiki_id is required for entry_type='wiki'"
        if entry_type == "docx" and not config.get("doc_token"):
            return False, "doc_token is required for entry_type='docx'"

        return True, None

    async def probe(self, config: dict[str, Any]) -> dict[str, Any]:
        """Check Feishu connectivity and credentials."""
        is_valid, error = self.validate_config(config)
        if not is_valid:
            return {"status": "error", "message": error}

        try:
            await self._get_token(config["app_id"], config["app_secret"])
            return {"status": "ok", "message": "Feishu connection successful"}
        except Exception as e:
            return {"status": "error", "message": f"Auth failed: {str(e)[:200]}"}
