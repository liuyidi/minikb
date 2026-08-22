"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  FileText,
  FolderInput,
  Info,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { kbPath, type KbPage } from "@/lib/paths";
import { getSidebarCollapsed, setSidebarCollapsed } from "@/lib/sidebar";
import { cn } from "@minikb/ui/lib/utils";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { useLocale } from "@/app/providers";
import { KbInfoDrawer } from "@/components/kb/KbInfoDrawer";
import { KbBackLink } from "@/components/kb/KbBackLink";
import { SidebarUserMenu } from "@/components/sidebar/SidebarUserMenu";

type KbItem = { id: string; name: string };

const GLOBAL_LINKS: {
  href: string;
  labelKey: string;
  sectionKey?: string;
  icon: LucideIcon;
}[] = [
  { href: "/", labelKey: "tab.dashboard", sectionKey: "nav.home", icon: LayoutDashboard },
  { href: "/kbs", labelKey: "tab.kb", icon: Database },
  { href: "/settings", labelKey: "tab.settings", sectionKey: "nav.system", icon: Settings },
];

const KB_LINKS: { page: KbPage; labelKey: string; sectionKey?: string; icon: LucideIcon }[] = [
  { page: "documents", labelKey: "tab.documents", sectionKey: "nav.content", icon: FileText },
  { page: "sources", labelKey: "tab.sources", icon: FolderInput },
  { page: "chunks", labelKey: "tab.chunks", icon: Layers },
  { page: "retrieval", labelKey: "tab.retrieval", sectionKey: "nav.intel", icon: Search },
  { page: "qa", labelKey: "tab.qa", icon: MessageSquare },
  { page: "eval", labelKey: "tab.eval", icon: BarChart3 },
  { page: "settings", labelKey: "tab.kbConfig", sectionKey: "nav.manage", icon: SlidersHorizontal },
];

function parseKbId(pathname: string): string | null {
  const match = pathname.match(/^\/kb\/([^/]+)/);
  return match?.[1] ?? null;
}

function currentKbPage(pathname: string, kbId: string): KbPage {
  const prefix = `/kb/${kbId}/`;
  if (!pathname.startsWith(prefix)) return "documents";
  const page = pathname.slice(prefix.length).split("/")[0];
  if (KB_LINKS.some((link) => link.page === page)) return page as KbPage;
  return "documents";
}

function NavLink({
  href,
  active,
  collapsed,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? String(children) : undefined}
      className={cn(
        "flex items-center gap-2 rounded-[var(--mini-radius-control)] px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--mini-color-surface)] font-medium text-[var(--mini-color-ink)]"
          : "text-[var(--mini-color-muted)] hover:bg-[var(--mini-color-surface)]/60 hover:text-[var(--mini-color-ink)]",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? <span className="truncate">{children}</span> : null}
    </Link>
  );
}

function NavSection({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div
      className="mb-2 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--mini-color-subtle)] first:mt-0"
    >
      {label}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const kbId = parseKbId(pathname);
  const inKb = kbId !== null;
  const [kbs, setKbs] = useState<KbItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [kbInfoOpen, setKbInfoOpen] = useState(false);

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }

  useEffect(() => {
    if (!inKb) return;
    void (async () => {
      const resp = await api("/v1/kb");
      if (!resp.ok) return;
      const data = (await resp.json()) as { items: KbItem[] };
      setKbs(data.items);
    })();
  }, [inKb, kbId]);

  const kbPage = kbId ? currentKbPage(pathname, kbId) : null;

  const globalLinks = useMemo(() => {
    let lastSection: string | undefined;
    return GLOBAL_LINKS.map((link) => {
      const sectionKey = link.sectionKey ?? "nav.home";
      const showSection = sectionKey !== lastSection;
      lastSection = sectionKey;
      return { ...link, showSection, sectionKey };
    });
  }, []);

  const kbLinks = useMemo(() => {
    let lastSection: string | undefined;
    return KB_LINKS.map((link) => {
      const showSection = link.sectionKey !== undefined && link.sectionKey !== lastSection;
      if (link.sectionKey) lastSection = link.sectionKey;
      return { ...link, showSection };
    });
  }, []);

  const kbItems = useMemo(
    () =>
      kbs.length === 0 && kbId
        ? [{ value: kbId, label: kbId }]
        : kbs.map((kb) => ({ value: kb.id, label: kb.name })),
    [kbs, kbId],
  );

  return (
    <div className="flex h-screen min-h-0">
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col border-r border-[var(--mini-color-border-soft)] bg-[var(--mini-color-canvas)] transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        {!collapsed ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--mini-color-border-soft)] px-3 py-4">
            <Link href="/" className="min-w-0 flex-1 px-1">
              <div className="text-lg font-semibold tracking-tight text-[var(--mini-color-ink)]">minikb</div>
              <div className="mt-0.5 text-xs text-[var(--mini-color-muted)]">{t("subtitle")}</div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 p-0"
              aria-label={t("sidebar.collapse")}
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="group relative shrink-0 border-b border-[var(--mini-color-border-soft)] px-2 py-4">
            <Link
              href="/"
              className="mx-auto flex size-9 items-center justify-center rounded-md text-sm font-bold text-[var(--mini-color-ink)] transition-opacity group-hover:opacity-0"
              title="minikb"
            >
              m
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={t("sidebar.expand")}
              onClick={toggleCollapsed}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {inKb && kbId ? (
            <>
              {!collapsed ? (
                <div className="mb-3 px-3">
                  <label
                    htmlFor="kb-switcher"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--mini-color-subtle)]"
                  >
                    {t("tab.kb")}
                  </label>
                  <div className="flex items-center gap-1">
                    <Select
                      size="sm"
                      items={kbItems}
                      value={kbId}
                      onValueChange={(value) => router.push(kbPath(String(value), kbPage ?? "documents"))}
                    >
                      <SelectTrigger id="kb-switcher" className="min-w-0 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {kbItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-8 shrink-0 p-0"
                      aria-label={t("kb.openInfo")}
                      onClick={() => setKbInfoOpen(true)}
                    >
                      <Info className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-2 flex flex-col items-center gap-1">
                  <Link
                    href="/kbs"
                    title={t("tab.kb")}
                    className="flex size-9 items-center justify-center rounded-md text-[var(--mini-color-muted)] hover:bg-[var(--mini-color-surface)] hover:text-[var(--mini-color-ink)]"
                  >
                    <Database className="size-4" />
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    aria-label={t("kb.openInfo")}
                    onClick={() => setKbInfoOpen(true)}
                  >
                    <Info className="size-4" />
                  </Button>
                </div>
              )}

              {kbLinks.map((link) => (
                <div key={link.page}>
                  {link.showSection && link.sectionKey ? (
                    <NavSection label={t(link.sectionKey)} collapsed={collapsed} />
                  ) : null}
                  <NavLink
                    href={kbPath(kbId, link.page)}
                    active={pathname === kbPath(kbId, link.page)}
                    collapsed={collapsed}
                    icon={link.icon}
                  >
                    {t(link.labelKey)}
                  </NavLink>
                </div>
              ))}

            </>
          ) : (
            globalLinks.map((link) => (
              <div key={link.href}>
                {link.showSection ? (
                  <NavSection label={t(link.sectionKey)} collapsed={collapsed} />
                ) : null}
                <NavLink
                  href={link.href}
                  active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
                  collapsed={collapsed}
                  icon={link.icon}
                >
                  {t(link.labelKey)}
                </NavLink>
              </div>
            ))
          )}
        </nav>

        <div className="shrink-0 border-t border-[var(--mini-color-border-soft)] p-2">
          <SidebarUserMenu collapsed={collapsed} />
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--mini-color-canvas)]">
        {inKb && kbId ? <KbBackLink /> : null}
        {children}
      </main>

      {kbId ? (
        <KbInfoDrawer
          kbId={kbId}
          open={kbInfoOpen}
          onOpenChange={setKbInfoOpen}
        />
      ) : null}
    </div>
  );
}
