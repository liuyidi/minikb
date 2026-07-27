# minikb · 后续功能规划 (Backlog)

> P0-P7 已完成，以下为待实现功能池。按优先级排列。

## 优先级 P0：核心管道

### 摄入管道增强
- [ ] **RQ Worker 落地** — 替换 BackgroundTasks，支持多 queue (cpu/embed/index)、重启不丢任务
- [ ] **批量 embedding** — 当前逐条调 API，1k 文档性能瓶颈，改为 batch (每次 50-100 条)
- [ ] **失败重试 + 退避策略** — ingest_jobs 表 attempts/attempts_max，指数退避
- [ ] **文档级操作 API** — POST /documents/{id}/reparse, /rechunk, /reembed
- [ ] **大文件分片上传** — >100MB 文件分片 + 断点续传
- [ ] **OCR 集成** — tesseract 处理扫描 PDF / 图片
- [ ] **摄入进度条 UI** — 精确百分比 + ETA 预估

### 检索增强
- [ ] **查询改写 (Query Rewriting)** — 用 LLM 扩展查询词，提升召回率
- [ ] **对话上下文检索** — 多轮 QA 自动拼接历史作为 query
- [ ] **向量索引重建工具** — IVFFlat lists 参数调优 CLI
- [ ] **降级策略** — 向量库故障 → 自动回退关键词，retrieval.mode.effective 透明化
- [ ] **跨 KB 联合检索** — 一次搜多个 KB，合并排序
- [ ] **Elasticsearch 后端** — 当数据量超过 pg 舒适区时切换

### QA 增强
- [ ] **Multi-hop QA** — 多次检索 + 推理循环
- [ ] **Agentic RAG** — agent 判断是否需要再次检索
- [ ] **答案缓存** — 相同 query+KB 不重复调 LLM (TTL 可配)
- [ ] **多模型对比** — playground 并排看不同模型回答
- [ ] **结构化输出模式** — JSON mode，方便下游程序消费
- [ ] **对话记忆** — 上下文窗口管理，自动压缩历史

---

## 优先级 P1：数据源 & 集成

### 数据源扩展
- [ ] **飞书 connector** — OAuth2 + tenant_access_token，space/wiki/docx 三入口
- [ ] **定时同步调度器** — cron 表达式 → APScheduler / RQ Scheduler
- [ ] **Notion connector** — API v2022-06-28，page/database/block 递归
- [ ] **Confluence connector** — REST API + CQL 查询
- [ ] **Slack connector** — 公开频道消息摄入
- [ ] **增量同步优化** — diff-based，只处理 updated_time 变化的文档
- [ ] **Webhook 触发同步** — 外部系统推送事件触发

### 外部集成
- [ ] **minibot 深度集成** — Expert overlay 绑定，会话内自动启用 kb_* 工具
- [ ] **MCP Server 模式** — minikb 作为 MCP tool provider，任何 MCP client 可接入
- [ ] **Webhook 通知** — 摄入完成/失败推送到飞书/钉钉/Slack
- [ ] **REST API SDK** — Python/JS/Go 客户端包

---

## 优先级 P2：可观测性 & 运维

### 可观测性
- [ ] **OpenTelemetry tracing** — retrieve.vector, retrieve.rerank, qa.generate 各 span
- [ ] **结构化日志** — JSON 格式 + request_id + kb_id + actor + elapsed_ms
- [ ] **性能面板** — embedding QPS、检索延迟 P95、摄入队列 lag
- [ ] **错误告警** — webhook / 飞书通知
- [ ] **Prometheus metrics** — ingest_jobs_lag, embedding_qps, retrieval_latency_p95
- [ ] **Grafana 仪表盘 JSON** — 开箱即用

### 运维 (KB-P8)
- [ ] **Docker 生产级 compose** — web + worker 分离，health check
- [ ] **Helm chart 骨架** — K8s 部署
- [ ] **数据备份** — pg_dump + MinIO 快照 + 恢复剧本
- [ ] **导入导出** — KB 级 zip（含 chunks + embeddings 元数据）
- [ ] **升级路径** — alembic 自动升级 + 兼容策略
- [ ] **健康检查增强** — /health/ready + /health/live，依赖检查

---

## 优先级 P3：用户体验

### UI/UX
- [ ] **Dashboard 首页** — 跨 KB 概览：总文档数、总 chunk 数、最近活动
- [ ] **暗色模式** — CSS 变量切换
- [ ] **国际化 (i18n)** — 中英文完整覆盖
- [ ] **移动端适配** — 响应式布局
- [ ] **快捷键** — Cmd+K 全局搜索，Cmd+N 新建
- [ ] **文档对比视图** — 原文 vs 切片并排
- [ ] **拖拽排序 chunk** — 手动调整切片顺序
- [ ] **批量操作** — 多选删除/重嵌入/改策略
- [ ] **实时进度推送** — WebSocket 替代轮询

---

## 优先级 P4：安全 & 合规

- [ ] **SSO 集成** — OIDC / SAML，企业登录
- [ ] **数据加密** — at-rest (pg crypto) + in-transit (TLS)
- [ ] **数据脱敏 / PII 检测** — 自动识别并脱敏手机号/身份证/邮箱
- [ ] **细粒度审计** — 谁搜了什么、问了什么，审计日志查询 UI
- [ ] **API Rate Limiting** — 按 API Key 限速
- [ ] **IP 白名单** — 生产环境限制访问来源
- [ ] **数据保留策略** — 自动清理过期文档/chunk

---

## 技术债务

- [ ] **单测覆盖** — 目前 165 tests，目标 >80% 行覆盖
- [ ] **mypy strict** — 全模块类型注解
- [ ] **API 版本化** — /v2 路由，破坏性改动走新版本
- [ ] **OpenAPI 文档完善** — 所有 endpoint 加 example + description
- [ ] **集成测试** — docker-compose 起全套，跑 e2e smoke
- [ ] **CI/CD** — GitHub Actions：lint + test + build + deploy
