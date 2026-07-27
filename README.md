# minikb

Knowledge base platform for agents — docs, chunking, retrieval and QA in one place.

* 面向 agent / 应用的通用知识库后台
* Postgres + pgvector + Redis + MinIO 单体起步，向多向量库/多租户演进
* 承载文档摄入、切片、向量化、检索（vector / keyword / hybrid + rerank）、RAG 问答与评估
* 独立服务，通过 REST 与 [minibot](https://github.com/liuyidi/minibot) 等消费方集成

架构与实施计划见 [`docs/`](./docs)。

## Quick start

前置：Docker、Python 3.13、[`uv`](https://docs.astral.sh/uv/)。

```bash
# 1. 拉起依赖（postgres+pgvector / redis / minio）
docker compose -f docker/docker-compose.yml up -d

# 2. 装依赖
uv sync

# 3. 配置 env
cp .env.example .env
# 视需要编辑 .env（本地默认可直接跑）

# 4. 起服务
uv run uvicorn minikb.main:app --reload --port 8080

# 5. 验证
curl -s http://127.0.0.1:8080/health
```

访问：
- **Dev UI**: <http://127.0.0.1:8080/ui/>
- **API Docs**: <http://127.0.0.1:8080/docs>
- **MinIO Console**: <http://127.0.0.1:9001> (`minioadmin` / `minioadmin`)

## Usage

### Create a Knowledge Base

```bash
# Via CLI
uv run python -m minikb.cli create-kb "My Docs" --slug my-docs

# Via API
curl -X POST http://localhost:8080/v1/kb \
  -H "Content-Type: application/json" \
  -d '{"name": "My Docs", "slug": "my-docs"}'
```

### Upload Documents

```bash
# Via CLI
uv run python -m minikb.cli ingest ./document.pdf --kb my-docs

# Via API
curl -X POST http://localhost:8080/v1/kb/{kb_id}/documents \
  -F "file=@document.pdf"
```

### Search

```bash
# Via CLI
uv run python -m minikb.cli search "What is RAG?" --kb my-docs

# Via API
curl -X POST http://localhost:8080/v1/kb/{kb_id}/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RAG?", "mode": "vector", "top_k": 5}'
```

### Run E2E Smoke Test

```bash
# Make sure the server is running, then:
uv run python scripts/smoke_test.py --base-url http://localhost:8080
```

## Development

```bash
# 单测
uv run pytest -q

# lint
uv run ruff check .
uv run ruff format --check .

# 类型
uv run mypy src
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET/POST | `/v1/kb` | List / Create KBs |
| GET/PATCH/DELETE | `/v1/kb/{id}` | Get / Update / Delete KB |
| GET | `/v1/kb/{id}/stats` | KB statistics |
| GET/POST | `/v1/kb/{id}/documents` | List / Upload documents |
| GET/DELETE | `/v1/kb/{id}/documents/{doc_id}` | Get / Delete document |
| POST | `/v1/kb/{id}/retrieve` | Search for chunks |
| GET | `/v1/kb/{id}/jobs` | List ingest jobs |
| GET | `/v1/kb/{id}/ingest/events` | SSE job progress |
| GET/POST | `/v1/api-keys` | List / Create API keys |

## 目录

```
minikb/
  src/minikb/          源码
    api/routes/        FastAPI 路由
    auth/              API Key / JWT
    config/            Settings
    db/                SQLAlchemy models + Alembic
    ingest/            Parser / Chunker / Workers
    embedding/         模型抽象 (OpenAI / mock)
    retrieval/         vector / keyword / hybrid search
    ui/static/         Dev UI (single-page HTML)
    cli.py             CLI for dev/debug
    main.py            FastAPI app entry point
  docker/              docker-compose + Dockerfile
  scripts/             smoke test, dev scripts
  tests/               pytest
  docs/                design docs & plans
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    minikb API                        │
│  FastAPI + SQLAlchemy + Alembic                     │
├─────────────────────────────────────────────────────┤
│  KB CRUD │ Upload │ Retrieve │ QA │ Ingest Jobs     │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
     ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
     │  Postgres  │  │  MinIO  │  │   Redis     │
     │ +pgvector  │  │  (S3)   │  │  (queue)    │
     └───────────┘  └─────────┘  └─────────────┘
```

## 里程碑

见 `docs/minikb-platform-plan.md`。当前处于 **KB-P0 Skeleton**。

| Phase | 主题 | 状态 |
|-------|------|------|
| KB-P0 | Skeleton (CRUD + upload + search) | ✅ Done |
| KB-P1 | 摄入完备 (multi-parser, workers) | 🔲 Next |
| KB-P2 | 检索完备 (keyword, hybrid, rerank) | 🔲 |
| KB-P3 | QA Playground | 🔲 |

## License

MIT — see [LICENSE](./LICENSE).
