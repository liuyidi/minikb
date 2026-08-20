import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@minikb/ui/components/ui/input";
import { cn } from "@minikb/ui/lib/utils";
import {
  colorTokenCatalog,
  colorTokenCategoryLabels,
  colorTokenVarStatement,
  colorTokensByCategory,
  type ColorTokenCategory,
  type ColorTokenEntry,
} from "./catalog";

type ColorTokenGalleryProps = {
  category?: ColorTokenCategory | "all";
  showCategory?: boolean;
};

function useResolvedColor(cssVar: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setResolved(getComputedStyle(node).backgroundColor);
  }, [cssVar]);

  return { ref, resolved };
}

function TokenSwatch({
  entry,
  showCategory,
  copied,
  onCopy,
}: {
  entry: ColorTokenEntry;
  showCategory: boolean;
  copied: string | null;
  onCopy: (entry: ColorTokenEntry) => void;
}) {
  const { ref, resolved } = useResolvedColor(entry.var);
  const isCopied = copied === entry.var;

  return (
    <button
      type="button"
      onClick={() => onCopy(entry)}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div
        className="relative h-16 w-full border-b border-border"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
          backgroundSize: "12px 12px",
          backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
        }}
      >
        <div
          ref={ref}
          className="absolute inset-0"
          style={{ backgroundColor: `var(${entry.var})` }}
          aria-hidden
        />
      </div>
      <div className="space-y-0.5 p-3">
        <p className="text-xs font-medium text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{entry.label}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{entry.var}</p>
        {resolved ? <p className="font-mono text-[10px] text-muted-foreground">{resolved}</p> : null}
        {entry.mapsFrom ? (
          <p className="text-[10px] text-muted-foreground/80">← {entry.mapsFrom}</p>
        ) : null}
        {entry.tailwind ? (
          <p className="font-mono text-[10px] text-muted-foreground/80">{entry.tailwind}</p>
        ) : null}
        {showCategory ? (
          <p className="text-[10px] text-muted-foreground/80">
            {colorTokenCategoryLabels[entry.category]}
          </p>
        ) : null}
        <p className={cn("text-[10px]", isCopied ? "text-primary" : "text-muted-foreground/70")}>
          {isCopied ? "已复制 var()" : "点击复制 var()"}
        </p>
      </div>
    </button>
  );
}

export function ColorTokenGallery({
  category = "all",
  showCategory = false,
}: ColorTokenGalleryProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const entries = useMemo(() => {
    const base = colorTokensByCategory(category);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.label.includes(q) ||
        entry.var.toLowerCase().includes(q) ||
        (entry.mapsFrom?.toLowerCase().includes(q) ?? false) ||
        (entry.tailwind?.toLowerCase().includes(q) ?? false),
    );
  }, [category, query]);

  async function handleCopy(entry: ColorTokenEntry) {
    const statement = colorTokenVarStatement(entry);
    try {
      await navigator.clipboard.writeText(statement);
      setCopied(entry.var);
      window.setTimeout(() => setCopied((current) => (current === entry.var ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Direction 02 · 品牌 token（<code className="rounded bg-muted px-1 text-xs">--mini-*</code>
          ）经 <code className="rounded bg-muted px-1 text-xs">bridge.css</code> 映射为组件语义色。点击色块复制{" "}
          <code className="rounded bg-muted px-1 text-xs">var(--token)</code>
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 token 名、中文或 Tailwind…"
          className="max-w-sm"
        />
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">没有匹配的 token</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <TokenSwatch
              key={entry.var}
              entry={entry}
              showCategory={showCategory}
              copied={copied}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        共 {entries.length} 个
        {category === "all" ? ` / ${colorTokenCatalog.length} 个颜色 token` : ""}
      </p>
    </div>
  );
}
