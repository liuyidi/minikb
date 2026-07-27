"""minibot tool definitions for minikb integration.

These tools are registered with minibot's tool registry when the
knowledge-base plugin is enabled.
"""
from __future__ import annotations

from typing import Any

# Tool definitions following the minibot tool spec
TOOLS: list[dict[str, Any]] = [
    {
        "name": "kb_list",
        "description": "List all available knowledge bases. Returns id, name, description, and stats for each KB.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
        "requires_approval": False,
        "category": "knowledge",
    },
    {
        "name": "kb_search",
        "description": (
            "Search a knowledge base for relevant document chunks. "
            "Returns ranked results with scores. Use this to find specific information. "
            "Only performs read-only retrieval - no modifications."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kb_id": {
                    "type": "string",
                    "description": "Knowledge base ID to search in",
                },
                "query": {
                    "type": "string",
                    "description": "Search query",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to return (default: 5)",
                    "default": 5,
                },
                "mode": {
                    "type": "string",
                    "enum": ["vector", "keyword", "hybrid"],
                    "description": "Search mode (default: hybrid)",
                    "default": "hybrid",
                },
            },
            "required": ["kb_id", "query"],
        },
        "requires_approval": False,
        "category": "knowledge",
    },
    {
        "name": "kb_answer",
        "description": (
            "Ask a question and get an AI-generated answer based on knowledge base content. "
            "The answer includes citations to source chunks. "
            "Use this for complex questions that need synthesis from multiple documents."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kb_id": {
                    "type": "string",
                    "description": "Knowledge base ID to query",
                },
                "query": {
                    "type": "string",
                    "description": "Question to answer",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of context chunks to retrieve (default: 6)",
                    "default": 6,
                },
            },
            "required": ["kb_id", "query"],
        },
        "requires_approval": True,  # QA uses LLM, may need approval
        "category": "knowledge",
    },
]


async def execute_kb_list(client: Any) -> dict[str, Any]:
    """Execute kb_list tool."""
    try:
        kbs = await client.list_kbs()
        return {
            "status": "ok",
            "knowledge_bases": [
                {
                    "id": kb.id,
                    "name": kb.name,
                    "description": kb.description,
                    "kind": kb.kind,
                    "documents": kb.stats.get("documents", 0),
                    "chunks": kb.stats.get("chunks", 0),
                }
                for kb in kbs
            ],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def execute_kb_search(client: Any, kb_id: str, query: str, top_k: int = 5, mode: str = "hybrid") -> dict[str, Any]:
    """Execute kb_search tool."""
    try:
        hits = await client.search(kb_id, query, top_k=top_k, mode=mode)
        return {
            "status": "ok",
            "query": query,
            "hits": [
                {
                    "score": round(hit.score, 3),
                    "doc_title": hit.doc_title,
                    "text": hit.text[:500],  # Truncate for context window
                    "chunk_id": hit.chunk_id,
                }
                for hit in hits
            ],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def execute_kb_answer(client: Any, kb_id: str, query: str, top_k: int = 6) -> dict[str, Any]:
    """Execute kb_answer tool."""
    try:
        result = await client.qa(kb_id, query, top_k=top_k)
        return {
            "status": "ok",
            "query": query,
            "answer": result.answer,
            "citations": [
                {
                    "index": c.get("index"),
                    "doc_title": c.get("doc_title"),
                    "chunk_id": c.get("chunk_id"),
                }
                for c in result.citations
            ],
            "model": result.model,
            "faithfulness": result.faithfulness_score,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
