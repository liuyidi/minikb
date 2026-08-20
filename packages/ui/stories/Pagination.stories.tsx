import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Pagination } from "@minikb/ui/components/ui/pagination";

const meta = {
  title: "Components/数据展示/Pagination 分页",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [page, setPage] = useState(2);
    return (
      <Pagination page={page} pageCount={8} onPageChange={setPage} className="w-[420px]" />
    );
  },
};
