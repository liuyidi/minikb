"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/app/providers";
import { api } from "@/lib/api";
import { kbPath, type KbPage } from "@/lib/paths";

type KbItem = { id: string; name: string };

const GLOBAL_LINKS = [
  { href: "/", labelKey: "tab.dashboard" },
  { href: "/kbs", labelKey: "tab.kb" },
  { href: "/settings", labelKey: "tab.settings", sectionKey: "nav.system" },
] as const;

const KB_LINKS: { page: KbPage; labelKey: string; sectionKey?: string }[] = [
  { page: "documents", labelKey: "tab.documents", sectionKey: "nav.content" },
  { page: "sources", labelKey: "tab.sources" },
  { page: "chunks", labelKey: "tab.chunks" },
  { page: "retrieval", labelKey: "tab.retrieval", sectionKey: "nav.intel" },
  { page: "qa", labelKey: "tab.qa" },
  { page: "eval", labelKey: "tab.eval" },
  { page: "settings", labelKey: "tab.settings", sectionKey: "nav.system" },
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
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: "var(--mini-radius-control)",
        fontSize: 14,
        color: active ? "var(--mini-color-ink)" : "var(--mini-color-muted)",
        background: active ? "var(--mini-color-surface)" : "transparent",
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </Link>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 8,
        padding: "0 12px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--mini-color-subtle)",
      }}
    >
      {label}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const kbId = parseKbId(pathname);
  const inKb = kbId !== null;
  const [kbs, setKbs] = useState<KbItem[]>([]);

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
      const sectionKey = "sectionKey" in link ? link.sectionKey : "nav.home";
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

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 248,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--mini-color-border-soft)",
          background: "var(--mini-color-canvas)",
          padding: "24px 16px",
        }}
      >
        <Link href="/" style={{ display: "block", padding: "0 12px 24px" }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>minikb</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--mini-color-muted)" }}>
            {t("subtitle")}
          </div>
        </Link>

        {inKb && kbId ? (
          <>
            <div style={{ padding: "0 12px 16px" }}>
              <label
                htmlFor="kb-switcher"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--mini-color-subtle)",
                }}
              >
                {t("tab.kb")}
              </label>
              <select
                id="kb-switcher"
                value={kbId}
                onChange={(event) => router.push(kbPath(event.target.value, kbPage ?? "documents"))}
                style={{
                  width: "100%",
                  height: "var(--mini-control-height-compact)",
                  padding: "0 12px",
                  borderRadius: "var(--mini-radius-control)",
                  border: "1px solid var(--mini-color-border-soft)",
                  background: "var(--mini-color-canvas)",
                  color: "var(--mini-color-ink)",
                  fontSize: 14,
                }}
              >
                {kbs.length === 0 ? (
                  <option value={kbId}>{kbId}</option>
                ) : (
                  kbs.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {kbLinks.map((link) => (
              <div key={link.page}>
                {link.showSection && link.sectionKey ? (
                  <NavSection label={t(link.sectionKey)} />
                ) : null}
                <NavLink
                  href={kbPath(kbId, link.page)}
                  active={pathname === kbPath(kbId, link.page)}
                >
                  {t(link.labelKey)}
                </NavLink>
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <NavLink href="/kbs" active={false}>
                ← {t("tab.kb")}
              </NavLink>
            </div>
          </>
        ) : (
          globalLinks.map((link) => (
            <div key={link.href}>
              {link.showSection ? <NavSection label={t(link.sectionKey)} /> : null}
              <NavLink
                href={link.href}
                active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
              >
                {t(link.labelKey)}
              </NavLink>
            </div>
          ))
        )}

        <div style={{ marginTop: "auto", padding: "24px 12px 0" }}>
          <label
            htmlFor="locale-select"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 12,
              color: "var(--mini-color-muted)",
            }}
          >
            {t("lang.label")}
          </label>
          <select
            id="locale-select"
            value={locale}
            onChange={(event) => setLocale(event.target.value as typeof locale)}
            style={{
              width: "100%",
              height: "var(--mini-control-height-compact)",
              padding: "0 12px",
              borderRadius: "var(--mini-radius-control)",
              border: "1px solid var(--mini-color-border-soft)",
              background: "var(--mini-color-canvas)",
              color: "var(--mini-color-ink)",
              fontSize: 14,
            }}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, background: "var(--mini-color-canvas)" }}>
        {children}
      </main>
    </div>
  );
}
