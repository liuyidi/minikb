import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColorTokenGallery } from "./ColorTokenGallery";
import { colorTokenCatalog, type ColorTokenCategory } from "./catalog";
import {
  dimensionTokenCatalog,
  typographyTokenCatalog,
} from "./dimensions-catalog";

const meta = {
  title: "主题",
  component: ColorTokenGallery,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ColorTokenGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  name: "Gallery 颜色概览",
  args: { category: "all", showCategory: true },
};

const categoryStories: Record<ColorTokenCategory, string> = {
  brand: "Brand 品牌色",
  semantic: "Semantic 语义色",
  status: "Status 状态色",
  chart: "Chart 图表色",
};

function categoryStory(category: ColorTokenCategory): Story {
  return {
    name: categoryStories[category],
    args: { category, showCategory: false },
  };
}

export const Brand = categoryStory("brand");
export const Semantic = categoryStory("semantic");
export const Status = categoryStory("status");
export const Chart = categoryStory("chart");

export const Mapping: Story = {
  name: "Mapping 映射关系",
  render: () => {
    const semantic = colorTokenCatalog.filter(
      (entry) => entry.category !== "brand" && entry.mapsFrom,
    );

    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          语义色与状态色均引用 <code className="rounded bg-muted px-1 text-xs">--mini-*</code>{" "}
          品牌 token，修改品牌源即可全局联动。
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 font-medium">语义 token</th>
                <th className="px-4 py-2 font-medium">中文</th>
                <th className="px-4 py-2 font-medium">品牌源</th>
              </tr>
            </thead>
            <tbody>
              {semantic.map((entry) => (
                <tr key={entry.var} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{entry.var}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.label}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {entry.mapsFrom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};

export const Usage: Story = {
  name: "Usage 用法示例",
  render: () => (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">CSS</h3>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
          {`.panel {
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
}

.alert-success {
  color: var(--success);
  background: var(--success-foreground);
}`}
        </pre>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Tailwind（bridge @theme）</h3>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
          {`<div className="bg-background text-foreground border-border">
  <p className="text-muted-foreground">次要说明</p>
  <button className="bg-primary text-primary-foreground">主按钮</button>
</div>`}
        </pre>
      </section>
      <section className="flex flex-wrap gap-3">
        <span className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          primary
        </span>
        <span className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
          secondary
        </span>
        <span className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground">
          destructive
        </span>
        <span
          className="rounded-md px-3 py-1.5 text-sm"
          style={{ color: "var(--success)", background: "var(--success-foreground)" }}
        >
          success
        </span>
        <span
          className="rounded-md px-3 py-1.5 text-sm"
          style={{ color: "var(--warning)", background: "var(--warning-foreground)" }}
        >
          warning
        </span>
        <span
          className="rounded-md px-3 py-1.5 text-sm"
          style={{ color: "var(--info)", background: "var(--info-foreground)" }}
        >
          info
        </span>
      </section>
    </div>
  ),
};

export const Typography: Story = {
  name: "Typography 字体",
  render: () => (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      {typographyTokenCatalog.map((entry) => (
        <div key={entry.name} className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{entry.label}</p>
          <p
            className={entry.previewClass}
            style={entry.var.startsWith("--") ? { fontFamily: `var(${entry.var})` } : undefined}
          >
            {entry.previewText}
          </p>
        </div>
      ))}
    </div>
  ),
};

export const Dimensions: Story = {
  name: "Dimensions 尺寸",
  render: () => (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-6 sm:grid-cols-2">
      {dimensionTokenCatalog.map((entry) => (
        <div key={entry.var} className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium">{entry.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{entry.var}</p>
          {entry.sample === "radius" ? (
            <div
              className="mt-3 h-16 w-full border border-border bg-muted"
              style={{ borderRadius: `var(${entry.var})` }}
            />
          ) : null}
          {entry.sample === "height" ? (
            <div
              className="mt-3 w-full rounded-md bg-primary"
              style={{ height: `var(${entry.var})` }}
            />
          ) : null}
          {entry.sample === "width" ? (
            <div
              className="mt-3 h-8 rounded-md bg-primary"
              style={{ width: `var(${entry.var})` }}
            />
          ) : null}
        </div>
      ))}
    </div>
  ),
};
