export type DimensionTokenEntry = {
  name: string;
  label: string;
  var: string;
  sample?: "radius" | "height" | "width";
};

export const dimensionTokenCatalog: DimensionTokenEntry[] = [
  { name: "mini-radius-control", label: "控件圆角", var: "--mini-radius-control", sample: "radius" },
  { name: "mini-radius-surface", label: "表面圆角", var: "--mini-radius-surface", sample: "radius" },
  { name: "radius", label: "语义控件圆角", var: "--radius", sample: "radius" },
  { name: "radius-lg", label: "语义表面圆角", var: "--radius-lg", sample: "radius" },
  { name: "mini-control-height", label: "控件高度", var: "--mini-control-height", sample: "height" },
  {
    name: "mini-control-height-compact",
    label: "紧凑控件高度",
    var: "--mini-control-height-compact",
    sample: "height",
  },
  { name: "mini-space-auth-width", label: "Auth 卡片宽度", var: "--mini-space-auth-width", sample: "width" },
  { name: "mini-space-auth-top", label: "Auth 顶部间距", var: "--mini-space-auth-top", sample: "height" },
];

export type TypographyTokenEntry = {
  name: string;
  label: string;
  var: string;
  previewClass?: string;
  previewText?: string;
};

export const typographyTokenCatalog: TypographyTokenEntry[] = [
  {
    name: "mini-font-sans",
    label: "Sans 字体栈",
    var: "--mini-font-sans",
    previewText: "知识库 Knowledge Base 0123456789",
  },
  {
    name: "page-title",
    label: "页面标题（PageHeader）",
    previewClass: "text-[28px] font-semibold tracking-[-0.03em]",
    var: "—",
    previewText: "知识库设置",
  },
  {
    name: "body",
    label: "正文",
    previewClass: "text-sm",
    var: "—",
    previewText: "管理文档、分块与检索配置。",
  },
  {
    name: "caption",
    label: "说明 / 次要",
    previewClass: "text-xs text-muted-foreground",
    var: "—",
    previewText: "上次同步于 2 分钟前",
  },
];
