from __future__ import annotations

from fastapi.testclient import TestClient

from minikb.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "minikb"
    assert isinstance(body.get("version"), str)
