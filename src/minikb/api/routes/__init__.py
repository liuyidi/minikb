"""API routes package."""
from minikb.api.routes.api_keys import router as api_keys_router
from minikb.api.routes.documents import router as documents_router
from minikb.api.routes.ingest import router as ingest_router
from minikb.api.routes.knowledge_bases import router as kb_router
from minikb.api.routes.retrieval import router as retrieval_router

__all__ = ["kb_router", "api_keys_router", "documents_router", "retrieval_router", "ingest_router"]
