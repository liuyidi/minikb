"""QA module - RAG pipeline for question answering."""
from minikb.qa.prompts import (
    PromptTemplate,
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
    TemplateEngine,
    get_default_template,
    render_prompt,
    validate_template,
)
from minikb.qa.rag import (
    Citation,
    QALog,
    QALogResponse,
    QARequest,
    QAResponse,
    answer_question,
    compute_faithfulness,
    extract_citations,
    stream_answer,
)

__all__ = [
    # Prompts
    "PromptTemplate",
    "PromptTemplateCreate",
    "PromptTemplateResponse",
    "PromptTemplateUpdate",
    "TemplateEngine",
    "get_default_template",
    "render_prompt",
    "validate_template",
    # RAG
    "QALog",
    "QALogResponse",
    "QARequest",
    "QAResponse",
    "Citation",
    "answer_question",
    "stream_answer",
    "extract_citations",
    "compute_faithfulness",
]
