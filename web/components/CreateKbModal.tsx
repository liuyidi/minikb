"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/app/providers";
import { api, apiErrorMessage } from "@/lib/api";
import { kbPath } from "@/lib/paths";
import { Button } from "@minikb/ui/components/ui/button";
import { Modal } from "@minikb/ui/components/ui/modal";
import { FormGroup } from "@minikb/ui/components/ui/page";
import { Input } from "@minikb/ui/components/ui/input";
import { Textarea } from "@minikb/ui/components/ui/textarea";

type CreateKbModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateKbModal({ open, onClose }: CreateKbModalProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError(t("err.name"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = {
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, "-"),
      description: description.trim(),
    };
    const resp = await api("/v1/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!resp.ok) {
      setError(apiErrorMessage(await resp.json()));
      return;
    }
    const created = (await resp.json()) as { id: string };
    setName("");
    setSlug("");
    setDescription("");
    onClose();
    router.push(kbPath(created.id));
  }

  return (
    <Modal
      open={open}
      title={t("modal.createKb")}
      onClose={onClose}
      closeLabel={t("btn.close")}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={submitting}>
            {t("btn.create")}
          </Button>
        </>
      }
    >
      <FormGroup label={t("field.name")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </FormGroup>
      <FormGroup label={t("field.slug")}>
        <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
      </FormGroup>
      <FormGroup label={t("field.desc")}>
        <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormGroup>
      {error ? <p className="m-0 text-[13px] text-destructive">{error}</p> : null}
    </Modal>
  );
}
