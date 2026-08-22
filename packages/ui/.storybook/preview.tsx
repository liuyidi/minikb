import type { Preview } from "@storybook/react-vite";
import { Toaster } from "@minikb/ui/components/ui/sonner";
import { TooltipProvider } from "@minikb/ui/components/ui/tooltip";
import "react-day-picker/style.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    options: {
      storySort: {
        order: [
          "Introduction",
          "主题",
          ["Gallery 颜色概览", "Brand 品牌色", "Semantic 语义色", "Status 状态色", "Chart 图表色", "Typography 字体", "Dimensions 尺寸", "Mapping 映射关系", "Usage 用法示例", "*"],
          "图标",
          "图表",
          "Chat",
          ["Attachments 附件列表", "ChatBubble 消息气泡", "ChatSender 对话输入", "*"],
          "Components",
          ["表单", "反馈", "布局", "数据展示", "浮层", "*"],
          "*",
        ],
      },
    },
    docs: {
      toc: true,
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
        <Toaster />
      </TooltipProvider>
    ),
  ],
};

export default preview;
