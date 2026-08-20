import { useMemo, useState } from "react";
import { Input } from "@minikb/ui/components/ui/input";
import { cn } from "@minikb/ui/lib/utils";
import {
  iconCatalog,
  iconCategoryLabels,
  iconImportStatement,
  iconsByCategory,
  type IconCategory,
  type IconEntry,
} from "./catalog";

type IconGalleryProps = {
  category?: IconCategory | "all";
  iconSize?: number;
  showCategory?: boolean;
};

function IconTile({
  entry,
  iconSize,
  showCategory,
  copied,
  onCopy,
}: {
  entry: IconEntry;
  iconSize: number;
  showCategory: boolean;
  copied: string | null;
  onCopy: (entry: IconEntry) => void;
}) {
  const { Icon } = entry;
  const importName = entry.importName ?? entry.name;
  const isCopied = copied === importName;

  return (
    <button
      type="button"
      onClick={() => onCopy(entry)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-colors",
        "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Icon className="text-foreground" style={{ width: iconSize, height: iconSize }} aria-hidden />
      <div className="w-full space-y-0.5">
        <p className="text-xs font-medium text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{entry.label}</p>
        {showCategory ? (
          <p className="text-xs text-muted-foreground/80">
            {iconCategoryLabels[entry.category]}
          </p>
        ) : null}
        <p className={cn("text-xs", isCopied ? "text-primary" : "text-muted-foreground/70")}>
          {isCopied ? "已复制 import" : "点击复制 import"}
        </p>
      </div>
    </button>
  );
}

export function IconGallery({
  category = "all",
  iconSize = 24,
  showCategory = false,
}: IconGalleryProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const entries = useMemo(() => {
    const base = iconsByCategory(category);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.label.includes(q) ||
        (entry.importName?.toLowerCase().includes(q) ?? false),
    );
  }, [category, query]);

  async function handleCopy(entry: IconEntry) {
    const statement = iconImportStatement(entry);
    const symbol = entry.importName ?? entry.name;
    try {
      await navigator.clipboard.writeText(statement);
      setCopied(symbol);
      window.setTimeout(() => setCopied((current) => (current === symbol ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Lucide React · 点击图标复制{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">import</code> 语句
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索英文名或中文…"
          className="max-w-sm"
        />
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">没有匹配的图标</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {entries.map((entry) => (
            <IconTile
              key={`${entry.category}-${entry.importName ?? entry.name}`}
              entry={entry}
              iconSize={iconSize}
              showCategory={showCategory}
              copied={copied}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        共 {entries.length} 个
        {category === "all" ? ` / ${iconCatalog.length} 个精选` : ""}
      </p>
    </div>
  );
}
