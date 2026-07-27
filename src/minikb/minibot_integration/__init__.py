"""minibot integration package.

Provides KbClient SDK and tool definitions for connecting minikb
with minibot's agent framework.
"""
from minikb.minibot_integration.client import KbClient, KbInfo, QAResult, SearchHit
from minikb.minibot_integration.tools import (
    TOOLS,
    execute_kb_answer,
    execute_kb_list,
    execute_kb_search,
)

__all__ = [
    "KbClient",
    "KbInfo",
    "SearchHit",
    "QAResult",
    "TOOLS",
    "execute_kb_list",
    "execute_kb_search",
    "execute_kb_answer",
]
