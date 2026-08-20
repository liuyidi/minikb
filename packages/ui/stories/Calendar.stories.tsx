import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "@minikb/ui/components/ui/calendar";

const meta = {
  title: "Components/表单/Calendar 日历",
  component: Calendar,
  tags: ["autodocs"],
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Calendar mode="single" className="rounded-[var(--radius-lg)] border border-border" />,
};
