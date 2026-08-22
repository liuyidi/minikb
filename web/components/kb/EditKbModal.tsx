"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/app/providers";
import { api, apiErrorMessage } from "@/lib/api";
import type { KbSummary } from "@/lib/kb";
import { Button } from "@minikb/ui/components/ui/button";
import { Modal } from "@minikb/ui/components/ui/modal";
import { FormGroup } from "@minikb/ui/components/ui/page";
import { Input } from "@minikb/ui/components/ui/input";
import { Textarea } from "@minikb/ui/components/ui/textarea";

type Props = {
  kb: KbSummary | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditKbModal({ kb, open, onClose, onSaved }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!kb) return;
    setName(kb.name);
    setDescription(kb.description ?? "");
    setError(null);
  }, [kb, open]);

  async function handleSave() {
    if (!kb || !name.trim()) {
      setError(t("err.name"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const resp = await api(`/v1/kb/${kb.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
      }),
    });
    setSubmitting(false);
    if (!resp.ok) {
      setError(apiErrorMessage(await resp.json()));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t("kb.edit")}
      onClose={onClose}
      closeLabel={t("btn.close")}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={submitting}>
            {t("set.save")}
          </Button>
        </>
      }
    >
      <FormGroup label={t("field.name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormGroup>
      <FormGroup label={t("field.desc")}>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormGroup>
      {error ? <p className="m-0 text-[13px] text-destructive">{error}</p> : null}
    </Modal>
  );
}
