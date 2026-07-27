"""Tests for KB CRUD API."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from minikb.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_endpoint(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "minikb"


def test_list_knowledge_bases_empty(client: TestClient) -> None:
    """Test listing KBs when none exist (dev mode with default org)."""
    resp = client.get("/v1/kb")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body


def test_create_knowledge_base(client: TestClient) -> None:
    """Test creating a new knowledge base."""
    kb_data = {
        "name": "Test KB",
        "slug": f"test-kb-{uuid.uuid4().hex[:8]}",
        "description": "A test knowledge base",
        "kind": "general",
        "visibility": "private",
    }
    resp = client.post("/v1/kb", json=kb_data)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == kb_data["name"]
    assert body["slug"] == kb_data["slug"]
    assert body["description"] == kb_data["description"]
    assert body["kind"] == "general"
    assert "id" in body


def test_create_kb_duplicate_slug(client: TestClient) -> None:
    """Test that duplicate slugs are rejected."""
    slug = f"dup-test-{uuid.uuid4().hex[:8]}"
    kb_data = {"name": "First KB", "slug": slug}

    # Create first
    resp1 = client.post("/v1/kb", json=kb_data)
    assert resp1.status_code == 201

    # Try duplicate
    kb_data["name"] = "Second KB"
    resp2 = client.post("/v1/kb", json=kb_data)
    assert resp2.status_code == 409


def test_get_knowledge_base(client: TestClient) -> None:
    """Test getting a specific KB by ID."""
    # Create one first
    kb_data = {"name": "Get Test", "slug": f"get-test-{uuid.uuid4().hex[:8]}"}
    create_resp = client.post("/v1/kb", json=kb_data)
    kb_id = create_resp.json()["id"]

    # Get it
    resp = client.get(f"/v1/kb/{kb_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == kb_id


def test_get_kb_not_found(client: TestClient) -> None:
    """Test 404 for non-existent KB."""
    fake_id = uuid.uuid4()
    resp = client.get(f"/v1/kb/{fake_id}")
    assert resp.status_code == 404


def test_update_knowledge_base(client: TestClient) -> None:
    """Test updating a KB."""
    # Create one
    kb_data = {"name": "Update Test", "slug": f"upd-test-{uuid.uuid4().hex[:8]}"}
    create_resp = client.post("/v1/kb", json=kb_data)
    kb_id = create_resp.json()["id"]

    # Update it
    update_data = {"name": "Updated Name", "description": "New description"}
    resp = client.patch(f"/v1/kb/{kb_id}", json=update_data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Updated Name"
    assert body["description"] == "New description"


def test_delete_knowledge_base(client: TestClient) -> None:
    """Test deleting a KB."""
    # Create one
    kb_data = {"name": "Delete Test", "slug": f"del-test-{uuid.uuid4().hex[:8]}"}
    create_resp = client.post("/v1/kb", json=kb_data)
    kb_id = create_resp.json()["id"]

    # Delete it
    resp = client.delete(f"/v1/kb/{kb_id}")
    assert resp.status_code == 204

    # Verify it's gone
    resp = client.get(f"/v1/kb/{kb_id}")
    assert resp.status_code == 404
