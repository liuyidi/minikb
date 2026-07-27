"""Tests for P5 permissions: members, audit log, scopes."""
from __future__ import annotations

import uuid

import pytest

from minikb.auth import check_scope, generate_api_key, verify_secret
from minikb.db import ApiKey, KbRole, OrgRole


class TestScopes:
    def test_empty_scopes_all_access(self) -> None:
        key = ApiKey(
            id=uuid.uuid4(), org_id=uuid.uuid4(), prefix="test",
            hashed_secret="", name="test", scopes={}, disabled=False,
        )
        assert check_scope(key, "kb:read")
        assert check_scope(key, "kb:write")
        assert check_scope(key, "retrieve")

    def test_scope_allowed(self) -> None:
        key = ApiKey(
            id=uuid.uuid4(), org_id=uuid.uuid4(), prefix="test",
            hashed_secret="", name="test", scopes={"kb:read", "retrieve"}, disabled=False,
        )
        assert check_scope(key, "kb:read")
        assert check_scope(key, "retrieve")

    def test_scope_denied(self) -> None:
        key = ApiKey(
            id=uuid.uuid4(), org_id=uuid.uuid4(), prefix="test",
            hashed_secret="", name="test", scopes={"kb:read"}, disabled=False,
        )
        assert not check_scope(key, "kb:write")
        assert not check_scope(key, "kb:admin")


class TestApiKeyGeneration:
    def test_generate_unique_keys(self) -> None:
        prefix1, raw1, hashed1 = generate_api_key()
        prefix2, raw2, hashed2 = generate_api_key()
        assert prefix1 != prefix2
        assert raw1 != raw2
        assert hashed1 != hashed2

    def test_verify_correct(self) -> None:
        prefix, raw, hashed = generate_api_key()
        assert verify_secret(raw, hashed)

    def test_verify_wrong(self) -> None:
        prefix, raw, hashed = generate_api_key()
        assert not verify_secret("wrong-secret", hashed)

    def test_prefix_length(self) -> None:
        prefix, raw, hashed = generate_api_key()
        assert len(prefix) == 8


class TestOrgRoles:
    def test_role_values(self) -> None:
        assert OrgRole.OWNER == "owner"
        assert OrgRole.ADMIN == "admin"
        assert OrgRole.MEMBER == "member"


class TestKbRoles:
    def test_role_values(self) -> None:
        assert KbRole.OWNER == "owner"
        assert KbRole.EDITOR == "editor"
        assert KbRole.READER == "reader"
