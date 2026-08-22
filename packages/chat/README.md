# @minikb/chat

AI chat business components for Mini products (Direction 02). Incubates here;
target extract: `@mini-design-system/chat`.

## Stack

- **Web (now):** React 19 + `@minikb/ui` primitives + Mini brand tokens
- **RN (later):** mirror prop contracts in `@minibot/ui`; share types from `@minikb/chat/types`

## Install (local monorepo)

```bash
cd packages/chat
npm install
```

Consumers add a file dependency:

```json
"@minikb/chat": "file:../packages/chat"
```

Import styles once at the app shell:

```ts
import "@minikb/ui/styles/bridge.css";
import "@minikb/chat/styles/chat.css";
```

## Preview

Storybook runs from `@minikb/ui` and includes chat stories:

```bash
cd packages/ui
npm run storybook
```

## Components (v0)

| Component | Role |
|-----------|------|
| `Attachments` | Horizontal/vertical attachment list (TDesign-compatible overflow modes) |
| `AttachmentCard` | Single file or image card with upload status |
| `ChatSender` | Controlled composer shell with attachment strip + slots |
| `ChatBubble` | User/assistant message shell with Markdown + attachments |
| `StreamingIndicator` | Typing / generating dots |

## Design principles

- **Presentation only** — no streaming protocol, WS, or upload implementation
- **Controlled data** — parent owns `items`, `value`, `status`, `progress`
- **Slots over props** — product chrome (model picker, context meter) injects via `slots`
- **Labels via props** — no i18n dependency; apps pass `labels`

## Cross-platform types

Platform-agnostic types live under `@minikb/chat/types` (or `@minikb/chat/types/attachment`).
Web components import them; future RN kit should copy or re-export the same shapes.

```ts
import type { ChatAttachment } from "@minikb/chat/types";
```

## Related

- Brand tokens: [mini-design-system](https://github.com/liuyidi/mini-design-system)
- Web primitives: `@minikb/ui`
- RN primitives (incubating): `@minibot/ui`
