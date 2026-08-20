import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@minikb/ui/components/ui/table";
import { Badge } from "@minikb/ui/components/ui/badge";

const meta = {
  title: "Components/数据展示/Table 表格",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KnowledgeBases: Story = {
  render: () => (
    <Table className="w-[520px]">
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="text-right">文档数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>产品文档</TableCell>
          <TableCell>
            <Badge variant="success">就绪</Badge>
          </TableCell>
          <TableCell className="text-right">128</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>内部 Wiki</TableCell>
          <TableCell>
            <Badge variant="warning">同步中</Badge>
          </TableCell>
          <TableCell className="text-right">42</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>客服 FAQ</TableCell>
          <TableCell>
            <Badge variant="danger">失败</Badge>
          </TableCell>
          <TableCell className="text-right">0</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
