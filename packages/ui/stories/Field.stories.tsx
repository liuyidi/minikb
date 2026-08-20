import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@minikb/ui/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@minikb/ui/components/ui/field";

const meta = {
  title: "Components/表单/Field 表单字段",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const SettingsForm: Story = {
  render: () => (
    <FieldSet className="w-[420px]">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="kb-name">知识库名称</FieldLabel>
          <Input id="kb-name" defaultValue="产品文档" />
          <FieldDescription>在列表与 API 中显示的名称。</FieldDescription>
        </Field>
        <Field data-invalid="true">
          <FieldLabel htmlFor="kb-slug">Slug</FieldLabel>
          <Input id="kb-slug" defaultValue="产品 文档" aria-invalid />
          <FieldError>仅允许小写字母、数字与连字符。</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
