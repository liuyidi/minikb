"""Member management API routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from minikb.api.deps import KbDep, OrgDep, SessionDep
from minikb.auth import check_scope
from minikb.auth.audit import log_audit
from minikb.db import (
    ApiKey,
    DataSourceStatus,
    KbMember,
    KbRole,
    KnowledgeBase,
    OrgMember,
    OrgRole,
    User,
)

router = APIRouter(tags=["members"])


# ─── Schemas ─────────────────────────────────────────────────────────────────


class MemberInvite(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field(default=OrgRole.MEMBER, pattern=r"^(owner|admin|member)$")


class KbMemberInvite(BaseModel):
    user_id: uuid.UUID
    role: str = Field(default=KbRole.READER, pattern=r"^(owner|editor|reader)$")


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    created_at: str

    model_config = {"from_attributes": True}


class KbMemberResponse(BaseModel):
    kb_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: str

    model_config = {"from_attributes": True}


# ─── Org Members ─────────────────────────────────────────────────────────────


@router.get("/v1/org/members", response_model=list[MemberResponse])
async def list_org_members(
    session: SessionDep,
    org: OrgDep,
) -> list[MemberResponse]:
    """List all members of the current organization."""
    stmt = (
        select(OrgMember, User)
        .join(User, OrgMember.user_id == User.id)
        .where(OrgMember.org_id == org.id)
    )
    result = await session.execute(stmt)
    members = []
    for member, user in result.all():
        members.append(MemberResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            role=member.role,
            created_at=member.created_at.isoformat() if member.created_at else "",
        ))
    return members


@router.post("/v1/org/members", status_code=status.HTTP_201_CREATED)
async def invite_org_member(
    body: MemberInvite,
    session: SessionDep,
    org: OrgDep,
) -> dict:
    """Invite a user to the organization."""
    # Find user by email
    stmt = select(User).where(User.email == body.email)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {body.email}",
        )

    # Check if already a member
    stmt = select(OrgMember).where(
        OrgMember.org_id == org.id,
        OrgMember.user_id == user.id,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member",
        )

    member = OrgMember(
        org_id=org.id,
        user_id=user.id,
        role=body.role,
    )
    session.add(member)
    await session.flush()

    # Audit log
    await log_audit(
        session=session,
        org_id=org.id,
        action="member.invite",
        resource_type="org_member",
        resource_id=str(user.id),
        details={"email": body.email, "role": body.role},
    )

    return {"status": "ok", "user_id": str(user.id), "role": body.role}


@router.patch("/v1/org/members/{user_id}")
async def update_org_member_role(
    user_id: uuid.UUID,
    body: dict,
    session: SessionDep,
    org: OrgDep,
) -> dict:
    """Update an org member's role."""
    new_role = body.get("role")
    if new_role not in (OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {new_role}",
        )

    stmt = select(OrgMember).where(
        OrgMember.org_id == org.id,
        OrgMember.user_id == user_id,
    )
    result = await session.execute(stmt)
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    old_role = member.role
    member.role = new_role
    await session.flush()

    await log_audit(
        session=session,
        org_id=org.id,
        action="member.role_change",
        resource_type="org_member",
        resource_id=str(user_id),
        details={"old_role": old_role, "new_role": new_role},
    )

    return {"status": "ok", "user_id": str(user_id), "role": new_role}


@router.delete("/v1/org/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_member(
    user_id: uuid.UUID,
    session: SessionDep,
    org: OrgDep,
) -> None:
    """Remove a member from the organization."""
    stmt = select(OrgMember).where(
        OrgMember.org_id == org.id,
        OrgMember.user_id == user_id,
    )
    result = await session.execute(stmt)
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Don't allow removing the last owner
    if member.role == OrgRole.OWNER:
        owner_count_stmt = select(OrgMember).where(
            OrgMember.org_id == org.id,
            OrgMember.role == OrgRole.OWNER,
        )
        owner_result = await session.execute(owner_count_stmt)
        if len(list(owner_result.scalars().all())) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )

    # Remove user's KB memberships in this org
    kb_member_stmt = select(KbMember).join(
        KnowledgeBase, KbMember.kb_id == KnowledgeBase.id
    ).where(
        KnowledgeBase.org_id == org.id,
        KbMember.user_id == user_id,
    )
    kb_result = await session.execute(kb_member_stmt)
    for kb_member in kb_result.scalars():
        await session.delete(kb_member)

    await session.delete(member)
    await session.flush()

    await log_audit(
        session=session,
        org_id=org.id,
        action="member.remove",
        resource_type="org_member",
        resource_id=str(user_id),
    )


# ─── KB Members ──────────────────────────────────────────────────────────────


@router.get("/v1/kb/{kb_id}/members", response_model=list[KbMemberResponse])
async def list_kb_members(
    session: SessionDep,
    kb: KbDep,
) -> list[KbMemberResponse]:
    """List all members of a knowledge base."""
    stmt = (
        select(KbMember)
        .where(KbMember.kb_id == kb.id)
    )
    result = await session.execute(stmt)
    members = list(result.scalars().all())
    return [
        KbMemberResponse(
            kb_id=m.kb_id,
            user_id=m.user_id,
            role=m.role,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in members
    ]


@router.post("/v1/kb/{kb_id}/members", status_code=status.HTTP_201_CREATED)
async def add_kb_member(
    body: KbMemberInvite,
    session: SessionDep,
    kb: KbDep,
) -> dict:
    """Add a member to a knowledge base."""
    # Check if already a member
    stmt = select(KbMember).where(
        KbMember.kb_id == kb.id,
        KbMember.user_id == body.user_id,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this KB",
        )

    member = KbMember(
        kb_id=kb.id,
        user_id=body.user_id,
        role=body.role,
    )
    session.add(member)
    await session.flush()

    await log_audit(
        session=session,
        org_id=kb.org_id,
        action="kb_member.add",
        resource_type="kb_member",
        resource_id=f"{kb.id}:{body.user_id}",
        details={"kb_id": str(kb.id), "role": body.role},
    )

    return {"status": "ok", "kb_id": str(kb.id), "user_id": str(body.user_id), "role": body.role}


@router.delete("/v1/kb/{kb_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_kb_member(
    user_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Remove a member from a knowledge base."""
    stmt = select(KbMember).where(
        KbMember.kb_id == kb.id,
        KbMember.user_id == user_id,
    )
    result = await session.execute(stmt)
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    await session.delete(member)
    await session.flush()

    await log_audit(
        session=session,
        org_id=kb.org_id,
        action="kb_member.remove",
        resource_type="kb_member",
        resource_id=f"{kb.id}:{user_id}",
    )


# ─── Audit Log ───────────────────────────────────────────────────────────────


@router.get("/v1/audit-logs")
async def list_audit_logs(
    session: SessionDep,
    org: OrgDep,
    limit: int = 50,
    offset: int = 0,
    resource_type: str | None = None,
    action: str | None = None,
) -> list[dict]:
    """List audit logs for the organization."""
    from minikb.auth.audit import get_audit_logs
    events = await get_audit_logs(
        session, org.id,
        limit=limit, offset=offset,
        resource_type=resource_type, action=action,
    )
    return [
        {
            "id": str(e.id),
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "actor_id": str(e.actor_id) if e.actor_id else None,
            "actor_type": e.actor_type,
            "details": e.details,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
