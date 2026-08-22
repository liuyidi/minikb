export const THEME_PRESET_KEY = "minikb.themePreset";

export type ThemePreset = "paper" | "stone" | "slate" | "ink" | "claude" | "feishu-aily";

export const DEFAULT_THEME_PRESET: ThemePreset = "paper";

export type ThemePresetMeta = {
  id: ThemePreset;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
};

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: "paper",
    nameZh: "纸白",
    nameEn: "Paper",
    descZh: "当前默认，大面积留白，卡片与背景对比弱",
    descEn: "Current default — airy white, low card contrast",
  },
  {
    id: "stone",
    nameZh: "石色",
    nameEn: "Stone",
    descZh: "暖灰底 + 白卡片，模块边界更清晰",
    descEn: "Warm gray canvas with elevated white cards",
  },
  {
    id: "slate",
    nameZh: "板岩",
    nameEn: "Slate",
    descZh: "冷灰产品感，蓝色焦点，适合数据面板",
    descEn: "Cool slate with blue focus, dashboard feel",
  },
  {
    id: "ink",
    nameZh: "墨印",
    nameEn: "Ink",
    descZh: "高对比边框与文字，模块块面感最强",
    descEn: "High-contrast borders and ink-black text",
  },
  {
    id: "claude",
    nameZh: "Claude",
    nameEn: "Claude",
    descZh: "奶油暖底 + 陶土色焦点，接近 claude.ai 阅读感",
    descEn: "Warm cream canvas with terracotta accents, claude.ai inspired",
  },
  {
    id: "feishu-aily",
    nameZh: "飞书 Aily",
    nameEn: "Feishu Aily",
    descZh: "飞书 UD 灰阶 + 品牌蓝，参考 Aily 工作台 token",
    descEn: "Feishu UD neutrals and brand blue, from Aily workbench tokens",
  },
];

export function normalizeThemePreset(raw: string | null | undefined): ThemePreset {
  if (
    raw === "paper" ||
    raw === "stone" ||
    raw === "slate" ||
    raw === "ink" ||
    raw === "claude" ||
    raw === "feishu-aily"
  )
    return raw;
  return DEFAULT_THEME_PRESET;
}

export function getStoredThemePreset(): ThemePreset {
  if (typeof window === "undefined") return DEFAULT_THEME_PRESET;
  return normalizeThemePreset(localStorage.getItem(THEME_PRESET_KEY));
}

export function setStoredThemePreset(preset: ThemePreset): void {
  localStorage.setItem(THEME_PRESET_KEY, preset);
}

export function applyThemePresetToRoot(preset: ThemePreset): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.themePreset = preset;
}
