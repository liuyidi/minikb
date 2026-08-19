# minikb UI kit (`@minikb/ui`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incubate a Multica-shaped `@minikb/ui` package in minikb, bridge Direction 02 tokens, migrate the Next admin off local Button/Modal/ui helpers, and document the path in mini-design-system.

**Architecture:** `packages/ui` is a private workspace package consumed by `web/` via `file:`. Components follow `@multica/ui` structure and Base UI + CVA + Tailwind 4. Brand CSS stays `--mini-*`; a bridge layer exposes shadcn-style semantic variables. Extended kits (markdown, emoji, chart, calendar, data-table, command) ship in the same package.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, Next 15 (consumer).

## Global Constraints

- Package name: `@minikb/ui` (future rename `@mini-design-system/ui`).
- Visual language: Direction 02 only; no dark theme.
- Do not copy Multica chat-launcher utilities or Multica product identifiers.
- Delete `web/components/Button.tsx`, `Modal.tsx`, `ui.tsx` after pages import from the kit.
- Keep `AppShell` and `CreateKbModal` in `web/`.
- Docker/CI must build with `packages/ui` on the filesystem.

---

### Task 1: Scaffold `@minikb/ui` + token bridge + mini-design-system docs

**Files:**
- Create: `packages/ui/package.json`, `tsconfig.json`, `components.json`, `lib/utils.ts`
- Create: `packages/ui/styles/mini-brand.tokens.css` (copy from mini-design-system), `bridge.css`, `base.css`
- Modify: `mini-design-system/README.md`, `skills/mini-brand/SKILL.md`, `rules/mini-brand-rules.md`
- Create: this plan already references `docs/superpowers/specs/2026-08-19-minikb-ui-kit-design.md`

- [ ] **Step 1:** Create `packages/ui/package.json` with exports for `./components/ui/*`, `./lib/utils`, `./styles/*`, `./markdown`, `./hooks/*`, peerDeps on react/react-dom.
- [ ] **Step 2:** Add `cn()` via clsx + tailwind-merge; copy Direction 02 tokens; write `bridge.css` mapping `--mini-*` → semantic tokens; minimal `base.css`.
- [ ] **Step 3:** Update mini-design-system README + skill + rules with incubation note.
- [ ] **Step 4:** Commit `chore: scaffold @minikb/ui and document incubation`

---

### Task 2: Core primitives (replace current admin building blocks)

**Files:**
- Create: `packages/ui/components/ui/{button,input,textarea,label,badge,card,dialog,alert-dialog,separator,skeleton,spinner,checkbox,switch,alert,progress,empty,field,tabs,tooltip,popover,sheet,select,dropdown-menu,input-group,table,sidebar,sonner}.tsx` (adapt from Multica patterns; Direction 02 sizing via tokens)
- Modify: `web/package.json`, `web/app/globals.css`, `web/tsconfig.json` / Next transpilePackages if needed
- Modify: all pages importing `@/components/Button|Modal|ui`
- Delete: `web/components/Button.tsx`, `Modal.tsx`, `ui.tsx`
- Modify: `CreateKbModal.tsx`, `AppShell.tsx` to use kit

- [ ] **Step 1:** Port button, input, textarea, label, badge, card, dialog, separator, empty.
- [ ] **Step 2:** Wire `@minikb/ui` into web; import kit CSS in globals.
- [ ] **Step 3:** Replace page imports; remove old three files; keep PageHeader/PageShell either as kit layout helpers or thin re-exports under `web/components/layout.tsx` — prefer kit `page-header` style helpers in `components/ui` or `components/common` if they stay generic.
- [ ] **Step 4:** `npm test` / `npm run build` in web; commit `feat: migrate minikb admin to @minikb/ui core`

---

### Task 3: Extended kit (markdown, emoji, chart, calendar, data-table, command)

**Files:**
- Create: `packages/ui/components/ui/{command,calendar,chart,data-table}.tsx` (+ deps)
- Create: `packages/ui/markdown/*` (sanitized Markdown; no Multica issue-id product hooks)
- Create: emoji common components as needed (`emoji-picker` or thin wrappers)
- Modify: `packages/ui/package.json` dependencies (`cmdk`, `recharts`, `react-day-picker`, `react-markdown`, `@tanstack/react-table`, `@tanstack/react-virtual`, shiki/katex as needed)

- [ ] **Step 1:** Add dependencies and port command + calendar.
- [ ] **Step 2:** Port chart + data-table (virtual).
- [ ] **Step 3:** Port markdown + emoji modules stripped of Multica-only coupling.
- [ ] **Step 4:** Typecheck package; commit `feat: add extended @minikb/ui modules`

---

### Task 4: Docker / CI

**Files:**
- Modify: `docker/Dockerfile.web`
- Modify: `.github/workflows/ci.yml` if web job assumes only `web/`

- [ ] **Step 1:** COPY `packages/ui` + `web`; install deps so `file:../packages/ui` resolves.
- [ ] **Step 2:** Verify image builds locally or via CI.
- [ ] **Step 3:** Commit `fix(deploy): build Next image with @minikb/ui`

---

## Done when

- Spec + plan + design-system docs landed.
- Admin UI imports kit components; old Button/Modal/ui gone.
- Extended modules present and typecheck.
- Production Dockerfile can build the web image.
