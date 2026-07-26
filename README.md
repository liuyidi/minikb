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

访问 MinIO 控制台：<http://127.0.0.1:9001>（`minioadmin` / `minioadmin`）。

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

## 目录

```
minikb/
  src/minikb/          源码
    api/routes/        FastAPI 路由
    auth/              API Key / JWT
    config/            Settings
    db/                SQLAlchemy models + Alembic
    ingest/            Parser / Cleaner / Chunker / Enricher / Workers
    embedding/         模型抽象
    index/             pgvector / ES
    retrieval/         vector / keyword / hybrid + rerank
    qa/                RAG 编排 + prompt 模板
    connectors/        upload / url / feishu / git / sql
  docker/              docker-compose + Dockerfile
  scripts/             开发/运维脚本
  tests/               pytest
```

## 里程碑

见 `docs/minikb-platform-plan.md`。当前处于 **KB-P0 Skeleton**。

## License

MIT — see [LICENSE](./LICENSE).
