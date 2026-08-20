export type ColorTokenCategory = "brand" | "semantic" | "status" | "chart";

export type ColorTokenEntry = {
  /** Display name, e.g. `background` or `mini-color-canvas` */
  name: string;
  label: string;
  /** CSS custom property including `--` prefix */
  var: string;
  category: ColorTokenCategory;
  /** Source brand token for semantic entries */
  mapsFrom?: string;
  /** Tailwind utility when applicable */
  tailwind?: string;
};

export const colorTokenCatalog: ColorTokenEntry[] = [
  // Brand (--mini-color-*)
  { name: "mini-color-canvas", label: "画布", var: "--mini-color-canvas", category: "brand", tailwind: undefined },
  { name: "mini-color-ink", label: "正文", var: "--mini-color-ink", category: "brand" },
  { name: "mini-color-ink-soft", label: "正文弱化", var: "--mini-color-ink-soft", category: "brand" },
  { name: "mini-color-muted", label: "次要文字", var: "--mini-color-muted", category: "brand" },
  { name: "mini-color-subtle", label: "更弱文字", var: "--mini-color-subtle", category: "brand" },
  { name: "mini-color-surface", label: "表面", var: "--mini-color-surface", category: "brand" },
  { name: "mini-color-surface-hover", label: "表面悬停", var: "--mini-color-surface-hover", category: "brand" },
  { name: "mini-color-border", label: "边框", var: "--mini-color-border", category: "brand" },
  { name: "mini-color-border-soft", label: "浅边框", var: "--mini-color-border-soft", category: "brand" },
  { name: "mini-color-focus", label: "焦点", var: "--mini-color-focus", category: "brand" },
  { name: "mini-color-danger", label: "危险", var: "--mini-color-danger", category: "brand" },
  { name: "mini-color-danger-surface", label: "危险背景", var: "--mini-color-danger-surface", category: "brand" },
  { name: "mini-color-success", label: "成功", var: "--mini-color-success", category: "brand" },
  { name: "mini-color-success-surface", label: "成功背景", var: "--mini-color-success-surface", category: "brand" },
  { name: "mini-color-warning", label: "警告", var: "--mini-color-warning", category: "brand" },
  { name: "mini-color-warning-surface", label: "警告背景", var: "--mini-color-warning-surface", category: "brand" },
  { name: "mini-color-info", label: "信息", var: "--mini-color-info", category: "brand" },
  { name: "mini-color-info-surface", label: "信息背景", var: "--mini-color-info-surface", category: "brand" },
  { name: "mini-color-chart-1", label: "图表 1", var: "--mini-color-chart-1", category: "brand" },
  { name: "mini-color-chart-2", label: "图表 2", var: "--mini-color-chart-2", category: "brand" },
  { name: "mini-color-chart-3", label: "图表 3", var: "--mini-color-chart-3", category: "brand" },
  { name: "mini-color-chart-4", label: "图表 4", var: "--mini-color-chart-4", category: "brand" },
  { name: "mini-color-chart-5", label: "图表 5", var: "--mini-color-chart-5", category: "brand" },

  // Semantic (bridge.css)
  {
    name: "background",
    label: "页面背景",
    var: "--background",
    category: "semantic",
    mapsFrom: "--mini-color-canvas",
    tailwind: "bg-background",
  },
  {
    name: "foreground",
    label: "前景文字",
    var: "--foreground",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "text-foreground",
  },
  {
    name: "card",
    label: "卡片背景",
    var: "--card",
    category: "semantic",
    mapsFrom: "--mini-color-canvas",
    tailwind: "bg-card",
  },
  {
    name: "card-foreground",
    label: "卡片文字",
    var: "--card-foreground",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "text-card-foreground",
  },
  {
    name: "popover",
    label: "浮层背景",
    var: "--popover",
    category: "semantic",
    mapsFrom: "--mini-color-canvas",
    tailwind: "bg-popover",
  },
  {
    name: "popover-foreground",
    label: "浮层文字",
    var: "--popover-foreground",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "text-popover-foreground",
  },
  {
    name: "primary",
    label: "主色",
    var: "--primary",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "bg-primary text-primary",
  },
  {
    name: "primary-foreground",
    label: "主色前景",
    var: "--primary-foreground",
    category: "semantic",
    tailwind: "text-primary-foreground",
  },
  {
    name: "secondary",
    label: "次要背景",
    var: "--secondary",
    category: "semantic",
    mapsFrom: "--mini-color-surface",
    tailwind: "bg-secondary",
  },
  {
    name: "secondary-foreground",
    label: "次要文字",
    var: "--secondary-foreground",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "text-secondary-foreground",
  },
  {
    name: "muted",
    label: "弱化背景",
    var: "--muted",
    category: "semantic",
    mapsFrom: "--mini-color-surface",
    tailwind: "bg-muted",
  },
  {
    name: "muted-foreground",
    label: "弱化文字",
    var: "--muted-foreground",
    category: "semantic",
    mapsFrom: "--mini-color-muted",
    tailwind: "text-muted-foreground",
  },
  {
    name: "accent",
    label: "强调背景",
    var: "--accent",
    category: "semantic",
    mapsFrom: "--mini-color-surface-hover",
    tailwind: "bg-accent",
  },
  {
    name: "accent-foreground",
    label: "强调文字",
    var: "--accent-foreground",
    category: "semantic",
    mapsFrom: "--mini-color-ink",
    tailwind: "text-accent-foreground",
  },
  {
    name: "destructive",
    label: "破坏性操作",
    var: "--destructive",
    category: "semantic",
    mapsFrom: "--mini-color-danger",
    tailwind: "bg-destructive text-destructive",
  },
  {
    name: "destructive-foreground",
    label: "破坏性前景",
    var: "--destructive-foreground",
    category: "semantic",
    tailwind: "text-destructive-foreground",
  },
  {
    name: "border",
    label: "边框",
    var: "--border",
    category: "semantic",
    mapsFrom: "--mini-color-border-soft",
    tailwind: "border-border",
  },
  {
    name: "input",
    label: "输入框边框",
    var: "--input",
    category: "semantic",
    mapsFrom: "--mini-color-border-soft",
    tailwind: "border-input",
  },
  {
    name: "ring",
    label: "焦点环",
    var: "--ring",
    category: "semantic",
    mapsFrom: "--mini-color-focus",
    tailwind: "ring-ring",
  },

  // Status
  {
    name: "success",
    label: "成功",
    var: "--success",
    category: "status",
    mapsFrom: "--mini-color-success",
    tailwind: "text-[var(--success)]",
  },
  {
    name: "success-foreground",
    label: "成功背景",
    var: "--success-foreground",
    category: "status",
    mapsFrom: "--mini-color-success-surface",
    tailwind: "bg-[var(--success-foreground)]",
  },
  {
    name: "warning",
    label: "警告",
    var: "--warning",
    category: "status",
    mapsFrom: "--mini-color-warning",
    tailwind: "text-[var(--warning)]",
  },
  {
    name: "warning-foreground",
    label: "警告背景",
    var: "--warning-foreground",
    category: "status",
    mapsFrom: "--mini-color-warning-surface",
    tailwind: "bg-[var(--warning-foreground)]",
  },
  {
    name: "info",
    label: "信息",
    var: "--info",
    category: "status",
    mapsFrom: "--mini-color-info",
    tailwind: "text-[var(--info)]",
  },
  {
    name: "info-foreground",
    label: "信息背景",
    var: "--info-foreground",
    category: "status",
    mapsFrom: "--mini-color-info-surface",
    tailwind: "bg-[var(--info-foreground)]",
  },

  // Chart
  { name: "chart-1", label: "图表 1", var: "--chart-1", category: "chart", mapsFrom: "--mini-color-chart-1", tailwind: "fill-chart-1" },
  { name: "chart-2", label: "图表 2", var: "--chart-2", category: "chart", mapsFrom: "--mini-color-chart-2", tailwind: "fill-chart-2" },
  { name: "chart-3", label: "图表 3", var: "--chart-3", category: "chart", mapsFrom: "--mini-color-chart-3", tailwind: "fill-chart-3" },
  { name: "chart-4", label: "图表 4", var: "--chart-4", category: "chart", mapsFrom: "--mini-color-chart-4", tailwind: "fill-chart-4" },
  { name: "chart-5", label: "图表 5", var: "--chart-5", category: "chart", mapsFrom: "--mini-color-chart-5", tailwind: "fill-chart-5" },
];

export const colorTokenCategoryLabels: Record<ColorTokenCategory, string> = {
  brand: "品牌色",
  semantic: "语义色",
  status: "状态色",
  chart: "图表色",
};

export function colorTokensByCategory(category: ColorTokenCategory | "all") {
  if (category === "all") return colorTokenCatalog;
  return colorTokenCatalog.filter((entry) => entry.category === category);
}

export function colorTokenVarStatement(entry: ColorTokenEntry) {
  return `var(${entry.var})`;
}

export function colorTokenCssStatement(entry: ColorTokenEntry) {
  return `${entry.var}: ${colorTokenVarStatement(entry)};`;
}
