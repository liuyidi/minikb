import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "@minikb/ui/components/ui/spinner";

const meta = {
  title: "Components/反馈/Spinner 加载",
  component: Spinner,
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      加载中…
    </div>
  ),
};
