import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@minikb/ui/components/ui/button";
import { Input } from "@minikb/ui/components/ui/input";
import { Modal } from "@minikb/ui/components/ui/modal";
import { FormGroup } from "@minikb/ui/components/ui/page";

const meta = {
  title: "Components/浮层/Modal 模态框",
  component: Modal,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateKnowledgeBase: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button type="button" onClick={() => setOpen(true)}>
          新建知识库
        </Button>
        <Modal
          open={open}
          title="新建知识库"
          closeLabel="关闭"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                创建
              </Button>
            </>
          }
        >
          <FormGroup label="名称">
            <Input placeholder="产品文档" />
          </FormGroup>
        </Modal>
      </>
    );
  },
};
