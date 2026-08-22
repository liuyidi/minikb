"""QA API routes."""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy import delete as sa_delete

from minikb.api.deps import KbDep, SessionDep
from minikb.db import KnowledgeBase
from minikb.qa.prompts import (
    PromptTemplate,
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
    validate_template,
)
from minikb.qa.rag import (
    QALog,
    QALogResponse,
    QAFeedbackRequest,
    QARequest,
    QAResponse,
    answer_question,
    stream_answer,
)

router = APIRouter(tags=["qa"])


# ─── QA Endpoint ─────────────────────────────────────────────────────────────


@router.post("/v1/kb/{kb_id}/qa", response_model=QAResponse)
async def qa_answer(
    body: QARequest,
    session: SessionDep,
    kb: KbDep,
) -> QAResponse:
    """Answer a question using RAG pipeline.

    Retrieves relevant chunks, builds a prompt, calls LLM, and extracts citations.
    """
    # Get custom prompt template if provided
    prompt_template = None
    if body.prompt_template:
        # Validate template
        is_valid, error = validate_template(body.prompt_template)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid prompt template: {error}",
            )
        prompt_template = body.prompt_template

    if body.stream:
        # Streaming mode - return SSE
        return StreamingResponse(  # type: ignore[return-value]
            _qa_stream_wrapper(kb.id, kb.name, body, prompt_template, session),
            media_type="text/event-stream",
        )

    # Non-streaming mode
    result = await answer_question(
        kb_id=kb.id,
        query=body.query,
        kb_name=kb.name,
        top_k=body.top_k,
        mode=body.mode,
        model=body.model,
        prompt_template=prompt_template,
        system_prompt=body.system_prompt,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        filter=body.filter,
        rerank=body.rerank,
        query_rewrite=body.query_rewrite,
        score_threshold=body.score_threshold,
        vector_weight=body.vector_weight,
        keyword_weight=body.keyword_weight,
    )

    # Log the QA interaction
    log = QALog(
        id=uuid.uuid4(),
        kb_id=kb.id,
        query=body.query,
        answer=result.answer,
        citations=[c.model_dump() for c in result.citations],
        model=result.model,
        retrieval_hits=result.retrieval_hits,
        elapsed_ms=int(result.elapsed_ms),
    )
    session.add(log)
    await session.flush()

    return result


async def _qa_stream_wrapper(kb_id, kb_name, body, prompt_template, session):
    """Wrapper to make stream_answer work with StreamingResponse."""
    done_payload: dict | None = None
    async for chunk in stream_answer(
        kb_id=kb_id,
        query=body.query,
        kb_name=kb_name,
        top_k=body.top_k,
        mode=body.mode,
        model=body.model,
        prompt_template=prompt_template,
        system_prompt=body.system_prompt,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        filter=body.filter,
        rerank=body.rerank,
        query_rewrite=body.query_rewrite,
        score_threshold=body.score_threshold,
        vector_weight=body.vector_weight,
        keyword_weight=body.keyword_weight,
    ):
        yield chunk
        if chunk.startswith("data: "):
            try:
                payload = json.loads(chunk[6:].strip())
            except json.JSONDecodeError:
                continue
            if payload.get("event") == "done":
                done_payload = payload

    if done_payload and done_payload.get("answer"):
        log = QALog(
            id=uuid.uuid4(),
            kb_id=kb_id,
            query=body.query,
            answer=done_payload.get("answer"),
            citations=done_payload.get("citations") or [],
            model=done_payload.get("model"),
            retrieval_hits=done_payload.get("retrieval_hits", 0),
            elapsed_ms=int(done_payload.get("elapsed_ms") or 0),
        )
        session.add(log)
        await session.flush()


# ─── QA Logs ─────────────────────────────────────────────────────────────────


@router.get("/v1/kb/{kb_id}/qa/logs", response_model=list[QALogResponse])
async def list_qa_logs(
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[QALogResponse]:
    """List QA interaction logs for a knowledge base."""
    stmt = (
        select(QALog)
        .where(QALog.kb_id == kb.id)
        .order_by(QALog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.delete("/v1/kb/{kb_id}/qa/logs", status_code=status.HTTP_204_NO_CONTENT)
async def clear_qa_logs(
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete all QA logs for a knowledge base."""
    await session.execute(sa_delete(QALog).where(QALog.kb_id == kb.id))
    await session.flush()


@router.delete("/v1/kb/{kb_id}/qa/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qa_log(
    log_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a single QA log entry."""
    stmt = select(QALog).where(QALog.id == log_id, QALog.kb_id == kb.id)
    result = await session.execute(stmt)
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QA log not found",
        )
    await session.delete(log)
    await session.flush()


@router.post("/v1/kb/{kb_id}/qa/logs/{log_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def submit_qa_feedback(
    log_id: uuid.UUID,
    body: QAFeedbackRequest,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Submit feedback (thumbs up/down) for a QA interaction."""
    stmt = select(QALog).where(
        QALog.id == log_id,
        QALog.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    log = result.scalar_one_or_none()

    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QA log not found",
        )

    log.feedback = body.feedback
    await session.flush()


# ─── Prompt Templates ────────────────────────────────────────────────────────


@router.get("/v1/kb/{kb_id}/qa/templates", response_model=list[PromptTemplateResponse])
async def list_prompt_templates(
    session: SessionDep,
    kb: KbDep,
) -> list[PromptTemplateResponse]:
    """List prompt templates for a knowledge base."""
    stmt = (
        select(PromptTemplate)
        .where(PromptTemplate.kb_id == kb.id)
        .order_by(PromptTemplate.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/v1/kb/{kb_id}/qa/templates", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    body: PromptTemplateCreate,
    session: SessionDep,
    kb: KbDep,
) -> PromptTemplateResponse:
    """Create a new prompt template."""
    # Validate template
    is_valid, error = validate_template(body.template)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid template: {error}",
        )

    # If this is set as default, unset other defaults
    if body.is_default:
        stmt = (
            select(PromptTemplate)
            .where(PromptTemplate.kb_id == kb.id, PromptTemplate.is_default == "t")
        )
        result = await session.execute(stmt)
        for existing in result.scalars():
            existing.is_default = "f"

    template = PromptTemplate(
        id=uuid.uuid4(),
        kb_id=kb.id,
        name=body.name,
        template=body.template,
        variables_schema=body.variables_schema,
        is_default="t" if body.is_default else "f",
    )
    session.add(template)
    await session.flush()
    await session.refresh(template)
    return template


@router.patch("/v1/kb/{kb_id}/qa/templates/{template_id}", response_model=PromptTemplateResponse)
async def update_prompt_template(
    template_id: uuid.UUID,
    body: PromptTemplateUpdate,
    session: SessionDep,
    kb: KbDep,
) -> PromptTemplateResponse:
    """Update a prompt template."""
    stmt = select(PromptTemplate).where(
        PromptTemplate.id == template_id,
        PromptTemplate.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    template = result.scalar_one_or_none()

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    if body.template is not None:
        is_valid, error = validate_template(body.template)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid template: {error}",
            )
        template.template = body.template

    if body.name is not None:
        template.name = body.name
    if body.variables_schema is not None:
        template.variables_schema = body.variables_schema
    if body.is_default is not None:
        if body.is_default:
            # Unset other defaults
            stmt = (
                select(PromptTemplate)
                .where(PromptTemplate.kb_id == kb.id, PromptTemplate.is_default == "t")
            )
            result = await session.execute(stmt)
            for existing in result.scalars():
                if existing.id != template.id:
                    existing.is_default = "f"
        template.is_default = "t" if body.is_default else "f"

    await session.flush()
    await session.refresh(template)
    return template


@router.delete("/v1/kb/{kb_id}/qa/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_template(
    template_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a prompt template."""
    stmt = select(PromptTemplate).where(
        PromptTemplate.id == template_id,
        PromptTemplate.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    template = result.scalar_one_or_none()

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    await session.delete(template)
    await session.flush()
