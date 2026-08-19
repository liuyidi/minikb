export const LOCALE_KEY = "minikb.locale";

export type Locale = "zh-CN" | "en";

export function normalizeLocale(raw: string | null | undefined): Locale {
  let value = raw || "zh-CN";
  if (value === "zh") value = "zh-CN";
  if (value !== "zh-CN" && value !== "en") return "zh-CN";
  return value;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";
  return normalizeLocale(localStorage.getItem(LOCALE_KEY));
}

export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}
