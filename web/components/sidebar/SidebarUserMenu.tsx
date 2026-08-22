"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  SunMoon,
  User,
} from "lucide-react";
import { useLocale, useTheme } from "@/app/providers";
import { Avatar, AvatarFallback } from "@minikb/ui/components/ui/avatar";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@minikb/ui/components/ui/popover";
import { cn } from "@minikb/ui/lib/utils";
import { getSessionUser, loadSessionToken } from "@/lib/api";
import type { Locale } from "@/lib/locale";
import type { ThemeMode } from "@/lib/theme";

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; icon: React.ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
              "hover:text-foreground",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  collapsed: boolean;
};

export function SidebarUserMenu({ collapsed }: Props) {
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(() => getSessionUser()?.displayName ?? t("user.guest"));

  useEffect(() => {
    void loadSessionToken().then(() => {
      const user = getSessionUser();
      if (user?.displayName) setDisplayName(user.displayName);
    });
  }, [t]);

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: t("theme.system"), icon: <Monitor className="size-3.5" /> },
    { value: "light", label: t("theme.light"), icon: <Sun className="size-3.5" /> },
    { value: "dark", label: t("theme.dark"), icon: <Moon className="size-3.5" /> },
  ];

  const localeOptions: { value: Locale; label: string; icon: React.ReactNode }[] = [
    { value: "zh-CN", label: t("lang.zh"), icon: <span className="text-[11px] font-semibold">简</span> },
    { value: "en", label: t("lang.en"), icon: <span className="text-[11px] font-semibold">EN</span> },
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            type="button"
            className={cn(
              "h-auto w-full justify-start gap-2 px-2 py-2",
              collapsed && "justify-center px-0",
            )}
          />
        }
      >
        <Avatar size="sm" className="size-8">
          <AvatarFallback>
            <User className="size-4" aria-hidden />
          </AvatarFallback>
        </Avatar>
        {!collapsed ? (
          <span className="min-w-0 truncate text-left text-sm font-medium text-foreground">
            {displayName}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-72 p-2">
        <div className="px-2 py-1.5 text-sm font-medium text-foreground">{displayName}</div>

        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
        >
          <Settings className="size-4 text-muted-foreground" />
          {t("user.settings")}
        </Link>

        <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <SunMoon className="size-4 text-muted-foreground" />
            {t("theme.label")}
          </span>
          <OptionGroup value={theme} options={themeOptions} onChange={setTheme} ariaLabel={t("theme.label")} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <Languages className="size-4 text-muted-foreground" />
            {t("lang.label")}
          </span>
          <OptionGroup
            value={locale}
            options={localeOptions}
            onChange={setLocale}
            ariaLabel={t("lang.label")}
          />
        </div>

        <a
          href="/api/auth/logout"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
        >
          <LogOut className="size-4 text-muted-foreground" />
          {t("auth.logout")}
        </a>
      </PopoverContent>
    </Popover>
  );
}
