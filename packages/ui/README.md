# @minikb/ui — incubating Mini React kit (Direction 02)

Consumed by `web/` via `"@minikb/ui": "file:../packages/ui"`.
Future extract: `@mini-design-system/ui`.

- Brand tokens: `styles/mini-brand.tokens.css` (from mini-design-system)
- Semantic bridge: `styles/bridge.css`
- Spec: `docs/superpowers/specs/2026-08-19-minikb-ui-kit-design.md`

## Storybook（组件预览 + 源码）

侧边栏：**主题**（颜色 / 字体 / 尺寸 token）· **图标** · **图表** · **Components**（含 Select、Field、Tooltip、Dropdown、AlertDialog 等）。

```bash
cd packages/ui
npm install
npm run storybook
```

Open http://127.0.0.1:6006

```bash
npm run build-storybook   # → storybook-static/
```

Brand direction previews (Landing / Auth / Dashboard mockups) remain in
[mini-design-system](https://github.com/liuyidi/mini-design-system) — do not duplicate
them as a fake HTML component gallery here.
