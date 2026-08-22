"""Tests for chunk CRUD API."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from minikb.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _create_kb(client: TestClient) -> str:
    slug = f"chunk-kb-{uuid.uuid4().hex[:8]}"
    resp = client.post("/v1/kb", json={"name": "Chunk KB", "slug": slug})
    assert resp.status_code == 201
    return resp.json()["id"]


def _upload_doc(client: TestClient, kb_id: str, filename: str = "notes.txt", content: bytes = b"hello") -> str:
    resp = client.post(
        f"/v1/kb/{kb_id}/documents",
        files={"file": (filename, content, "text/plain")},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@patch(
    "minikb.api.routes.chunks.embed_chunk_text",
    new_callable=AsyncMock,
    return_value=[0.1] * 1536,
)
def test_chunk_crud(mock_embed: AsyncMock, client: TestClient) -> None:
    kb_id = _create_kb(client)
    doc_id = _upload_doc(client, kb_id)

    create_resp = client.post(
        f"/v1/kb/{kb_id}/chunks",
        json={
            "document_id": doc_id,
            "title": "Manual chunk",
            "text": "This is a manually added chunk.",
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    chunk_id = created["id"]
    assert created["text"] == "This is a manually added chunk."
    assert created["meta"]["title"] == "Manual chunk"
    mock_embed.assert_awaited()

    patch_resp = client.patch(
        f"/v1/kb/{kb_id}/chunks/{chunk_id}",
        json={"title": "Updated title", "text": "Updated chunk body."},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["text"] == "Updated chunk body."
    assert updated["meta"]["title"] == "Updated title"

    list_resp = client.get(f"/v1/kb/{kb_id}/chunks?document_id={doc_id}")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    delete_resp = client.delete(f"/v1/kb/{kb_id}/chunks/{chunk_id}")
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/v1/kb/{kb_id}/chunks/{chunk_id}")
    assert get_resp.status_code == 404
