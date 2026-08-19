# minikb UI kit (`@minikb/ui`) Design

**Date:** 2026-08-19  
**Status:** Approved for implementation  
**Repos:** minikb (`packages/ui` incubator) → later `@mini-design-system/ui`

## Goal

Stand up a Multica-shaped React component library for Mini products, using Direction 02 tokens from mini-design-system. Host it inside minikb for now; document the migration path in mini-design-system.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Full dashboard primitives **plus** markdown, emoji, chart, calendar, data-table (virtual), command |
| Location | `minikb/packages/ui`, package name `@minikb/ui` |
| Pattern | Align with `@multica/ui`: `components/ui/*`, `components.json`, Tailwind 4, `@base-ui/react`, `cva`, lucide, `cn()` |
| Brand | Direction 02: white canvas, near-black ink, no dark mode in v1 |
| Tokens | Source: `--mini-*` from mini-design-system; bridge to shadcn semantic vars (`--background`, `--primary`, …) |
| App migration | Delete `web/components/Button.tsx`, `Modal.tsx`, `ui.tsx`; pages import from `@minikb/ui` directly |
| Stay in `web/` | `AppShell`, `CreateKbModal`, page-level composition (`PageHeader` may move into kit as layout helpers if useful) |
| Out of kit | Auth/OIDC, i18n message catalogs, product routing |

## Package layout

```text
minikb/packages/ui/
  package.json          # @minikb/ui, exports map like @multica/ui
  components.json       # shadcn-style aliases → @minikb/ui/...
  styles/
    mini-brand.tokens.css   # vendored or re-exported from mini-design-system
    bridge.css              # --mini-* → --background / --primary / …
    base.css                # minimal shared base (no Multica chat-launcher utilities)
  components/ui/          # button, input, dialog, table, sidebar, chart, calendar, command, …
  components/common/      # theme-provider (light-only), emoji helpers as needed
  markdown/               # Markdown, CodeBlock, sanitize (adapted; no Multica issue-id product coupling)
  lib/utils.ts            # cn()
  hooks/
```

## Token bridge (Direction 02)

Map brand → semantic (light only):

- `--background` / `--card` / `--popover` ← `--mini-color-canvas`
- `--foreground` / `--primary` ← `--mini-color-ink`
- `--primary-foreground` ← `#ffffff`
- `--muted` / `--secondary` ← `--mini-color-surface`
- `--muted-foreground` ← `--mini-color-muted`
- `--border` / `--input` ← `--mini-color-border-soft`
- `--ring` / `--focus` ← `--mini-color-focus`
- `--destructive` ← `--mini-color-danger`
- `--radius` ← `--mini-radius-control` (and surface radius for cards)

## Web integration

- `web/package.json` depends on `"@minikb/ui": "file:../packages/ui"`.
- Import styles in `globals.css`: brand tokens + bridge + kit base.
- `Dockerfile.web` must COPY `packages/ui` and install both package trees (or a small workspace install).
- CI web job builds with the same layout.

## mini-design-system docs

Update README + `skills/mini-brand/SKILL.md` (+ short note in rules):

1. Tokens remain the SoT in this repo.
2. React kit currently incubates at `minikb/packages/ui` (`@minikb/ui`).
3. Other Mini apps must not depend on it until migrated to `@mini-design-system/ui`.
4. When implementing UI: prefer kit components; otherwise follow tokens + rules.

## Non-goals (this phase)

- Publishing to npm.
- Physical move into mini-design-system repo.
- Dark theme.
- Copying Multica product-only chrome (chat launcher clearance, Multica issue identifiers, Multica brand icon).

## Success criteria

- `@minikb/ui` typechecks; `web` builds with Next standalone.
- Admin pages use kit Button / Dialog / Card / Badge / Input (etc.); old three files removed.
- mini-design-system docs describe incubation + future package name.
