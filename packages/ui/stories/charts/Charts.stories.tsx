import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@minikb/ui/components/ui/chart";
import {
  chartShellClassName,
  documentChartConfig,
  documentTypeData,
  queryTrendData,
  trendChartConfig,
} from "./sample-data";

const meta = {
  title: "图表",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

export const AreaChartStory: Story = {
  name: "Area 面积图",
  render: () => (
    <div className="p-6">
      <p className="mx-auto mb-4 max-w-3xl text-sm text-muted-foreground">
        参考{" "}
        <a
          href="https://ui.shadcn.com/charts/area"
          className="text-primary underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          shadcn/ui Charts
        </a>
        ，基于 Recharts + <code className="text-xs">ChartContainer</code>。
      </p>
      <ChartContainer config={trendChartConfig} className={chartShellClassName}>
        <AreaChart data={queryTrendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis {...axisProps} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="queries"
            type="natural"
            fill="var(--color-queries)"
            fillOpacity={0.35}
            stroke="var(--color-queries)"
            stackId="a"
          />
          <Area
            dataKey="hits"
            type="natural"
            fill="var(--color-hits)"
            fillOpacity={0.35}
            stroke="var(--color-hits)"
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  ),
};

export const LineChartStory: Story = {
  name: "Line 折线图",
  render: () => (
    <div className="p-6">
      <ChartContainer config={trendChartConfig} className={chartShellClassName}>
        <LineChart data={queryTrendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis {...axisProps} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="queries"
            type="monotone"
            stroke="var(--color-queries)"
            strokeWidth={2}
            dot={{ fill: "var(--color-queries)", r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            dataKey="hits"
            type="monotone"
            stroke="var(--color-hits)"
            strokeWidth={2}
            dot={{ fill: "var(--color-hits)", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  ),
};

export const BarChartStory: Story = {
  name: "Bar 柱状图",
  render: () => (
    <div className="p-6">
      <ChartContainer config={trendChartConfig} className={chartShellClassName}>
        <BarChart data={queryTrendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis {...axisProps} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="queries" fill="var(--color-queries)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="hits" fill="var(--color-hits)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  ),
};

export const PieChartStory: Story = {
  name: "Pie 饼图",
  render: () => (
    <div className="p-6">
      <ChartContainer
        config={documentChartConfig}
        className="mx-auto aspect-square w-full max-w-md"
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="type" />} />
          <Pie
            data={documentTypeData}
            dataKey="count"
            nameKey="type"
            innerRadius={56}
            strokeWidth={4}
            stroke="var(--background)"
          >
            {documentTypeData.map((entry) => (
              <Cell key={entry.type} fill={`var(--color-${entry.type})`} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="type" />} />
        </PieChart>
      </ChartContainer>
    </div>
  ),
};

export const TooltipsStory: Story = {
  name: "Tooltips 提示框",
  render: () => (
    <div className="space-y-8 p-6">
      <p className="text-sm text-muted-foreground">
        <code className="text-xs">ChartTooltipContent</code> 支持 dot / line / dashed
        指示器，以及合计 footer。
      </p>
      <div className="grid gap-8 lg:grid-cols-3">
        {(["dot", "line", "dashed"] as const).map((indicator) => (
          <div key={indicator} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              indicator="{indicator}"
            </p>
            <ChartContainer config={trendChartConfig} className="aspect-[4/3] w-full">
              <BarChart data={queryTrendData.slice(0, 4)}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator={indicator}
                      footer={(payload) => {
                        const total = payload.reduce(
                          (sum, item) =>
                            sum + (typeof item.value === "number" ? item.value : 0),
                          0,
                        );
                        return (
                          <div className="flex items-center justify-between gap-2 font-medium">
                            <span>合计</span>
                            <span className="font-mono tabular-nums">
                              {total.toLocaleString()}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="queries" fill="var(--color-queries)" radius={4} />
                <Bar dataKey="hits" fill="var(--color-hits)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        ))}
      </div>
    </div>
  ),
};
