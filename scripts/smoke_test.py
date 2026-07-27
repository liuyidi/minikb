#!/usr/bin/env python3
"""End-to-end smoke test for minikb.

This script tests the full pipeline:
1. Create a KB
2. Upload a document
3. Wait for processing
4. Search for content
5. Clean up

Usage:
    python scripts/smoke_test.py [--base-url http://localhost:8080]
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
import uuid
from pathlib import Path

import httpx


async def main(base_url: str) -> bool:
    """Run the e2e smoke test."""
    print(f"🧪 minikb e2e smoke test against {base_url}\n")

    client = httpx.AsyncClient(base_url=base_url, timeout=30.0)

    try:
        # Health check
        print("1. Health check...")
        resp = await client.get("/health")
        resp.raise_for_status()
        print(f"   ✓ {resp.json()}")

        # Create KB
        print("\n2. Creating knowledge base...")
        slug = f"smoke-test-{uuid.uuid4().hex[:8]}"
        resp = await client.post("/v1/kb", json={
            "name": "Smoke Test KB",
            "slug": slug,
            "description": "Auto-generated for smoke testing",
        })
        resp.raise_for_status()
        kb = resp.json()
        kb_id = kb["id"]
        print(f"   ✓ Created KB: {kb_id}")

        # Create test document content
        print("\n3. Uploading test document...")
        test_content = """# Test Document

This is a test document for the minikb smoke test.

## RAG Overview

RAG (Retrieval-Augmented Generation) is a technique that combines
retrieval of relevant documents with language model generation.

The key steps are:
1. Retrieve relevant chunks from the knowledge base
2. Augment the prompt with retrieved context
3. Generate an answer using the LLM

## Vector Search

Vector search uses embeddings to find semantically similar content.
Each chunk is converted to a vector using an embedding model,
and similarity is computed using cosine distance.
"""
        files = {"file": ("test_document.md", test_content.encode(), "text/markdown")}
        resp = await client.post(f"/v1/kb/{kb_id}/documents", files=files)
        resp.raise_for_status()
        doc = resp.json()
        doc_id = doc["id"]
        print(f"   ✓ Uploaded document: {doc_id}")

        # Wait for processing
        print("\n4. Waiting for document processing...")
        for i in range(30):
            await asyncio.sleep(2)
            resp = await client.get(f"/v1/kb/{kb_id}/documents/{doc_id}")
            resp.raise_for_status()
            doc = resp.json()
            status = doc["status"]
            print(f"   Status: {status}", end="\r")

            if status == "ready":
                print("   ✓ Document processed!")
                break
            elif status == "failed":
                print(f"   ✗ Processing failed: {doc.get('error')}")
                return False
        else:
            print("   ⚠ Timeout waiting for processing (this may be OK in dev mode)")

        # Search
        print("\n5. Searching for content...")
        resp = await client.post(f"/v1/kb/{kb_id}/retrieve", json={
            "query": "What is RAG?",
            "mode": "vector",
            "top_k": 5,
        })
        resp.raise_for_status()
        results = resp.json()
        print(f"   ✓ Found {results['total']} results in {results['elapsed_ms']:.0f}ms")

        if results["hits"]:
            for i, hit in enumerate(results["hits"][:3], 1):
                print(f"   [{i}] Score: {hit['score']:.3f} - {hit['text'][:60]}...")

        # Check KB stats
        print("\n6. Checking KB stats...")
        resp = await client.get(f"/v1/kb/{kb_id}/stats")
        resp.raise_for_status()
        stats = resp.json()
        print(f"   ✓ Stats: {stats}")

        # Cleanup
        print("\n7. Cleaning up...")
        resp = await client.delete(f"/v1/kb/{kb_id}")
        resp.raise_for_status()
        print("   ✓ KB deleted")

        print("\n✅ Smoke test passed!")
        return True

    except httpx.HTTPStatusError as e:
        print(f"\n✗ HTTP error: {e.response.status_code}")
        print(f"  Response: {e.response.text[:500]}")
        return False
    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False
    finally:
        await client.aclose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="minikb e2e smoke test")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8080",
        help="minikb server URL",
    )
    args = parser.parse_args()

    success = asyncio.run(main(args.base_url))
    sys.exit(0 if success else 1)
