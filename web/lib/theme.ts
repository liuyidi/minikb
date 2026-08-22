export const THEME_KEY = "minikb.theme";

export type ThemeMode = "system" | "light" | "dark";

export function normalizeTheme(raw: string | null | undefined): ThemeMode {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  return normalizeTheme(localStorage.getItem(THEME_KEY));
}

export function setStoredTheme(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
}

export function resolveDarkMode(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
