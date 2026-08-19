"""Authentication and authorization."""
from minikb.auth.api_key import (
    check_scope,
    create_dev_api_key,
    create_jwt_api_key,
    generate_api_key,
    get_api_key_from_header,
    hash_secret,
    looks_like_jwt,
    require_api_key,
    require_scope,
    verify_secret,
)
from minikb.auth.audit import AuditEvent, get_audit_logs, log_audit

__all__ = [
    "generate_api_key",
    "hash_secret",
    "verify_secret",
    "get_api_key_from_header",
    "require_api_key",
    "create_dev_api_key",
    "create_jwt_api_key",
    "looks_like_jwt",
    "check_scope",
    "require_scope",
    "AuditEvent",
    "log_audit",
    "get_audit_logs",
]
