"""Prompt template system for QA.

Uses a simple Jinja2-like syntax but implemented with Python's re module
to avoid external dependencies. Supports:
- {{ variable }} - variable substitution
- {% for item in list %}...{% endfor %} - loops
- {% if condition %}...{% endif %} - conditionals
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import mapped_column

from minikb.db.base import Base
from minikb.db.models import new_uuid


# ─── Database Model ──────────────────────────────────────────────────────────


class PromptTemplate(Base):
    """Stored prompt template for a knowledge base."""
    __tablename__ = "prompt_templates"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    kb_id = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    name = mapped_column(String(200), nullable=False)
    template = mapped_column(Text, nullable=False)
    variables_schema = mapped_column(JSONB, nullable=False, default=dict)
    is_default = mapped_column(String(1), nullable=False, default="f")  # 't' or 'f'
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    template: str = Field(..., min_length=1)
    variables_schema: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False


class PromptTemplateUpdate(BaseModel):
    name: str | None = None
    template: str | None = None
    variables_schema: dict[str, Any] | None = None
    is_default: bool | None = None


class PromptTemplateResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    name: str
    template: str
    variables_schema: dict[str, Any]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Default Templates ───────────────────────────────────────────────────────


DEFAULT_QA_TEMPLATE = """\
你是 {{ kb_name }} 的智能助手。请只基于下面提供的片段回答用户问题。
如果片段不足以回答问题，请明确说"根据已有信息无法回答"。
不要编造片段中没有的信息。

【检索到的片段】
{% for hit in hits %}
[{{ loop.index }}] 来源：{{ hit.doc_title or '未命名文档' }}

{{ hit.text }}
{% endfor %}

【用户问题】{{ query }}

【要求】
- 回答中引用片段时使用 [片段编号] 格式，例如 [1]、[2]
- 在回答末尾列出所有用到的片段编号
- 如果无法回答，直接说"根据已有信息无法回答"
"""

DEFAULT_QA_TEMPLATE_EN = """\
You are an intelligent assistant for {{ kb_name }}. Answer the user's question \
based ONLY on the provided context snippets below.
If the snippets are insufficient to answer the question, clearly state \
"Based on the available information, I cannot answer this."
Do not fabricate information not present in the snippets.

【Context Snippets】
{% for hit in hits %}
[{{ loop.index }}] Source: {{ hit.doc_title or 'Untitled' }}

{{ hit.text }}
{% endfor %}

【Question】{{ query }}

【Requirements】
- Cite snippets using [number] format, e.g. [1], [2]
- List all cited snippet numbers at the end of your answer
- If unable to answer, state "Based on the available information, I cannot answer this."
"""


# ─── Template Engine ─────────────────────────────────────────────────────────


def _resolve_dotted(obj: Any, path: str) -> Any:
    """Resolve a dotted path like 'hit.doc_title' or 'meta.heading_path'."""
    parts = path.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part, "")
        elif hasattr(current, part):
            current = getattr(current, part)
        else:
            return ""
    return current


def _render_for(template: str, var_name: str, iterable: list, loop_body: str, context: dict) -> str:
    """Render a for loop block."""
    result_parts = []
    for i, item in enumerate(iterable):
        loop_ctx = dict(context)
        loop_ctx[var_name] = item
        # Add loop variable
        loop_ctx["loop"] = {
            "index": i + 1,
            "index0": i,
            "first": i == 0,
            "last": i == len(iterable) - 1,
            "length": len(iterable),
        }
        rendered = _render_template(loop_body, loop_ctx)
        result_parts.append(rendered)
    return "".join(result_parts)


def _render_if(template: str, condition: str, if_body: str, else_body: str, context: dict) -> str:
    """Render an if/else block."""
    # Simple truthiness check
    cond_value = _resolve_expr(condition.strip(), context)
    if cond_value:
        return _render_template(if_body, context)
    elif else_body:
        return _render_template(else_body, context)
    return ""


def _resolve_expr(expr: str, context: dict) -> Any:
    """Resolve a simple expression."""
    expr = expr.strip()
    if not expr:
        return False

    # Handle 'or'
    if " or " in expr:
        parts = expr.split(" or ")
        return any(_resolve_expr(p, context) for p in parts)

    # Handle 'and'
    if " and " in expr:
        parts = expr.split(" and ")
        return all(_resolve_expr(p, context) for p in parts)

    # Handle 'not'
    if expr.startswith("not "):
        return not _resolve_expr(expr[4:], context)

    # Handle comparison
    for op in ["==", "!=", ">=", "<=", ">", "<"]:
        if op in expr:
            left, right = expr.split(op, 1)
            left_val = _resolve_expr(left.strip(), context)
            right_val = _resolve_expr(right.strip(), context)
            if op == "==":
                return left_val == right_val
            elif op == "!=":
                return left_val != right_val
            elif op == ">=":
                return left_val >= right_val
            elif op == "<=":
                return left_val <= right_val
            elif op == ">":
                return left_val > right_val
            elif op == "<":
                return left_val < right_val

    # Handle string literal
    if (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
        return expr[1:-1]

    # Handle number
    try:
        if "." in expr:
            return float(expr)
        return int(expr)
    except ValueError:
        pass

    # Handle variable
    return _resolve_dotted(context, expr)


def _render_template(template: str, context: dict) -> str:
    """Render a template string with the given context."""
    result = template

    # Process for loops: {% for item in list %}...{% endfor %}
    for_pattern = re.compile(r"\{%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*%\}(.*?)\{%\s*endfor\s*%\}", re.DOTALL)
    while for_pattern.search(result):
        match = for_pattern.search(result)
        if match:
            var_name = match.group(1)
            list_name = match.group(2)
            loop_body = match.group(3)
            iterable = _resolve_dotted(context, list_name)
            if not isinstance(iterable, (list, tuple)):
                iterable = []
            rendered = _render_for(result, var_name, list(iterable), loop_body, context)
            result = result[:match.start()] + rendered + result[match.end():]
        else:
            break

    # Process if/else: {% if condition %}...{% else %}...{% endif %}
    if_pattern = re.compile(
        r"\{%\s*if\s+(.+?)\s*%\}(.*?)(?:\{%\s*else\s*%\}(.*?))?\{%\s*endif\s*%\}",
        re.DOTALL,
    )
    while if_pattern.search(result):
        match = if_pattern.search(result)
        if match:
            condition = match.group(1)
            if_body = match.group(2)
            else_body = match.group(3) or ""
            rendered = _render_if(result, condition, if_body, else_body, context)
            result = result[:match.start()] + rendered + result[match.end():]
        else:
            break

    # Process variables: {{ expr }}
    var_pattern = re.compile(r"\{\{\s*(.+?)\s*\}\}")

    def replace_var(match: re.Match) -> str:
        expr = match.group(1).strip()

        # Handle 'or' for default values: {{ var or 'default' }}
        if " or " in expr:
            parts = expr.split(" or ")
            for part in parts:
                val = _resolve_expr(part.strip(), context)
                if val:
                    return str(val)
            return ""

        # Handle method calls like | join(' > ')
        if "|" in expr:
            var_part, filter_part = expr.split("|", 1)
            var_part = var_part.strip()
            filter_part = filter_part.strip()
            value = _resolve_expr(var_part, context)

            if filter_part.startswith("join("):
                sep_match = re.match(r"join\(['\"](.+?)['\"]\)", filter_part)
                if sep_match and isinstance(value, (list, tuple)):
                    return sep_match.group(1).join(str(v) for v in value)
            return str(value) if value else ""

        value = _resolve_expr(expr, context)
        return str(value) if value is not None else ""

    result = var_pattern.sub(replace_var, result)

    return result


class TemplateEngine:
    """Simple Jinja2-like template engine."""

    def render(self, template_str: str, **variables: Any) -> str:
        """Render a template string with variables."""
        return _render_template(template_str, variables)

    def validate(self, template_str: str) -> tuple[bool, str | None]:
        """Validate a template string."""
        try:
            # Check for balanced tags
            for_tags = len(re.findall(r"\{%\s*for\b", template_str))
            endfor_tags = len(re.findall(r"\{%\s*endfor\s*%\}", template_str))
            if for_tags != endfor_tags:
                return False, "Unbalanced for/endfor tags"

            if_tags = len(re.findall(r"\{%\s*if\b", template_str))
            endif_tags = len(re.findall(r"\{%\s*endif\s*%\}", template_str))
            if if_tags != endif_tags:
                return False, "Unbalanced if/endif tags"

            # Try a test render
            _render_template(template_str, {})
            return True, None
        except Exception as e:
            return False, str(e)

    def extract_variables(self, template_str: str) -> list[str]:
        """Extract variable names from a template."""
        var_pattern = re.compile(r"\{\{\s*([\w.]+)")
        vars_found = set()
        for match in var_pattern.finditer(template_str):
            vars_found.add(match.group(1).split(".")[0])
        return sorted(vars_found)


# Singleton engine
_engine = TemplateEngine()


def render_prompt(template: str, **variables: Any) -> str:
    """Render a prompt template with variables."""
    return _engine.render(template, **variables)


def validate_template(template: str) -> tuple[bool, str | None]:
    """Validate a prompt template."""
    return _engine.validate(template)


def get_default_template(language: str = "zh") -> str:
    """Get the default QA prompt template."""
    if language == "en":
        return DEFAULT_QA_TEMPLATE_EN
    return DEFAULT_QA_TEMPLATE
