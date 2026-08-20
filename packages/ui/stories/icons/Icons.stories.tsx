import type { Meta, StoryObj } from "@storybook/react-vite";
import { Search } from "lucide-react";
import { IconGallery } from "./IconGallery";
import type { IconCategory } from "./catalog";

const meta = {
  title: "图标",
  component: IconGallery,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  name: "Gallery 图标库",
  args: { category: "all", showCategory: true },
};

const categoryStories: Record<IconCategory, string> = {
  common: "Common 常用",
  navigation: "Navigation 导航",
  actions: "Actions 操作",
  status: "Status 状态",
  file: "File 文件",
  inKit: "In Kit 组件内置",
};

function categoryStory(category: IconCategory): Story {
  return {
    name: categoryStories[category],
    args: { category, showCategory: false },
  };
}

export const Common = categoryStory("common");
export const Navigation = categoryStory("navigation");
export const Actions = categoryStory("actions");
export const Status = categoryStory("status");
export const File = categoryStory("file");
export const InKit = categoryStory("inKit");

export const Sizes: Story = {
  name: "Sizes 尺寸",
  render: () => (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-end gap-8 p-8">
      {[16, 20, 24, 32].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Search className="text-foreground" style={{ width: size, height: size }} aria-hidden />
          <span className="text-xs text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  name: "Colors 颜色",
  render: () => (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-8 p-8">
      {(
        [
          ["text-foreground", "默认"],
          ["text-muted-foreground", "次要"],
          ["text-primary", "主色"],
          ["text-destructive", "危险"],
          ["text-[var(--success)]", "成功"],
          ["text-[var(--warning)]", "警告"],
        ] as const
      ).map(([className, label]) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <Search className={className} size={24} aria-hidden />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  ),
};
