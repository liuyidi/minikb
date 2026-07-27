"""Filter DSL - mongo-like query syntax for metadata filtering.

Supports:
  - Equality: {"meta.page": 5}
  - Comparison: {"meta.page": {"$gt": 5, "$lte": 10}}
  - String match: {"meta.tags": {"$in": ["python", "ml"]}}
  - Logical: {"$and": [...], "$or": [...]}
  - Exists: {"meta.author": {"$exists": true}}

Translates to SQLAlchemy filter expressions for PostgreSQL JSONB.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import and_, or_, text
from sqlalchemy.sql import ColumnElement


# Operators supported in the DSL
COMPARISON_OPS = {
    "$eq": "=",
    "$ne": "!=",
    "$gt": ">",
    "$gte": ">=",
    "$lt": "<",
    "$lte": "<=",
}

ARRAY_OPS = {"$in", "$nin"}

LOGICAL_OPS = {"$and", "$or", "$not"}


class FilterError(Exception):
    """Error in filter expression."""
    pass


def parse_filter(filter_dict: dict[str, Any]) -> str:
    """Parse a filter dict into a SQL WHERE clause string.

    Returns a SQL fragment that can be used with SQLAlchemy text().
    The returned SQL uses :param_N placeholders for parameters.

    Example:
        parse_filter({"meta.page": {"$gt": 5}})
        → ("chunks.meta->>'page' > :p0", {"p0": 5})
    """
    conditions, params = _parse_expression(filter_dict, 0)
    return conditions, params


def _parse_expression(expr: dict[str, Any], param_idx: int) -> tuple[str, dict[str, Any]]:
    """Parse a filter expression recursively."""
    if not expr:
        return "TRUE", {}

    parts: list[str] = []
    params: dict[str, Any] = {}

    for key, value in expr.items():
        # Logical operators
        if key == "$and":
            if not isinstance(value, list) or not value:
                raise FilterError(f"$and requires a non-empty array, got: {value}")
            sub_parts = []
            for sub_expr in value:
                sub_sql, sub_params = _parse_expression(sub_expr, param_idx)
                # Remap param indices
                remapped_params = {}
                for k, v in sub_params.items():
                    new_key = f"p{param_idx}"
                    remapped_params[new_key] = v
                    sub_sql = sub_sql.replace(k, new_key)
                    param_idx += 1
                sub_parts.append(f"({sub_sql})")
                params.update(remapped_params)
            parts.append(f"({' AND '.join(sub_parts)})")

        elif key == "$or":
            if not isinstance(value, list) or not value:
                raise FilterError(f"$or requires a non-empty array, got: {value}")
            sub_parts = []
            for sub_expr in value:
                sub_sql, sub_params = _parse_expression(sub_expr, param_idx)
                remapped_params = {}
                for k, v in sub_params.items():
                    new_key = f"p{param_idx}"
                    remapped_params[new_key] = v
                    sub_sql = sub_sql.replace(k, new_key)
                    param_idx += 1
                sub_parts.append(f"({sub_sql})")
                params.update(remapped_params)
            parts.append(f"({' OR '.join(sub_parts)})")

        elif key == "$not":
            if not isinstance(value, dict):
                raise FilterError(f"$not requires an object, got: {value}")
            sub_sql, sub_params = _parse_expression(value, param_idx)
            remapped_params = {}
            for k, v in sub_params.items():
                new_key = f"p{param_idx}"
                remapped_params[new_key] = v
                sub_sql = sub_sql.replace(k, new_key)
                param_idx += 1
            parts.append(f"NOT ({sub_sql})")
            params.update(remapped_params)

        # Field conditions
        else:
            field_sql, field_params = _parse_field_condition(key, value, param_idx)
            parts.append(field_sql)
            params.update(field_params)
            param_idx += len(field_params)

    if not parts:
        return "TRUE", {}

    return " AND ".join(parts), params


def _parse_field_condition(
    field: str,
    value: Any,
    param_idx: int,
) -> tuple[str, dict[str, Any]]:
    """Parse a field condition like 'meta.page' with various operators."""
    # Determine the JSON path
    json_path = _field_to_json_path(field)

    # If value is a dict, it contains operators
    if isinstance(value, dict):
        return _parse_operators(json_path, value, param_idx)

    # Simple equality
    param_key = f"p{param_idx}"
    if isinstance(value, str):
        return f"{json_path} = :{param_key}", {param_key: value}
    elif isinstance(value, (int, float)):
        return f"({json_path})::numeric = :{param_key}", {param_key: value}
    elif isinstance(value, bool):
        return f"({json_path})::boolean = :{param_key}", {param_key: value}
    else:
        return f"{json_path} = :{param_key}", {param_key: str(value)}


def _field_to_json_path(field: str) -> str:
    """Convert a field name like 'meta.page' to a JSONB access expression."""
    parts = field.split(".")

    if len(parts) == 1:
        # Top-level field (not in meta)
        if parts[0] in ("doc_title", "doc_uri", "document_id", "chunk_id"):
            return f"d.{parts[0]}" if parts[0].startswith("doc_") else f"c.{parts[0]}"
        return f"c.{parts[0]}"

    # Nested field in meta
    if parts[0] == "meta":
        # Build JSONB path: chunks.meta->>'key' or chunks.meta->'key1'->>'key2'
        if len(parts) == 2:
            return f"c.meta->>'{parts[1]}'"
        else:
            path = "c.meta"
            for i, part in enumerate(parts[1:-1]):
                path += f"->'{part}'"
            path += f"->>'{parts[-1]}'"
            return path

    # Other nested fields
    path = f"c.{parts[0]}"
    for i, part in enumerate(parts[1:-1]):
        path += f"->'{part}'"
    path += f"->>'{parts[-1]}'"
    return path


def _parse_operators(
    json_path: str,
    operators: dict[str, Any],
    param_idx: int,
) -> tuple[str, dict[str, Any]]:
    """Parse comparison/array operators for a field."""
    parts: list[str] = []
    params: dict[str, Any] = {}

    for op, value in operators.items():
        if op in COMPARISON_OPS:
            sql_op = COMPARISON_OPS[op]
            param_key = f"p{param_idx}"
            if isinstance(value, (int, float)):
                parts.append(f"({json_path})::numeric {sql_op} :{param_key}")
            else:
                parts.append(f"{json_path} {sql_op} :{param_key}")
            params[param_key] = value
            param_idx += 1

        elif op == "$in":
            if not isinstance(value, list):
                raise FilterError(f"$in requires an array, got: {value}")
            param_key = f"p{param_idx}"
            parts.append(f"{json_path} = ANY(ARRAY[:{param_key}])")
            params[param_key] = value[0] if len(value) == 1 else value
            param_idx += 1

        elif op == "$nin":
            if not isinstance(value, list):
                raise FilterError(f"$nin requires an array, got: {value}")
            param_key = f"p{param_idx}"
            parts.append(f"{json_path} != ALL(ARRAY[:{param_key}])")
            params[param_key] = value
            param_idx += 1

        elif op == "$exists":
            if value:
                parts.append(f"{json_path} IS NOT NULL")
            else:
                parts.append(f"{json_path} IS NULL")

        elif op == "$regex":
            param_key = f"p{param_idx}"
            parts.append(f"{json_path} ~ :{param_key}")
            params[param_key] = str(value)
            param_idx += 1

        elif op == "$contains":
            param_key = f"p{param_idx}"
            parts.append(f"{json_path} ILIKE :{param_key}")
            params[param_key] = f"%{value}%"
            param_idx += 1

        else:
            raise FilterError(f"Unknown operator: {op}")

    if not parts:
        return "TRUE", {}

    return " AND ".join(parts), params


def apply_filter_to_sql(filter_dict: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Convert a filter dict to a SQL WHERE clause.

    Returns:
        (sql_clause, params) tuple
    """
    return parse_filter(filter_dict)


def validate_filter(filter_dict: dict[str, Any]) -> tuple[bool, str | None]:
    """Validate a filter expression.

    Returns:
        (is_valid, error_message)
    """
    try:
        parse_filter(filter_dict)
        return True, None
    except FilterError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Invalid filter: {e}"
