# minikb Picker Components (`DatePicker` / `TimePicker` / `DateTimePicker`) Design
 
**Date:** 2026-08-20  
**Status:** Ready for review  
**Repo:** minikb (`packages/ui` incubator)

## Goal

Add custom “picker” components to `@minikb/ui`:

- `DatePicker` 组件：选择单个日期
- `TimePicker` 组件：选择 HH:MM（24 小时制）
- `DateTimePicker` 组件：组合 `DatePicker + TimePicker`

Time 选择器采用“完整自定义”的分段 HH:MM 交互（支持键盘/箭头微调），不使用原生 `input[type="time"]`。

## Decisions

### Value types（用户确认：选择 A）

- `TimePicker`
  - `value: string | null`
  - 格式：`"HH:MM"`，例如 `"09:30"`
  - `onChange(next: string | null)`
- `DatePicker`
  - `value: Date | null`
  - `onChange(next: Date | null)`
- `DateTimePicker`
  - `value: Date | null`
  - `onChange(next: Date | null)`
  - 语义：日期来自 `DatePicker`（本地日期），时间来自 `TimePicker`（本地时分），写回到同一个 `Date` 对象

### 交互实现（推荐）

- `DatePicker` 弹层：使用现有 `@minikb/ui/components/ui/calendar` + `Popover`
- `TimePicker` 弹层：使用“分段 HH:MM 自定义输入”（小时段 + 分钟段）
  - 小时与分钟均支持：
    - 数字连续输入（两位）
    - ArrowUp/ArrowDown 增减
    - ArrowLeft/ArrowRight 在小时/分钟段间切换
- `DateTimePicker` 弹层：
  - 同一个 `Popover` 中同时渲染 `Calendar` 与 `TimePicker` 的时间输入段

### 组件边界与最小可用（YAGNI）

本阶段只做“单值选择 + 可清空 + disabled”。
不内置：
- time range（区间）
- timezone picker
- 秒级粒度
- 复杂快捷按钮（e.g. now / yesterday）

后续可在独立 PR 扩展 `min/max`、快捷 preset、range 模式。

## Proposed API

### `TimePicker`

```ts
type TimePickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  placeholder?: string; // default "HH:MM"
  // 若需要“允许选择小时粒度（分钟忽略）”，保留扩展点
  hourOnly?: boolean;
}
```

输出：
- `hourOnly=false`：始终输出 `"HH:MM"`
- `hourOnly=true`：输出 `"HH:00"` 或仅输出 `"HH:00"`（约定由实现决定，后续可再讨论）

### `DatePicker`

```ts
type DatePickerProps = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  disabled?: boolean;
  placeholder?: string; // e.g. "请选择日期"
  // 先不做 range；Calendar 用 mode="single"
}
```

### `DateTimePicker`

```ts
type DateTimePickerProps = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

## Rendering / Layout

### 触发器（Trigger）

- `DatePicker / TimePicker / DateTimePicker` 触发器外观对齐现有 `Input`：
  - 使用 `--radius` + border + background（light-only，沿用 Direction 02）
- 触发器内显示：
  - `value`：格式化后的文本
  - `null`：placeholder（muted）

### 弹层（Popover Content）

- `DatePicker`：居中日历
- `TimePicker`：分段时间输入（小时/分钟）
- `DateTimePicker`：建议布局
  - 横向（>= sm）：左 `Calendar`，右时间输入
  - 纵向（< sm）：日历在上，时间在下

## Data flow

- 所有组件均为 controlled：
  - `value` 由父组件提供
  - `onChange` 在用户交互后立即调用
- `DateTimePicker`
  - 选择日期时：保留当前时间部分（若当前 value 为 null，则使用默认时间 `00:00`）
  - 选择时间时：保留当前日期部分（若当前 value 为 null，则使用默认日期为今日或不改变日期：需要实现选择其一，并在 PR 里明确）

## Edge cases

1. `value === null`
   - `DatePicker`：calendar 初始化默认月份（可用 today month）
   - `TimePicker`：时间输入显示 `00:00` 还是空态（需要实现选择并保持一致）
2. 快速清空
   - 触发清空按钮（若要做）或允许在触发器上双击清空（本阶段可先不做额外 UI，只保留受控 `onChange(null)` 能力）
3. keyboard
   - 分段时间输入必须保证：
     - digit typing 不被浏览器默认行为打断
     - ArrowUp/ArrowDown 只改动当前段

## Accessibility

- 触发器必须具备明确的 `aria-label`
- 弹层打开后 focus 应落在第一个可交互元素：
  - `TimePicker`：小时段
  - `DatePicker`：日历（可聚焦到当天）
- 清晰的键盘可用路径：
  - Tab 在段之间移动
  - ArrowLeft/ArrowRight 在小时/分钟段切换

## Testing / Verification

- Storybook：
  - `DatePicker`：默认、禁用、切换月份、清空态（value=null）
  - `TimePicker`：键盘输入、箭头增减、hourOnly（如实现）
  - `DateTimePicker`：先选日期后选时间、先选时间后选日期
- TypeScript：
  - `npm run typecheck` 与 `npm run build-storybook`

## Implementation Notes (for engineering)

- `TimePicker` 的“分段 HH:MM 自定义输入”建议直接改造/搬运自 multica 的 `TimeInput` 思路（键盘行为与双位输入 window）。
- 新增文件建议放在：
  - `packages/ui/components/ui/date-picker.tsx`
  - `packages/ui/components/ui/time-picker.tsx`
  - `packages/ui/components/ui/datetime-picker.tsx`
  - 若需要内部输入组件：`packages/ui/components/ui/time-input.tsx`
- Story 放到 `packages/ui/stories/pickers/`（或按你已有目录命名约定放入 Components/表单/…）

