# minikb 切 Next.js（nginx 拆分）设计规格

> Spec for migrating minikb’s admin UI from the FastAPI-mounted `/ui` SPA to a Next.js App Router app, with host nginx splitting `/v1` → FastAPI and `/` → Next standalone, plus mini-auth login and real `/kb/[id]/…` routes.

**Goal:** Ship a production-ready admin frontend on Next.js standalone behind `kb.liuyidi.me`, keep `/v1` as the first-class Agent/API surface, and replace the hashless-but-fake SPA pages with shareable App Router URLs—without rewriting the RAG core.

**Architecture:** Host nginx (TLS) terminates `kb.liuyidi.me` and routes by path: `/v1/*` (and API health) to `minikb-api` on loopback `:8080`; everything else to `minikb-web` (Next `output: 'standalone'`) on loopback `:3000`. The browser calls `/v1` same-origin with `Authorization: Bearer`. Humans authenticate via mini-auth (OIDC + PKCE); agents keep using `mk_…` API keys.

**Tech Stack:** Next.js (App Router, standalone), TypeScript, Tailwind + `@mini-design-system/tokens` (components stay in `web/` for now), FastAPI `/v1`, Docker Compose (two app images), host nginx on Volcengine, mini-auth (`auth.liuyidi.me`).

---

## Global Constraints

- Public host remains `https://kb.liuyidi.me` (Volcengine nginx TLS → loopback).
- `/v1` must remain usable by non-browser clients (minibot, CLI, SDK) without Next cookies.
- Two GHCR images: API and Next web; compose runs both on one ECS with existing postgres/redis/minio/worker.
- Browser data plane is **direct `/v1`** (no Next BFF proxy for business APIs).
- UI visual language follows mini-design-system **Direction 02** via **tokens only**; React components are local to `web/` and may be extracted later.
- Functional parity with the current `/ui` SPA is the cutover bar; competitive feature gaps are phased, not blockers for the Next cutover.

---

## Current State

- FastAPI serves REST under `/v1` and mounts a single-file SPA at `/ui` (`src/minikb/ui/static/index.html`).
- Host nginx proxies the whole site to `127.0.0.1:8080`; `location = /` returns `302 /ui/`.
- SPA pages are client-side `data-page` switches (dashboard, kb-list, documents, sources, chunks, retrieval, qa, eval, settings)—URLs do not encode KB scope.
- Auth for integrations is org API keys (`mk_…`); the UI does not use mini-auth today.
- Production stack: GHCR image + compose (`web`/`worker`/deps); see prior deploy specs under `docs/superpowers/specs/`.

---

## Goals

1. Real App Router routes, especially `/kb/[id]/…`, refreshable and shareable.
2. nginx path split: `/v1` → API, `/` → Next standalone.
3. Human login via mini-auth; browser attaches Bearer access JWT to `/v1`.
4. Keep API Key auth for agents; FastAPI accepts JWT **or** API Key.
5. Two-image compose + release path; health checks for both API and frontend.
6. Document competitive gaps (VikingDB / WeKnora / Feishu) and explicitly defer them.
7. Remove (after transition) FastAPI `StaticFiles` `/ui` as the primary UI.

## Non-Goals

- Next Route Handlers as a general BFF in front of `/v1`.
- Matching VikingDB hosted scale/SLA, WeKnora Agent/Wiki/IM matrix, or Feishu “permission-is-the-corpus” UX in this phase.
- Publishing a full `@mini-design-system/react` library before cutover.
- Redesigning RAG algorithms, vector backends, or worker topology.
- Multi-region or splitting API and DB onto separate hosts.

---

## Competitive Context (why this architecture stays)

| Product | What it optimizes for | Implication for minikb |
|---|---|---|
| Volcengine VikingDB Knowledge Base | Hosted hybrid retrieval, console + API/SDK, scale | Compete on API quality over time; do **not** collapse UI into the API process |
| Tencent [WeKnora](https://weknora.weixin.qq.com/platform/knowledge) | Full product: RAG + Agent + Wiki + channels | Learn IA (KB-scoped admin, citation UX) later; keep `/v1` agent-first |
| Feishu Knowledge Q&A | In-suite Q&A over already-permissioned content | Learn ACL-filtered retrieval later; stay a standalone KB platform |

**Decision:** Do **not** change the nginx / Next / FastAPI split to “look like” those products. Gaps that matter are product capabilities (ACL-filtered recall, citation UX, optional `/chat`, observability of hybrid retrieve)—tracked under Phased Gaps below.

---

## Architecture

```text
Browser
  │
  ▼
Host nginx (TLS kb.liuyidi.me)
  ├─ /v1/*     → 127.0.0.1:8080   minikb-api   (FastAPI)
  ├─ /health   → 127.0.0.1:8080
  ├─ /ui/*     → 301 to / (or finer redirects during transition)
  └─ /*        → 127.0.0.1:3000   minikb-web   (Next standalone)

Agents / minibot / CLI ──Bearer API Key──► https://kb.liuyidi.me/v1/...
Humans (UI) ──OIDC via auth.liuyidi.me──► session cookie on kb
         └──Authorization: Bearer <access>──► /v1/...
```

| Layer | Responsibility |
|---|---|
| Next (`web/`) | Pages, App Router, i18n, mini-auth gate, local UI components on tokens |
| FastAPI | Existing `/v1`, ingest SSE, worker coordination; stop owning the primary UI |
| nginx | TLS, path split, upload body size, SSE timeouts |
| mini-auth | Identity issuer for human JWT |

**Success criteria**

1. `https://kb.liuyidi.me/kb/<id>/documents` works on hard refresh and is shareable.
2. `/v1` behavior stays compatible (including SSE) for existing clients.
3. Unauthenticated visits to protected pages redirect to mini-auth and return with a session.
4. `/v1` remains usable without Next (API Key path).
5. Old `/ui` is redirected away and later removed from the API image.

---

## Routing & Information Architecture

### Principles

1. URL is the source of truth for KB scope (`params.id`).
2. Global pages vs KB-scoped pages are separated.
3. Path names mirror `/v1` resources where practical.
4. `/ui` is transitional only.

### Route table

| Path | Legacy SPA page | Notes |
|---|---|---|
| `/` | dashboard | Overview, recent activity, shortcuts |
| `/kbs` | kb-list | List + create KB |
| `/kb/[id]` | — | Redirect to `/kb/[id]/documents` (or a thin overview later) |
| `/kb/[id]/documents` | documents | Upload, list, status, delete |
| `/kb/[id]/sources` | sources | Connectors (e.g. Feishu) |
| `/kb/[id]/chunks` | chunks | Chunk browser |
| `/kb/[id]/retrieval` | retrieval | Retrieve debugger |
| `/kb/[id]/qa` | qa | RAG Q&A + citation skeleton |
| `/kb/[id]/eval` | eval | Eval datasets / runs |
| `/kb/[id]/settings` | settings | KB settings / dangerous delete |
| `/settings` | system | Account, locale, API key management if still exposed |
| `/login/callback` | — | mini-auth return |

Sidebar: global items when outside a KB; inside `/kb/[id]/…`, show KB switcher and scoped nav. Invalid id → not-found + link to `/kbs`. `localStorage` may hint “last KB” only.

**Deferred IA:** WeKnora-style global `/chat`, Wiki graph routes; Feishu-style “no KB picker.”

---

## Auth

### Callers

| Caller | Credential | Path |
|---|---|---|
| Human (Next) | mini-auth access JWT | OIDC + PKCE → HttpOnly session cookie → browser sends `Authorization: Bearer <access>` to `/v1` |
| Agent / SDK | `mk_…` API Key | Direct `/v1` |
| Anonymous | none | Protected pages → `https://auth.liuyidi.me` with safe `next` back to kb |

### Human flow

1. Middleware detects missing/expired session on protected routes.
2. Redirect to mini-auth authorize (OIDC Authorization Code + PKCE).
3. `/login/callback` exchanges code; store refresh/session in HttpOnly cookie; hold short-lived access for API calls.
4. FastAPI validates JWT (`iss` aligned with `https://auth.liuyidi.me`, same family as minibot bootstrap).
5. On access expiry, silent refresh; on failure, clear session and re-login.

### FastAPI (minimal)

1. Keep API Key verification.
2. Add Bearer JWT verification.
3. Accept either on protected `/v1` routes.
4. Production should not allow anonymous `/v1` (dev bypass remains a local-only switch if needed).
5. CORS may list `https://kb.liuyidi.me`; same-origin via nginx reduces browser CORS pressure.

### Explicit non-goals (auth)

- FastAPI reading mini-auth cookies cross-site.
- Full RBAC matrix in this phase (may pass through `sub` / org claims for later ACL).
- Document-level ACL-filtered retrieval (see Phased Gaps).

---

## UI & Design System

### Tokens-only dependency

- Consume **`@mini-design-system/tokens`** (to be published from the design-system repo’s existing CSS/JSON tokens).
- **Do not** block on `@mini-design-system/react`.
- Build UI components inside `minikb` `web/`; extract shared primitives later if multiple apps need them.
- Visual baseline: Direction 02 (white canvas, near-black type, sparse chrome, system color for state/focus only).

### Parity checklist (cutover bar)

- [ ] Dashboard
- [ ] KB list / create
- [ ] Documents (upload, list, delete, job status / SSE as today)
- [ ] Sources
- [ ] Chunks
- [ ] Retrieval
- [ ] QA (streaming if already present)
- [ ] Eval
- [ ] Settings
- [ ] Login gate + locale switch

Citation deep-links and ACL UX are skeletons only in this phase.

---

## Deployment & Runtime

### Compose services

| Service | Image | Bind | Role |
|---|---|---|---|
| API (today’s `web` container; rename optional in impl plan) | `minikb-api` / existing image evolved | `127.0.0.1:8080` | FastAPI `/v1`, `/health` |
| `frontend` | `minikb-web` | `127.0.0.1:3000` | Next standalone |
| `worker`, `postgres`, `redis`, `minio` | unchanged | — | unchanged |

Env should allow independent tags, e.g. `MINIKB_API_IMAGE` and `MINIKB_WEB_IMAGE` (or documented equivalents).

### nginx sketch

- `/v1/` → API (long `proxy_read_timeout`, SSE-friendly: `proxy_buffering off` as needed).
- `/health` → API.
- `/` → Next (`Host`, `X-Forwarded-*`, WebSocket upgrade if required).
- `/ui/` → `301` to `/` (finer maps optional during transition).
- Keep `client_max_body_size` appropriate for uploads (global or API locations).

### Health & release

- API: existing `/health`.
- Frontend: lightweight Next health route (e.g. `/api/health`) or TCP/HTTP probe on `:3000`.
- Release success requires both healthy; Feishu notify should identify which failed when possible.
- Rollback: pin previous image tags for API and/or web; nginx config changes can lag app images during dual-run.

### Transition

1. Build and run `frontend` beside API; nginx still points `/` at API/`/ui` if needed.
2. Validate on temporary port or staging host header.
3. Flip nginx: `/` → Next, `/v1` → API; `/ui` redirects.
4. Remove FastAPI `StaticFiles` `/ui` in a follow-up release.

---

## Repository Layout (intended)

```text
minikb/
  web/                 # Next.js app (standalone)
  src/minikb/          # FastAPI (drop /ui after transition)
  docker/              # API Dockerfile + web Dockerfile + compose
  deploy/              # nginx example updated for split
  docs/superpowers/    # this spec + later implementation plan
```

Exact package manager (npm/pnpm) and Next version are implementation-plan details; prefer current Next conventions documented in the installed `next` package when coding.

---

## Phased Gaps (not cutover blockers)

| Gap | Inspired by | Phase |
|---|---|---|
| ACL / permission-filtered retrieve | Feishu | Later spec |
| Rich citation → document highlight | All three | After parity |
| Retrieve debug (dense weight, recall detail) | VikingDB | After parity |
| Global chat / Agent / Wiki | WeKnora | Out of scope unless product pivot |
| IM / WeChat collection channels | WeKnora / Feishu | Prefer minibot channels, not Next |

---

## Testing Strategy

- **API:** existing pytest suite must stay green; add JWT-or-API-Key auth tests.
- **Web:** component/route tests for middleware gate, KB-scoped nav, critical fetch error states.
- **Deploy:** compose config render; nginx `nginx -t`; smoke: hard-refresh `/kb/.../documents`, `/v1` with API Key, login round-trip.
- **Regression:** SSE ingest progress still reaches the browser through nginx.

---

## Open Implementation Details (decide in plan, not blockers)

- Whether compose service `web` is renamed to `api` in the same PR or documented as “web = API” temporarily.
- Exact mini-auth client_id / redirect URI registration values for `kb.liuyidi.me`.
- JWT verification: shared HS256 secret vs JWKS endpoint timing.
- How `@mini-design-system/tokens` is published (npm vs git URL) for CI on Volcengine builds.

---

## Approval

Design sections reviewed in brainstorming:

1. Architecture (nginx split, two images, browser → `/v1`) — approved; competitive analysis → gaps chapter, no topology change.
2. KB-scoped routes — approved.
3. OIDC + cookie session + Bearer to `/v1`; API Key dual path — approved.
4. Tokens-only design-system dependency; local components — approved.
5. Deploy / nginx / transition — approved; write this spec.
`)