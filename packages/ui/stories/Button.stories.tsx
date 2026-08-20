import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@minikb/ui/components/ui/button";

const meta = {
  title: "Components/表单/Button 按钮",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "继续",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "secondary", "outline", "ghost", "danger", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "取消" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "删除" },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
