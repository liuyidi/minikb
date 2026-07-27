"""API routes package."""
from minikb.api.routes.api_keys import router as api_keys_router
from minikb.api.routes.chunks import router as chunks_router
from minikb.api.routes.data_sources import router as data_sources_router
from minikb.api.routes.documents import router as documents_router
from minikb.api.routes.eval import router as eval_router
from minikb.api.routes.ingest import router as ingest_router
from minikb.api.routes.knowledge_bases import router as kb_router
from minikb.api.routes.members import router as members_router
from minikb.api.routes.qa import router as qa_router
from minikb.api.routes.retrieval import router as retrieval_router
from minikb.api.routes.settings import router as settings_router

__all__ = [
    "kb_router",
    "api_keys_router",
    "documents_router",
    "chunks_router",
    "retrieval_router",
    "ingest_router",
    "qa_router",
    "data_sources_router",
    "members_router",
    "eval_router",
    "settings_router",
]
