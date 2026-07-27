"""minikb CLI for development and debugging."""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path


def cmd_create_kb(args: argparse.Namespace) -> None:
    """Create a new knowledge base."""
    from minikb.db import KnowledgeBase, Org, get_session
    from minikb.config.settings import get_settings

    async def _create():
        settings = get_settings()
        async for session in get_session():
            # Get default org
            from sqlalchemy import select
            stmt = select(Org).where(Org.slug == settings.default_org_slug)
            result = await session.execute(stmt)
            org = result.scalar_one_or_none()
            if org is None:
                print("Error: Default org not found. Run the server first.")
                return

            # Create KB
            kb = KnowledgeBase(
                id=uuid.uuid4(),
                org_id=org.id,
                name=args.name,
                slug=args.slug or args.name.lower().replace(" ", "-"),
                description=args.description,
            )
            session.add(kb)
            await session.flush()
            print(f"Created KB: {kb.id} ({kb.slug})")
            return

    asyncio.run(_create())


def cmd_list_kbs(args: argparse.Namespace) -> None:
    """List all knowledge bases."""
    from minikb.db import KnowledgeBase, Org, get_session
    from minikb.config.settings import get_settings

    async def _list():
        from sqlalchemy import select
        settings = get_settings()
        async for session in get_session():
            stmt = select(Org).where(Org.slug == settings.default_org_slug)
            result = await session.execute(stmt)
            org = result.scalar_one_or_none()
            if org is None:
                print("No org found.")
                return

            stmt = select(KnowledgeBase).where(KnowledgeBase.org_id == org.id)
            result = await session.execute(stmt)
            kbs = list(result.scalars().all())

            if not kbs:
                print("No knowledge bases found.")
                return

            for kb in kbs:
                print(f"  {kb.id}  {kb.slug:30}  {kb.name}")

    asyncio.run(_list())


def cmd_ingest(args: argparse.Namespace) -> None:
    """Ingest a file into a knowledge base."""
    from minikb.db import KnowledgeBase, get_session
    from minikb.ingest.workers import ingest_file, process_document

    async def _ingest():
        from sqlalchemy import select

        async for session in get_session():
            # Find KB by slug or ID
            try:
                kb_id = uuid.UUID(args.kb)
                stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
            except ValueError:
                stmt = select(KnowledgeBase).where(KnowledgeBase.slug == args.kb)

            result = await session.execute(stmt)
            kb = result.scalar_one_or_none()
            if kb is None:
                print(f"KB not found: {args.kb}")
                return

            # Ingest file
            file_path = Path(args.file)
            if not file_path.exists():
                print(f"File not found: {args.file}")
                return

            print(f"Ingesting {file_path.name} into {kb.slug}...")
            document, job = await ingest_file(kb.id, str(file_path))
            print(f"Document created: {document.id}")
            print(f"Job queued: {job.id}")

            # Process synchronously
            await process_document(document.id, job.id)
            print("Done!")

    asyncio.run(_ingest())


def cmd_search(args: argparse.Namespace) -> None:
    """Search a knowledge base."""
    from minikb.db import KnowledgeBase, get_session
    from minikb.embedding import embed_text
    from minikb.retrieval.search import retrieve

    async def _search():
        from sqlalchemy import select

        async for session in get_session():
            # Find KB
            try:
                kb_id = uuid.UUID(args.kb)
                stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
            except ValueError:
                stmt = select(KnowledgeBase).where(KnowledgeBase.slug == args.kb)

            result = await session.execute(stmt)
            kb = result.scalar_one_or_none()
            if kb is None:
                print(f"KB not found: {args.kb}")
                return

            # Search
            hits, elapsed = await retrieve(
                kb_id=kb.id,
                query=args.query,
                mode=args.mode,
                top_k=args.top_k,
            )

            print(f"\nFound {len(hits)} results in {elapsed:.0f}ms\n")
            for i, hit in enumerate(hits, 1):
                score = hit.get("score", 0)
                print(f"[{i}] Score: {score:.3f}  Doc: {hit.get('doc_title', '?')}")
                text = hit["text"][:200]
                print(f"    {text}...")
                print()

    asyncio.run(_search())


def main() -> None:
    parser = argparse.ArgumentParser(description="minikb CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # create-kb
    create_parser = subparsers.add_parser("create-kb", help="Create a knowledge base")
    create_parser.add_argument("name", help="KB name")
    create_parser.add_argument("--slug", help="URL slug (default: derived from name)")
    create_parser.add_argument("--description", help="KB description")

    # list-kbs
    subparsers.add_parser("list-kbs", help="List knowledge bases")

    # ingest
    ingest_parser = subparsers.add_parser("ingest", help="Ingest a file")
    ingest_parser.add_argument("file", help="File path")
    ingest_parser.add_argument("--kb", required=True, help="KB slug or ID")

    # search
    search_parser = subparsers.add_parser("search", help="Search a KB")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--kb", required=True, help="KB slug or ID")
    search_parser.add_argument("--mode", default="vector", choices=["vector", "keyword", "hybrid"])
    search_parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    if args.command == "create-kb":
        cmd_create_kb(args)
    elif args.command == "list-kbs":
        cmd_list_kbs(args)
    elif args.command == "ingest":
        cmd_ingest(args)
    elif args.command == "search":
        cmd_search(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
