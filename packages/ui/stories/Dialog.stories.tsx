import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@minikb/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@minikb/ui/components/ui/dialog";

const meta = {
  title: "Components/浮层/Dialog 对话框",
  component: Dialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button type="button" onClick={() => setOpen(true)}>
          打开对话框
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建知识库</DialogTitle>
              <DialogDescription className="pt-1">确认名称与 slug。</DialogDescription>
            </DialogHeader>
            <div className="px-6 py-4 text-sm text-muted-foreground">
              正文区域在页眉与页脚之间，无分隔横线。
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};
