"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadSessionToken } from "@/lib/api";
import { t as translate } from "@/lib/i18n";
import { getStoredLocale, setStoredLocale, type Locale } from "@/lib/locale";
import {
  getStoredTheme,
  resolveDarkMode,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";
import {
  applyThemePresetToRoot,
  getStoredThemePreset,
  setStoredThemePreset,
  type ThemePreset,
} from "@/lib/theme-presets";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within Providers");
  }
  return value;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within Providers");
  }
  return value;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [themePreset, setThemePresetState] = useState<ThemePreset>("paper");

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setThemeState(getStoredTheme());
    const preset = getStoredThemePreset();
    setThemePresetState(preset);
    applyThemePresetToRoot(preset);
    void loadSessionToken();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  useEffect(() => {
    applyThemePresetToRoot(themePreset);
  }, [themePreset]);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark: boolean) => {
      root.classList.toggle("dark", dark);
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const onChange = (event: MediaQueryListEvent) => applyDark(event.matches);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    applyDark(resolveDarkMode(theme));
  }, [theme]);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  const setThemePreset = useCallback((next: ThemePreset) => {
    setStoredThemePreset(next);
    setThemePresetState(next);
    applyThemePresetToRoot(next);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setStoredTheme(next);
    setThemeState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, locale, vars),
    [locale],
  );

  const localeValue = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  const themeValue = useMemo(
    () => ({ theme, setTheme, themePreset, setThemePreset }),
    [theme, setTheme, themePreset, setThemePreset],
  );

  return (
    <LocaleContext.Provider value={localeValue}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </LocaleContext.Provider>
  );
}
