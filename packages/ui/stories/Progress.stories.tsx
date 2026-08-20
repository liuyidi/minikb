import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "@minikb/ui/components/ui/progress";

const meta = {
  title: "Components/反馈/Progress 进度条",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 45 },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Progress {...args} className="w-80" />,
};

export const Complete: Story = {
  args: { value: 100 },
  render: (args) => <Progress {...args} className="w-80" />,
};
