# minikb Next.js + nginx split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FastAPI `/ui` SPA with a Next.js App Router admin on `kb.liuyidi.me`, keep `/v1` as the Agent API, and split traffic at host nginx (`/v1` → FastAPI, `/` → Next standalone).

**Architecture:** Two GHCR images on one Volcengine compose project. Browser calls same-origin `/v1` with `Authorization: Bearer`. Humans log in through mini-auth (OIDC + PKCE); a thin Next auth BFF stores tokens in an HttpOnly cookie and hands the access token to client JS. Agents keep using API keys. FastAPI accepts JWT **or** API Key. Do not proxy business `/v1` through Next in production (dev may rewrite `/v1` to `:8080`).

**Tech Stack:** FastAPI, PyJWT, Next.js App Router (`output: 'standalone'`), TypeScript, Tailwind, Vitest, Docker Compose, host nginx, mini-auth OIDC (`auth.liuyidi.me`).

**Spec:** [`docs/superpowers/specs/2026-08-18-nextjs-nginx-split-design.md`](../specs/2026-08-18-nextjs-nginx-split-design.md)

**Suggested PRs (same plan):** A = Task 1; B = Tasks 2–9; C = Tasks 10–12. Cross-repo: mini-auth Task 3 client registration.

## Global Constraints

- Public host remains `https://kb.liuyidi.me` (Volcengine nginx TLS → loopback).
- `/v1` must remain usable by non-browser clients without Next cookies.
- Two GHCR images: existing `ghcr.io/liuyidi/minikb` (API/worker) and `ghcr.io/liuyidi/minikb-web` (Next).
- Compose service **`web` stays FastAPI** (do not rename this PR). New service **`frontend`** is Next on `127.0.0.1:3000`.
- Browser data plane is direct `/v1` (no Next Route Handler proxy for KB/documents/retrieve/qa).
- UI tokens: vendor Direction 02 CSS from mini-design-system (no npm package; no `@mini-design-system/react`).
- JWT verification: shared HS256 secret with mini-auth (`MINIKB_JWT_SECRET` = mini-auth `JWT_SECRET`). Issuer `https://auth.liuyidi.me`, audience `mini-auth`, `token_use=access`. JWKS later.
- mini-auth OAuth `client_id`: `minikb`. Redirects: `https://kb.liuyidi.me/login/callback`, `http://127.0.0.1:3000/login/callback`.
- JWT users map to the **default org** (synthetic `ApiKey` with `prefix="jwt"`). No RBAC/ACL this phase.
- Production `MINIKB_REQUIRE_API_KEY=true` after UI cutover. Dev/tests stay `false` unless a test sets it.
- Keep FastAPI `/ui` StaticFiles until nginx actually points `/` at Next.
- Do not implement WeKnora Wiki/Agent, Feishu ACL-filtered retrieve, or VikingDB scale work.
- After `npm install` in `web/`, read `web/node_modules/next/dist/docs/` before changing Next APIs.

## File map

| Path | Role |
|---|---|
| `src/minikb/config/settings.py` | JWT issuer/audience/secret settings |
| `src/minikb/auth/jwt_access.py` | Decode mini-auth access JWT |
| `src/minikb/auth/api_key.py` | Bearer: JWT **or** API key |
| `tests/test_auth_bearer.py` | Dual-auth tests |
| `web/` | Next app (standalone) |
| `docker/Dockerfile.web` | Next image |
| `docker/docker-compose.prod.yml` | Add `frontend`; keep `web` = API |
| `deploy/nginx.kb.liuyidi.me.conf.example` | Path split |
| `mini-auth` `app/services/bootstrap_service.py` | Register `minikb` OAuth client |

---

## Task 1: FastAPI accepts JWT or API Key

**Files:**
- Create: `src/minikb/auth/jwt_access.py`
- Create: `tests/test_auth_bearer.py`
- Modify: `src/minikb/config/settings.py`
- Modify: `src/minikb/auth/api_key.py`
- Modify: `src/minikb/auth/__init__.py`
- Modify: `pyproject.toml` (add `pyjwt>=2.10`)
- Test: `tests/test_auth_bearer.py`

**Interfaces:**
- Consumes: existing `HTTPBearer`, `ApiKey`, `require_api_key`, `get_or_create_default_org`
- Produces: `looks_like_jwt(token: str) -> bool`, `decode_mini_auth_access_token(token: str) -> dict[str, object]`, `create_jwt_api_key(*, sub: str, org_id: uuid.UUID) -> ApiKey`. `require_api_key` still returns `ApiKey` so routes do not change.

- [ ] **Step 1: Add PyJWT**

In `pyproject.toml` dependencies, add `"pyjwt>=2.10",` next to `pydantic-settings`. Then:

```bash
cd /Users/liuyidi/github/minikb && uv lock && uv sync
```

Expected: lockfile updates; `uv run python -c "import jwt; print(jwt.__version__)"` prints a 2.x version.

- [ ] **Step 2: Write the failing tests**

Create `tests/test_auth_bearer.py`:

```python
from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from minikb.auth.api_key import create_jwt_api_key, looks_like_jwt
from minikb.auth.jwt_access import decode_mini_auth_access_token
from minikb.config.settings import Settings
from minikb.main import app


SECRET = "test-minikb-jwt-secret"
ISSUER = "https://auth.liuyidi.me"
AUDIENCE = "mini-auth"


def _access_token(*, token_use: str = "access", secret: str = SECRET, exp_offset: int = 600) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": "user-1",
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "nbf": now,
            "exp": now + exp_offset,
            "jti": str(uuid.uuid4()),
            "sid": str(uuid.uuid4()),
            "token_use": token_use,
        },
        secret,
        algorithm="HS256",
    )


def test_looks_like_jwt() -> None:
    assert looks_like_jwt(_access_token())
    assert not looks_like_jwt("token_urlsafe_api_key_without_dots")


def test_decode_rejects_refresh_and_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    monkeypatch.setenv("MINIKB_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("MINIKB_JWT_AUDIENCE", AUDIENCE)
    payload = decode_mini_auth_access_token(_access_token())
    assert payload["sub"] == "user-1"
    with pytest.raises(Exception):
        decode_mini_auth_access_token(_access_token(token_use="refresh"))
    with pytest.raises(Exception):
        decode_mini_auth_access_token(_access_token(secret="other"))


def test_jwt_api_key_prefix() -> None:
    key = create_jwt_api_key(sub="user-1", org_id=uuid.uuid4())
    assert key.prefix == "jwt"
    assert key.name == "jwt:user-1"


def test_require_api_key_true_rejects_anonymous(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    client = TestClient(app)
    resp = client.get("/v1/kb")
    assert resp.status_code == 401


def test_require_api_key_true_accepts_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    monkeypatch.setenv("MINIKB_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("MINIKB_JWT_AUDIENCE", AUDIENCE)
    client = TestClient(app)
    resp = client.get("/v1/kb", headers={"Authorization": f"Bearer {_access_token()}"})
    assert resp.status_code == 200
    assert "items" in resp.json()
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/liuyidi/github/minikb && uv run pytest tests/test_auth_bearer.py -v
```

Expected: FAIL with `ImportError` or `looks_like_jwt is not defined`.

- [ ] **Step 4: Add settings fields**

In `src/minikb/config/settings.py`, after `require_api_key`, add:

```python
    jwt_secret: str = ""
    jwt_issuer: str = "https://auth.liuyidi.me"
    jwt_audience: str = "mini-auth"
```

- [ ] **Step 5: Implement JWT decode + dual Bearer**

Create `src/minikb/auth/jwt_access.py`:

```python
"""Decode mini-auth HS256 access tokens for /v1."""
from __future__ import annotations

from typing import Any

import jwt
from fastapi import HTTPException, status

from minikb.config.settings import get_settings


def decode_mini_auth_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT auth is not configured",
        )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc
    if payload.get("token_use") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )
    return payload
```

In `src/minikb/auth/api_key.py`:

1. Add import: `from minikb.auth.jwt_access import decode_mini_auth_access_token`
2. Add helpers (near `create_dev_api_key`):

```python
def looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


def create_jwt_api_key(*, sub: str, org_id: uuid.UUID) -> ApiKey:
    return ApiKey(
        id=uuid.uuid4(),
        org_id=org_id,
        prefix="jwt",
        hashed_secret="",
        name=f"jwt:{sub}",
        scopes={"kb:read", "kb:write", "kb:admin", "retrieve", "qa", "ingest"},
        disabled=False,
    )
```

3. Replace `get_api_key_from_header` so JWT is tried first:

```python
async def get_api_key_from_header(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> ApiKey | None:
    if credentials is None:
        return None

    token = credentials.credentials
    if looks_like_jwt(token):
        payload = decode_mini_auth_access_token(token)
        sub = str(payload.get("sub") or "")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token",
            )
        async for session in get_session():
            from minikb.api.deps import get_or_create_default_org

            org = await get_or_create_default_org(session)
            return create_jwt_api_key(sub=sub, org_id=org.id)

    async for session in get_session():
        prefix = token[:8] if len(token) >= 8 else token
        stmt = select(ApiKey).where(
            ApiKey.prefix == prefix,
            ApiKey.disabled == False,  # noqa: E712
        )
        result = await session.execute(stmt)
        api_key = result.scalar_one_or_none()

        if api_key is None or not verify_secret(token, api_key.hashed_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )

        api_key.last_used_at = datetime.utcnow()
        await session.flush()
        return api_key
```

Export `looks_like_jwt` and `create_jwt_api_key` from `src/minikb/auth/__init__.py`.

- [ ] **Step 6: Run auth tests and the existing suite**

```bash
cd /Users/liuyidi/github/minikb && uv run pytest tests/test_auth_bearer.py tests/test_knowledge_bases.py tests/test_p5_permissions.py -q
```

Expected: PASS. If `test_require_api_key_true_accepts_jwt` 500s on DB, same as other `/v1/kb` tests — they already hit Postgres via CI services / local compose.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml uv.lock src/minikb/config/settings.py src/minikb/auth tests/test_auth_bearer.py
git commit -m "$(cat <<'EOF'
feat: accept mini-auth JWT or API key on /v1

Let the browser send a Bearer access token while agents keep using mk-style keys.
EOF
)"
```

---

## Task 2: Next app scaffold, tokens, health, API rewrite

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/eslint.config.mjs`, `web/next-env.d.ts`
- Create: `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/api/health/route.ts`
- Create: `web/styles/mini-brand.tokens.css` (copy from mini-design-system)
- Create: `web/vitest.config.ts`, `web/lib/paths.test.ts`, `web/lib/paths.ts`
- Create: `docker/Dockerfile.web`
- Modify: `.gitignore` (add `web/node_modules`, `web/.next`)

**Interfaces:**
- Consumes: Direction 02 tokens at `/Users/liuyidi/github/mini-design-system/tokens/mini-brand.tokens.css`
- Produces: `kbPath(id: string, page: string): string`, `GET /api/health` → `{ status: "ok" }`, Next `output: "standalone"`, dev rewrite `/v1/:path*` → `http://127.0.0.1:8080/v1/:path*`

- [ ] **Step 1: Ignore Next build artifacts**

Append to `.gitignore`:

```
web/node_modules/
web/.next/
web/out/
```

- [ ] **Step 2: Vendor tokens**

```bash
mkdir -p /Users/liuyidi/github/minikb/web/styles
cp /Users/liuyidi/github/mini-design-system/tokens/mini-brand.tokens.css \
  /Users/liuyidi/github/minikb/web/styles/mini-brand.tokens.css
```

Expected: file starts with `--mini-color-canvas: #ffffff`.

- [ ] **Step 3: Write path helper test**

Create `web/lib/paths.ts`:

```ts
const KB_PAGES = [
  "documents",
  "sources",
  "chunks",
  "retrieval",
  "qa",
  "eval",
  "settings",
] as const;

export type KbPage = (typeof KB_PAGES)[number];

export function kbPath(id: string, page: KbPage = "documents"): string {
  return `/kb/${id}/${page}`;
}

export function isSafeNextPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}
```

Create `web/lib/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSafeNextPath, kbPath } from "./paths";

describe("kbPath", () => {
  it("scopes documents under a kb id", () => {
    expect(kbPath("abc")).toBe("/kb/abc/documents");
    expect(kbPath("abc", "qa")).toBe("/kb/abc/qa");
  });
});

describe("isSafeNextPath", () => {
  it("rejects open redirects", () => {
    expect(isSafeNextPath("/kb/1/documents")).toBe(true);
    expect(isSafeNextPath("https://evil.example")).toBe(false);
    expect(isSafeNextPath("//evil.example")).toBe(false);
  });
});
```

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Add package.json and Next config**

`web/package.json`:

```json
{
  "name": "minikb-web",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "jose": "^6.0.11",
    "next": "^15.5.2",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "eslint": "^9.26.0",
    "eslint-config-next": "^15.5.2",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.1.5",
    "@tailwindcss/postcss": "^4.1.5",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

After install, if Tailwind v4 + Next 15 types differ, follow `web/node_modules/next/dist/docs/`.

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const apiOrigin = process.env.MINIKB_API_URL ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiOrigin}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

`web/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`web/eslint.config.mjs`:

```js
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")];

export default eslintConfig;
```

If `FlatCompat` is missing, use the `eslint-config-next` file that `next lint` scaffolds.

- [ ] **Step 5: App shell files**

`web/app/globals.css`:

```css
@import "../styles/mini-brand.tokens.css";
@import "tailwindcss";

html,
body {
  background: var(--mini-color-canvas);
  color: var(--mini-color-ink);
  font-family: var(--mini-font-sans);
  min-height: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

:focus-visible {
  outline: 2px solid var(--mini-color-focus);
  outline-offset: 2px;
}
```

`web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "minikb",
  description: "Knowledge base platform for agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

`web/app/page.tsx` (placeholder until Task 5):

```tsx
export default function HomePage() {
  return (
    <main style={{ padding: 48 }}>
      <h1 style={{ fontSize: 40, letterSpacing: "-0.04em" }}>minikb</h1>
      <p style={{ color: "var(--mini-color-muted)", marginTop: 12 }}>
        Admin UI scaffold. Auth and pages land in later tasks.
      </p>
    </main>
  );
}
```

`web/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "minikb-web" });
}
```

`web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Install, test, run health**

```bash
cd /Users/liuyidi/github/minikb/web
npm install
npm test
npx next build
```

Expected: Vitest PASS; `next build` writes `.next/standalone`.

Dev check:

```bash
cd /Users/liuyidi/github/minikb/web && npm run dev
curl -fsS http://127.0.0.1:3000/api/health
```

Expected: `{"status":"ok","service":"minikb-web"}`.

- [ ] **Step 7: Next Dockerfile**

Create `docker/Dockerfile.web`:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

Standalone output layout: `server.js` lives at the standalone root. If build puts it under `web/`, copy that path instead (verify after first `next build`).

- [ ] **Step 8: Commit**

```bash
git add .gitignore web docker/Dockerfile.web
git commit -m "$(cat <<'EOF'
feat: scaffold Next standalone admin with brand tokens

Add a health endpoint and /v1 rewrite so local UI can talk to FastAPI without nginx.
EOF
)"
```

---

## Task 3: mini-auth client + Next OIDC session

**Files (mini-auth repo):**
- Modify: `/Users/liuyidi/github/mini-auth/app/services/bootstrap_service.py`
- Test: `/Users/liuyidi/github/mini-auth/tests/test_minikb_oauth_client.py` (or extend existing bootstrap tests if present)

**Files (minikb):**
- Create: `web/lib/auth.ts`, `web/lib/auth.test.ts`, `web/lib/session.ts`
- Create: `web/app/api/auth/login/route.ts`, `web/app/api/auth/logout/route.ts`, `web/app/api/auth/session/route.ts`, `web/app/api/auth/refresh/route.ts`
- Create: `web/app/login/callback/route.ts`
- Create: `web/middleware.ts`
- Create: `web/.env.example`

**Interfaces:**
- Consumes: mini-auth `POST /oauth/token`, `GET /oauth/userinfo`, `GET /oauth/authorize` (PKCE S256, public client)
- Produces: HttpOnly cookie `minikb_session` (signed JWT wrapping `{ access_token, refresh_token, expires_at, sub }`); `GET /api/auth/session` JSON `{ authenticated, accessToken, sub }`; middleware redirects unauthenticated page requests to `/api/auth/login?next=`

### Locked OIDC values

| Key | Value |
|---|---|
| `client_id` | `minikb` |
| `redirect_uri` (prod) | `https://kb.liuyidi.me/login/callback` |
| `redirect_uri` (dev) | `http://127.0.0.1:3000/login/callback` |
| scopes | `openid profile email` |
| token `aud` for API | `mini-auth` (access token, not client_id) |

- [ ] **Step 1: Register the minikb OAuth client in mini-auth**

In `app/services/bootstrap_service.py` add:

```python
MINIKB_CLIENT_ID = "minikb"
MINIKB_CLIENT_NAME = "minikb admin"
MINIKB_REDIRECT_URIS = [
    "https://kb.liuyidi.me/login/callback",
    "http://127.0.0.1:3000/login/callback",
    "http://localhost:3000/login/callback",
]
```

Add `ensure_minikb_oauth_client(db)` copied from `ensure_demo_oauth_client` but using `MINIKB_CLIENT_ID` / `MINIKB_REDIRECT_URIS` (do not merge minibot URIs into this client). Call it from the same startup path that calls `ensure_demo_oauth_client`.

Create `tests/test_minikb_oauth_client.py` that boots the app (follow existing oauth tests) and asserts a client with `client_id == "minikb"` includes `https://kb.liuyidi.me/login/callback`.

Also add `https://kb.liuyidi.me` to production mini-auth `CORS_ORIGINS` on the CVM (ops, not code if CORS is env-only).

- [ ] **Step 2: Write Next auth helper tests**

`web/lib/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, randomVerifier } from "./auth";

describe("buildAuthorizeUrl", () => {
  it("includes PKCE and client_id", () => {
    const verifier = randomVerifier();
    const url = buildAuthorizeUrl({
      issuer: "https://auth.liuyidi.me",
      clientId: "minikb",
      redirectUri: "http://127.0.0.1:3000/login/callback",
      state: "abc",
      codeVerifier: verifier,
    });
    expect(url).toContain("/oauth/authorize?");
    expect(url).toContain("client_id=minikb");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("redirect_uri=");
  });
});
```

- [ ] **Step 3: Implement auth + sealed session**

`web/lib/auth.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

export function randomVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(opts: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid profile email",
    state: opts.state,
    code_challenge: codeChallenge(opts.codeVerifier),
    code_challenge_method: "S256",
  });
  return `${opts.issuer.replace(/\/$/, "")}/oauth/authorize?${params.toString()}`;
}

export function authEnv() {
  const issuer = process.env.MINIAUTH_ISSUER ?? "https://auth.liuyidi.me";
  const clientId = process.env.MINIAUTH_CLIENT_ID ?? "minikb";
  const redirectUri =
    process.env.MINIAUTH_REDIRECT_URI ?? "http://127.0.0.1:3000/login/callback";
  const sessionSecret = process.env.MINIKB_SESSION_SECRET ?? "";
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("MINIKB_SESSION_SECRET must be at least 32 characters");
  }
  return { issuer, clientId, redirectUri, sessionSecret };
}
```

`web/lib/session.ts` — use `jose` `SignJWT` / `jwtVerify` with `MINIKB_SESSION_SECRET` to sign cookie payload:

```ts
export type SessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  sub: string;
};
```

Cookie: `minikb_session`, `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`.

PKCE cookies `minikb_oauth_state` and `minikb_oauth_verifier`: `httpOnly`, `maxAge: 600`.

- [ ] **Step 4: Auth routes**

`web/app/api/auth/login/route.ts`: generate `state` + `verifier`, set PKCE cookies, `next` query (default `/`, validate with `isSafeNextPath`) stored in `minikb_oauth_next` cookie, redirect 302 to `buildAuthorizeUrl`.

`web/app/login/callback/route.ts`:
1. Read `code`, `state`.
2. Compare `state` to cookie.
3. `POST ${issuer}/oauth/token` JSON body `{ grant_type, code, redirect_uri, client_id, code_verifier }` (same as minibot; `trust_env` N/A in Node).
4. `GET ${issuer}/oauth/userinfo` with Bearer access.
5. Set `minikb_session`; clear PKCE cookies; redirect to safe `next`.

`web/app/api/auth/session/route.ts`: if no cookie → `{ authenticated: false }`; else `{ authenticated: true, accessToken, sub, expiresAt }`. This is the **only** way browser JS gets the access token (HttpOnly cannot be read).

`web/app/api/auth/refresh/route.ts`: `POST /oauth/token` with `grant_type=refresh_token`; rewrite session cookie.

`web/app/api/auth/logout/route.ts`: clear session cookie; redirect `/`.

- [ ] **Step 5: Middleware**

`web/middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = [/^\/api\/health$/, /^\/api\/auth\/login$/, /^\/login\/callback$/];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (!request.cookies.get("minikb_session")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
```

Local bypass: if `MINIKB_AUTH_DISABLED=true` (dev only), middleware must skip the redirect. Document that production compose **omits** this env.

- [ ] **Step 6: Env example**

`web/.env.example`:

```bash
MINIAUTH_ISSUER=https://auth.liuyidi.me
MINIAUTH_CLIENT_ID=minikb
MINIAUTH_REDIRECT_URI=http://127.0.0.1:3000/login/callback
MINIKB_SESSION_SECRET=change-me-to-at-least-32-characters!!
MINIKB_API_URL=http://127.0.0.1:8080
MINIKB_AUTH_DISABLED=true
```

- [ ] **Step 7: Run web tests**

```bash
cd /Users/liuyidi/github/minikb/web && npm test && npx tsc --noEmit
```

Expected: PASS.

Manual: with FastAPI on `:8080`, `MINIKB_AUTH_DISABLED=true npm run dev` still loads `/`. With auth enabled and mini-auth client registered, unauthenticated `/kbs` redirects to auth.liuyidi.me.

- [ ] **Step 8: Commit both repos separately**

minikb:

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: add mini-auth OIDC login for the admin UI

Store tokens in an HttpOnly session cookie and expose the access token only via /api/auth/session.
EOF
)"
```

mini-auth: commit client registration with a message like `feat: register minikb OIDC client`.

---

## Task 4: AppShell, i18n, `/v1` client with Bearer

**Files:**
- Create: `web/lib/api.ts`, `web/lib/api.test.ts`, `web/lib/i18n.ts`, `web/lib/locale.ts`
- Create: `web/components/AppShell.tsx`, `web/components/Button.tsx`, `web/components/Modal.tsx`
- Create: `web/app/providers.tsx`
- Modify: `web/app/layout.tsx` to wrap `AppShell` except login routes

**Interfaces:**
- Consumes: `GET /api/auth/session` `{ accessToken }`; `/v1/*`
- Produces: `api(path: string, init?: RequestInit): Promise<Response>` that sets `Authorization: Bearer` from memory, refreshes once on 401 via `POST /api/auth/refresh` then re-fetches session. `t(key: string): string` for `zh-CN` / `en`.

- [ ] **Step 1: Failing api test**

`web/lib/api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./api";

describe("apiErrorMessage", () => {
  it("reads FastAPI detail string", () => {
    expect(apiErrorMessage({ detail: "Invalid API key" })).toBe("Invalid API key");
  });
});
```

- [ ] **Step 2: Implement client**

`web/lib/api.ts`:

```ts
export function apiErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return "Request failed";
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function loadSessionToken(): Promise<boolean> {
  const resp = await fetch("/api/auth/session", { credentials: "include" });
  const data = (await resp.json()) as { authenticated?: boolean; accessToken?: string };
  if (!data.authenticated || !data.accessToken) {
    setAccessToken(null);
    return false;
  }
  setAccessToken(data.accessToken);
  return true;
}

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let resp = await fetch(path, { ...init, headers, credentials: "include" });
  if (resp.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      await loadSessionToken();
      const retryHeaders = new Headers(init.headers);
      if (accessToken) retryHeaders.set("Authorization", `Bearer ${accessToken}`);
      resp = await fetch(path, { ...init, headers: retryHeaders, credentials: "include" });
    }
  }
  return resp;
}
```

`path` arguments are always same-origin (`/v1/kb`, …). Do not add a Next BFF for these.

Copy the SPA i18n dictionaries from `src/minikb/ui/static/index.html` (`I18N['zh-CN']` / `en`) into `web/lib/i18n.ts` as `messages: Record<"zh-CN" | "en", Record<string, string>>`. Persist locale in `localStorage` key `minikb.locale`.

- [ ] **Step 3: AppShell**

Sidebar sections from the spec:

- Global: `/` Dashboard, `/kbs` 知识库, `/settings` 系统
- When `pathname` matches `/kb/[id]/…`: KB switcher (`GET /v1/kb`) + links via `kbPath(id, page)` for documents/sources/chunks/retrieval/qa/eval/settings

Direction 02: white canvas, near-black type, no purple glow, no card chrome unless it is an interactive control. Sidebar: left column, 1px `--mini-color-border-soft`, not a dark navy panel.

`Button` variants: `primary` (black background, white text), `secondary` (border), `danger` (`--mini-color-danger`).

- [ ] **Step 4: Session bootstrap**

Client `providers.tsx` (`"use client"`): `useEffect` → `loadSessionToken()`.

- [ ] **Step 5: Run tests**

```bash
cd /Users/liuyidi/github/minikb/web && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: add admin shell and authenticated /v1 client

Keep business traffic on /v1 with a Bearer access token held in memory.
EOF
)"
```

---

## Task 5: Dashboard + knowledge bases

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/app/kbs/page.tsx`
- Create: `web/components/CreateKbModal.tsx`

**Interfaces:**
- Consumes: `GET /v1/kb`, `POST /v1/kb` `{ name, slug, description }`, `DELETE /v1/kb/{id}`
- Produces: `/` stats (kb/doc/source counts from list payloads already used by the SPA); `/kbs` list + create modal

- [ ] **Step 1: Dashboard**

Port `loadDashboard` from `index.html`: `GET /v1/kb`, then per-kb `documents?limit=3` and `data-sources` for counts. Show recent KBs as links to `kbPath(id)`.

- [ ] **Step 2: `/kbs`**

List `items` with name, slug, description. Create modal fields match SPA (`name`, `slug`, `description`). On success, `router.push(kbPath(created.id))`. Delete with the same double-confirm only on the settings page (Task 9); list may omit delete.

- [ ] **Step 3: Manual check**

With `MINIKB_AUTH_DISABLED=true` and API on `:8080`:

```bash
# UI
open http://127.0.0.1:3000/kbs
# API still works without Next
curl -s http://127.0.0.1:8080/v1/kb
```

Expected: create KB in UI; `curl` still lists it.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: port dashboard and knowledge-base list to App Router

Give each KB a shareable /kb/[id]/documents entry point after create.
EOF
)"
```

---

## Task 6: Documents (upload, list, poll status)

**Files:**
- Create: `web/app/kb/[id]/page.tsx`
- Create: `web/app/kb/[id]/documents/page.tsx`
- Create: `web/app/kb/[id]/not-found.tsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /v1/kb/{id}/documents`; optional `GET /v1/kb/{id}/ingest/events` via **fetch() stream** (not EventSource — EventSource cannot set Authorization)
- Produces: hard-refreshable `/kb/[id]/documents`

- [ ] **Step 1: Redirect `/kb/[id]`**

```tsx
import { redirect } from "next/navigation";

export default async function KbIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/kb/${id}/documents`);
}
```

If Next version uses sync `params`, follow `web/node_modules/next/dist/docs/`.

- [ ] **Step 2: Documents page**

Port SPA behavior:

- List title, mime, size, status badge
- Delete with confirm
- Upload modal: click + drag-drop + `FormData` field `file`
- While any `status` is processing, `setTimeout(reload, 3000)` (SPA parity). Additionally open `GET /v1/kb/${id}/ingest/events` with `api()` / fetch + `Authorization` and `Accept: text/event-stream` if you implement live events; polling alone satisfies current SPA parity.

404: if `GET /v1/kb/{id}` is 404, `notFound()`.

- [ ] **Step 3: Verify refresh**

Open `/kb/<real-id>/documents`, reload. Expected: same page, not `/ui`.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: add KB-scoped documents route with upload

Make /kb/[id]/documents the shareable document inbox and keep ingest status visible.
EOF
)"
```

---

## Task 7: Sources + chunks

**Files:**
- Create: `web/app/kb/[id]/sources/page.tsx`
- Create: `web/app/kb/[id]/chunks/page.tsx`

**Interfaces:**
- Consumes: `/v1/kb/{id}/data-sources` CRUD + `sync` + `probe`; `/v1/kb/{id}/chunks` + `/chunks/stats`
- Produces: source kinds `url | git | sql | feishu` with the same form fields as the SPA modal; chunk filters `document_id` + search box

- [ ] **Step 1: Sources page** — port `loadDataSources`, `createDataSource`, `syncDataSource`, `probeDataSource`, `deleteDataSource`.

- [ ] **Step 2: Chunks page** — port `loadChunks` query params and pagination controls.

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: port data-source and chunk browsers under /kb/[id]

Keep connector setup and chunk inspection scoped to the URL kb id.
EOF
)"
```

---

## Task 8: Retrieval + QA (citation skeleton)

**Files:**
- Create: `web/app/kb/[id]/retrieval/page.tsx`
- Create: `web/app/kb/[id]/qa/page.tsx`

**Interfaces:**
- Consumes: `POST /v1/kb/{id}/retrieve` `{ query, mode, top_k, rerank? }`; `POST /v1/kb/{id}/qa` `{ query, mode, top_k, stream: false }`
- Produces: result lists with score + text; QA answer plus citation objects as a simple list (no document highlight — spec skeleton)

- [ ] **Step 1: Retrieval** — modes `vector | keyword | hybrid`; rerank checkbox + provider `mock | bm25 | cohere`; `top_n`.

- [ ] **Step 2: QA** — match SPA `doQA` (`stream: false`). Render `answer` and `citations` (id/title/snippet if present). Clear button resets the pane.

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: port retrieval and QA benches to KB-scoped routes

Show citations as a list skeleton; skip document-highlight UX this phase.
EOF
)"
```

---

## Task 9: Eval, KB settings, system settings

**Files:**
- Create: `web/app/kb/[id]/eval/page.tsx`
- Create: `web/app/kb/[id]/settings/page.tsx`
- Create: `web/app/settings/page.tsx`

**Interfaces:**
- Consumes: `/v1/kb/{id}/eval/datasets|runs`; `GET/PATCH/DELETE /v1/kb/{id}/settings`; `POST .../reindex`; `/v1/api-keys`
- Produces: parity with SPA eval + KB settings (including double-confirm delete); `/settings` locale switch + API key list/create (system)

- [ ] **Step 1: Eval** — create dataset, run eval, delete dataset; list runs.

- [ ] **Step 2: KB settings** — fields `name`, `description`, `kind`, `visibility`, `chunker_strategy`; reindex; delete KB then `router.push("/kbs")`.

- [ ] **Step 3: `/settings`** — locale select (`zh-CN`/`en`); `GET/POST /v1/api-keys` so humans can mint agent keys after JWT login.

- [ ] **Step 4: Parity walkthrough** (manual): dashboard, kbs, documents upload, sources, chunks, retrieval, qa, eval, kb settings, locale, login gate with auth enabled.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: finish admin parity for eval, settings, and API keys

Close the /ui feature gap so nginx can point / at Next.
EOF
)"
```

---

## Task 10: Compose frontend + nginx split

**Files:**
- Modify: `docker/docker-compose.prod.yml`
- Modify: `.env.example`
- Modify: `deploy/nginx.kb.liuyidi.me.conf.example`
- Modify: `deploy/ops-checklist.md`, `deploy/rollback.md`, `deploy/README.md`

**Interfaces:**
- Consumes: `MINIKB_IMAGE`, new `MINIKB_WEB_IMAGE`
- Produces: `frontend` service `127.0.0.1:3000:3000`; nginx `/v1/` + `/health` → `:8080`, `/` → `:3000`, `/ui/` → 301 `/`

- [ ] **Step 1: Compose `frontend`**

Keep `x-minikb-image` for migrate/web/worker. Add:

```yaml
  frontend:
    image: ${MINIKB_WEB_IMAGE:?set MINIKB_WEB_IMAGE}
    container_name: minikb-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      MINIAUTH_ISSUER: ${MINIAUTH_ISSUER:-https://auth.liuyidi.me}
      MINIAUTH_CLIENT_ID: ${MINIAUTH_CLIENT_ID:-minikb}
      MINIAUTH_REDIRECT_URI: ${MINIAUTH_REDIRECT_URI:-https://kb.liuyidi.me/login/callback}
      MINIKB_SESSION_SECRET: ${MINIKB_SESSION_SECRET:?set MINIKB_SESSION_SECRET}
      MINIKB_API_URL: http://web:8080
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
```

On the FastAPI `web` service, add:

```yaml
      MINIKB_REQUIRE_API_KEY: ${MINIKB_REQUIRE_API_KEY:-true}
      MINIKB_JWT_SECRET: ${MINIKB_JWT_SECRET:-}
      MINIKB_JWT_ISSUER: ${MINIKB_JWT_ISSUER:-https://auth.liuyidi.me}
      MINIKB_JWT_AUDIENCE: ${MINIKB_JWT_AUDIENCE:-mini-auth}
```

Do not rename `web`. Comment at top of compose: `web = FastAPI API; frontend = Next`.

- [ ] **Step 2: `.env.example`**

Add:

```bash
MINIKB_WEB_IMAGE=ghcr.io/liuyidi/minikb-web:latest
MINIKB_REQUIRE_API_KEY=true
MINIKB_JWT_SECRET=
MINIKB_JWT_ISSUER=https://auth.liuyidi.me
MINIKB_JWT_AUDIENCE=mini-auth
MINIAUTH_ISSUER=https://auth.liuyidi.me
MINIAUTH_CLIENT_ID=minikb
MINIAUTH_REDIRECT_URI=https://kb.liuyidi.me/login/callback
MINIKB_SESSION_SECRET=
```

Comment: `MINIKB_JWT_SECRET` must match mini-auth `JWT_SECRET`.

- [ ] **Step 3: nginx example**

Replace the single `location /` proxy with:

```nginx
upstream minikb_api { server 127.0.0.1:8080; keepalive 8; }
upstream minikb_web { server 127.0.0.1:3000; keepalive 8; }

# inside server:
client_max_body_size 64m;

location /v1/ {
    proxy_pass http://minikb_api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_buffering off;
    proxy_read_timeout 300s;
}

location = /health {
    proxy_pass http://minikb_api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

location /health/ {
    proxy_pass http://minikb_api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

location /ui/ {
    return 301 /;
}

location = /ui {
    return 301 /;
}

location / {
    proxy_pass http://minikb_web;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Remove `location = / { return 302 /ui/; }`.

- [ ] **Step 4: Render compose**

```bash
cd /Users/liuyidi/github/minikb
MINIKB_IMAGE=ghcr.io/liuyidi/minikb:latest \
MINIKB_WEB_IMAGE=ghcr.io/liuyidi/minikb-web:latest \
MINIKB_SESSION_SECRET=dummy-session-secret-at-least-32-chars \
docker compose -f docker/docker-compose.prod.yml config >/dev/null
```

Expected: exit 0; config contains `minikb-frontend` and no `build:` on app services.

- [ ] **Step 5: Update ops docs**

- Health: API `http://127.0.0.1:8080/health/live` **and** `http://127.0.0.1:3000/api/health`
- Logs: `docker compose ... logs -f frontend`
- Rollback: set **both** `MINIKB_IMAGE` and `MINIKB_WEB_IMAGE` to `sha-*` tags
- Dual-run: nginx can still point `/` at `:8080/ui` until frontend is healthy

- [ ] **Step 6: Commit**

```bash
git add docker/docker-compose.prod.yml .env.example deploy
git commit -m "$(cat <<'EOF'
feat: split kb.liuyidi.me nginx between FastAPI and Next

Run Next standalone on loopback :3000 and keep the API container named web.
EOF
)"
```

---

## Task 11: CI + dual-image publish

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/publish-volcengine-minikb.yml`
- Modify: `.claude/skills/deploying-volcengine-minikb/SKILL.md`

**Interfaces:**
- Consumes: `docker/Dockerfile` (or `Dockerfile.ecs`) for API; `docker/Dockerfile.web` for frontend
- Produces: GHCR tags `ghcr.io/liuyidi/minikb:sha-<short>` + `:latest` and `ghcr.io/liuyidi/minikb-web:sha-<short>` + `:latest`; host `.env` writes both image vars; health loop requires API **and** frontend

- [ ] **Step 1: CI web job**

Append a job `web` (needs Node 22):

```yaml
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

- [ ] **Step 2: Publish workflow**

- `on.push.paths` add `web/**`, `docker/Dockerfile.web`
- Build/push API image as today (`Dockerfile.ecs`)
- Second `docker/build-push-action` for `docker/Dockerfile.web` with tags `ghcr.io/liuyidi/minikb-web:latest` and `:sha-<short>`
- Remote `.env`: strip both `MINIKB_IMAGE=` and `MINIKB_WEB_IMAGE=`, append both refs
- Health loop: existing API check **plus**

```bash
curl -fsS --max-time 3 "http://127.0.0.1:3000/api/health"
```

On failure, `docker logs minikb-frontend --tail 120`. Do not fail the deploy only on `/ui/` (that line is optional today — remove or ignore).

- [ ] **Step 3: Skill**

Document two images, `MINIKB_WEB_IMAGE`, nginx split, JWT secret, and `frontend` logs. Keep “do not Aliyun kb”.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/publish-volcengine-minikb.yml .claude/skills/deploying-volcengine-minikb/SKILL.md
git commit -m "$(cat <<'EOF'
ci: build and deploy minikb-web alongside the API image

Require both loopback health checks before calling the deploy a success.
EOF
)"
```

---

## Task 12: Cutover, `/ui` retirement, README

**Files:**
- Modify: `README.md` (Dev UI URL → `http://127.0.0.1:3000`, note nginx split)
- Modify: `src/minikb/main.py` **only after** production nginx is flipped
- Host: copy nginx example, `nginx -t && systemctl reload nginx`
- Host `.env`: `MINIKB_JWT_SECRET`, `MINIKB_SESSION_SECRET`, `MINIKB_REQUIRE_API_KEY=true`

**Interfaces:**
- Consumes: Task 10 nginx template
- Produces: `https://kb.liuyidi.me/kb/<id>/documents` hard-refresh; `/v1` with API key still works; `/ui` 301

- [ ] **Step 1: Dual-run on ECS (nginx still old)**

Deploy images. Confirm:

```bash
curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:8080/v1/kb -H "Authorization: Bearer <api-key>"
```

Expected: API + frontend healthy; API key still works without cookies.

- [ ] **Step 2: Flip nginx**

Install the split config. `nginx -t && systemctl reload nginx`.

```bash
curl -fsSI https://kb.liuyidi.me/ui/
curl -fsS https://kb.liuyidi.me/api/health
curl -fsS https://kb.liuyidi.me/v1/kb -H "Authorization: Bearer <api-key>"
```

Expected: `/ui/` 301; `/api/health` 200; `/v1/kb` 200 with key. Then log in via mini-auth and hard-refresh a documents URL.

- [ ] **Step 3: Remove FastAPI StaticFiles** (follow-up commit after cutover is stable)

Delete the `/ui` mount block in `src/minikb/main.py` (the `ui_dir` / `StaticFiles` section). Keep `src/minikb/ui/static/index.html` in git for one release if you want a rollback copy, then delete in a later cleanup.

```bash
uv run pytest tests/test_health.py -q
```

Expected: PASS (health does not depend on `/ui`).

- [ ] **Step 4: README**

Replace “Dev UI `/ui/`” with Next `cd web && npm run dev` (API `uvicorn` on 8080). Document production path split in one sentence. Link the spec + this plan.

- [ ] **Step 5: Out-of-repo follow-up (do not block)**

minibot `site/` still links `https://kb.liuyidi.me/ui/` — change to `https://kb.liuyidi.me/` in a minibot commit when convenient.

- [ ] **Step 6: Commit API `/ui` removal + README after nginx is live**

```bash
git add src/minikb/main.py README.md
git commit -m "$(cat <<'EOF'
chore: drop FastAPI /ui now that nginx serves Next on /

Keep /v1 as the only app surface on the API container.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Real `/kb/[id]/…` routes | 5–9 |
| nginx `/v1` vs `/` split | 10, 12 |
| mini-auth OIDC + Bearer to `/v1` | 3, 4, 1 |
| API Key dual path | 1 |
| Two images + both health checks | 10, 11 |
| Tokens only, local components | 2, 4 |
| Competitive gaps deferred | Global Constraints (no tasks) |
| Remove `/ui` after transition | 12 |
| SSE through nginx | 6 (fetch stream) + 10 (`proxy_buffering off`) |
| `/v1` without Next cookies | 1, 12 curl with API key |
| Compose keep `web` name | 10 |

## Locked open details

- Compose: **do not** rename `web` → `api`.
- OAuth: `client_id=minikb`, prod redirect `https://kb.liuyidi.me/login/callback`.
- JWT: HS256 shared secret, `iss=https://auth.liuyidi.me`, `aud=mini-auth`.
- Tokens: **vendor CSS**, no npm `@mini-design-system/tokens` until that package exists.

No TBD/TODO placeholders remain in task steps.
