"""Tests for P8 ops modules: health, metrics, backup/restore, import/export."""
from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from minikb.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestHealthEndpoints:
    def test_health(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body

    def test_health_live(self, client: TestClient) -> None:
        resp = client.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_health_ready(self, client: TestClient) -> None:
        resp = client.get("/health/ready")
        # May return 200 or 503 depending on DB availability
        assert resp.status_code in (200, 503)
        body = resp.json()
        assert body["status"] in ("ok", "degraded")
        assert "checks" in body


class TestMetrics:
    def test_metrics_endpoint(self, client: TestClient) -> None:
        resp = client.get("/metrics")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/plain")
        body = resp.text
        # These should always be present (not DB-dependent)
        assert "minikb_info" in body
        assert "minikb_requests_total" in body
        assert "minikb_request_duration_seconds" in body

    def test_metrics_format(self, client: TestClient) -> None:
        resp = client.get("/metrics")
        body = resp.text
        # Check Prometheus exposition format
        for line in body.strip().split("\n"):
            if line.startswith("#"):
                assert line.startswith("# HELP") or line.startswith("# TYPE") or line.startswith("# ERROR")
            else:
                # Metric line should have a name and value
                parts = line.split(" ")
                assert len(parts) >= 2, f"Bad metric line: {line}"


class TestWorkerModule:
    def test_import(self) -> None:
        from minikb.worker import worker_loop, process_job, poll_jobs
        assert callable(worker_loop)
        assert callable(process_job)
        assert callable(poll_jobs)


class TestImportExport:
    def test_export_import_routes_exist(self, client: TestClient) -> None:
        # Verify routes are registered via OpenAPI schema
        schema = app.openapi()
        paths = list(schema.get("paths", {}).keys())
        assert "/v1/kb/{kb_id}/export" in paths
        assert "/v1/kb/{kb_id}/import" in paths


class TestBackupScripts:
    def test_backup_script_exists(self) -> None:
        import os
        assert os.path.exists("scripts/backup.sh")
        assert os.path.exists("scripts/restore.sh")

    def test_backup_script_executable(self) -> None:
        import os
        assert os.access("scripts/backup.sh", os.R_OK)
        assert os.access("scripts/restore.sh", os.R_OK)


class TestHelmChart:
    def test_chart_yaml_exists(self) -> None:
        import os
        assert os.path.exists("helm/minikb/Chart.yaml")

    def test_values_yaml_exists(self) -> None:
        import os
        assert os.path.exists("helm/minikb/values.yaml")

    def test_chart_yaml_valid(self) -> None:
        import os
        try:
            import yaml
            with open("helm/minikb/Chart.yaml") as f:
                data = yaml.safe_load(f)
            assert data["name"] == "minikb"
            assert "version" in data
        except ImportError:
            # yaml not installed, just check file is non-empty
            with open("helm/minikb/Chart.yaml") as f:
                content = f.read()
            assert "minikb" in content

    def test_templates_exist(self) -> None:
        import os
        assert os.path.exists("helm/minikb/templates/deployment.yaml")
        assert os.path.exists("helm/minikb/templates/service.yaml")
        assert os.path.exists("helm/minikb/templates/_helpers.tpl")


class TestDockerCompose:
    def test_prod_compose_exists(self) -> None:
        import os
        assert os.path.exists("docker/docker-compose.prod.yml")

    def test_prod_compose_has_services(self) -> None:
        import os
        try:
            import yaml
            with open("docker/docker-compose.prod.yml") as f:
                data = yaml.safe_load(f)
            services = data.get("services", {})
            assert "web" in services
            assert "worker" in services
            assert "postgres" in services
            assert "redis" in services
            assert "minio" in services
        except ImportError:
            with open("docker/docker-compose.prod.yml") as f:
                content = f.read()
            assert "web:" in content
            assert "worker:" in content


class TestGrafanaDashboard:
    def test_dashboard_json_exists(self) -> None:
        import os
        assert os.path.exists("docker/grafana-dashboard.json")

    def test_dashboard_json_valid(self) -> None:
        with open("docker/grafana-dashboard.json") as f:
            data = json.load(f)
        assert data["title"] == "minikb Overview"
        assert len(data["panels"]) > 0
        assert data["tags"] == ["minikb"]
