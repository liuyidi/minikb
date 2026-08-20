import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@minikb/ui/lib/utils";
import { Button } from "@minikb/ui/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  labels?: {
    previous?: string;
    next?: string;
    page?: (page: number, pageCount: number) => string;
  };
};

function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  labels,
}: PaginationProps) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  const previousLabel = labels?.previous ?? "上一页";
  const nextLabel = labels?.next ?? "下一页";
  const pageLabel =
    labels?.page?.(safePage, safePageCount) ?? `第 ${safePage} / ${safePageCount} 页`;

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeftIcon />
        {previousLabel}
      </Button>
      <span className="text-sm text-muted-foreground">{pageLabel}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage >= safePageCount}
        onClick={() => onPageChange(safePage + 1)}
      >
        {nextLabel}
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}

export { Pagination };
