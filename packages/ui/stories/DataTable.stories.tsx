import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import { DataTable } from "@minikb/ui/components/ui/data-table";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Button } from "@minikb/ui/components/ui/button";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@minikb/ui/components/ui/dropdown-menu";

type Row = { id: string; name: string; status: string; docs: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "名称" },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "ready" ? "success" : status === "syncing" ? "warning" : "danger";
      const label = status === "ready" ? "就绪" : status === "syncing" ? "同步中" : "失败";
      return <Badge variant={variant}>{label}</Badge>;
    },
  },
  { accessorKey: "docs", header: "文档数" },
  {
    id: "actions",
    header: "",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="操作" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>打开</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">删除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i + 1),
  name: `知识库 ${i + 1}`,
  status: i % 3 === 0 ? "ready" : i % 3 === 1 ? "syncing" : "failed",
  docs: (i + 1) * 3,
}));

const meta = {
  title: "Components/数据展示/DataTable 数据表格",
  component: DataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Virtualized: Story = {
  render: () => <DataTable columns={columns} data={data} className="w-[620px]" />,
};

export const Empty: Story = {
  render: () => (
    <div className="w-[520px] space-y-4">
      <DataTable columns={columns.slice(0, 3)} data={[]} className="min-h-[120px]" />
      <EmptyState title="暂无知识库" description="创建第一个知识库以开始索引文档。" />
    </div>
  ),
};
