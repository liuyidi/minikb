import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "@minikb/ui/components/ui/skeleton";

const meta = {
  title: "Components/反馈/Skeleton 骨架屏",
  component: Skeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  ),
};

export const Card: Story = {
  render: () => (
    <div className="w-96 space-y-3 rounded-[var(--radius-lg)] border border-border p-5">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-24" />
    </div>
  ),
};
