import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@minikb/ui/components/ui/badge";

const meta = {
  title: "Components/反馈/Badge 徽章",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Status",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "success", "warning", "danger", "info"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { variant: "info", children: "info" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">default</Badge>
      <Badge variant="secondary">secondary</Badge>
      <Badge variant="outline">outline</Badge>
      <Badge variant="success">success</Badge>
      <Badge variant="warning">warning</Badge>
      <Badge variant="danger">danger</Badge>
      <Badge variant="info">info</Badge>
    </div>
  ),
};
