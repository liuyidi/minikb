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

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within Providers");
  }
  return value;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");

  useEffect(() => {
    setLocaleState(getStoredLocale());
    void loadSessionToken();
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, locale, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
