import type { ChartConfig } from "@minikb/ui/components/ui/chart";

/** Daily query trend for chart demos (minikb admin context). */
export const queryTrendData = [
  { date: "01-13", queries: 120, hits: 98 },
  { date: "01-14", queries: 186, hits: 152 },
  { date: "01-15", queries: 142, hits: 118 },
  { date: "01-16", queries: 210, hits: 176 },
  { date: "01-17", queries: 168, hits: 141 },
  { date: "01-18", queries: 195, hits: 162 },
  { date: "01-19", queries: 224, hits: 188 },
];

export const documentTypeData = [
  { type: "pdf", count: 420 },
  { type: "markdown", count: 280 },
  { type: "html", count: 160 },
  { type: "other", count: 90 },
];

export const trendChartConfig = {
  queries: { label: "查询量", color: "var(--chart-1)" },
  hits: { label: "命中", color: "var(--chart-2)" },
} satisfies ChartConfig;

export const documentChartConfig = {
  count: { label: "文档数" },
  pdf: { label: "PDF", color: "var(--chart-1)" },
  markdown: { label: "Markdown", color: "var(--chart-2)" },
  html: { label: "HTML", color: "var(--chart-3)" },
  other: { label: "其他", color: "var(--chart-4)" },
} satisfies ChartConfig;

export const chartShellClassName = "mx-auto aspect-[16/9] w-full max-w-3xl";
