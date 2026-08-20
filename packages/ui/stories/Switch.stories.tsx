import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "@minikb/ui/components/ui/switch";

const meta = {
  title: "Components/表单/Switch 开关",
  component: Switch,
  tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <label className="flex items-center gap-3 text-sm">
      <Switch defaultChecked />
      公开知识库
    </label>
  ),
};

export const Off: Story = {
  render: () => (
    <label className="flex items-center gap-3 text-sm">
      <Switch />
      仅团队成员可见
    </label>
  ),
};
