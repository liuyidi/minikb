"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/app/providers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@minikb/ui/components/ui/alert-dialog";
import { Button } from "@minikb/ui/components/ui/button";
import { Card } from "@minikb/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@minikb/ui/components/ui/field";
import { Input } from "@minikb/ui/components/ui/input";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";
import { Textarea } from "@minikb/ui/components/ui/textarea";
import { api, apiErrorMessage } from "@/lib/api";

const KIND_ITEMS = [
  { value: "general", label: "General" },
  { value: "code_sandbox", label: "Code Sandbox" },
  { value: "wiki", label: "Wiki" },
] as const;

const VISIBILITY_ITEMS = [
  { value: "private", label: "Private" },
  { value: "org", label: "Organization" },
  { value: "public", label: "Public" },
] as const;

const CHUNKER_ITEMS = [
  { value: "recursive", label: "Recursive" },
  { value: "heading", label: "By Heading" },
  { value: "semantic", label: "Semantic" },
  { value: "code_aware", label: "Code Aware" },
  { value: "sliding_window", label: "Sliding Window" },
] as const;

type KbSettings = {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  visibility?: string;
  meta?: { chunker_strategy?: string };
  stats?: { documents?: number; chunks?: number };
};

export default function KbSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const [kb, setKb] = useState<KbSettings | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("general");
  const [visibility, setVisibility] = useState("private");
  const [chunker, setChunker] = useState("recursive");
  const [saving, setSaving] = useState(false);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    const resp = await api(`/v1/kb/${kbId}/settings`);
    if (!resp.ok) return;
    const data = (await resp.json()) as KbSettings;
    setKb(data);
    setName(data.name ?? "");
    setDescription(data.description ?? "");
    setKind(data.kind ?? "general");
    setVisibility(data.visibility ?? "private");
    setChunker(data.meta?.chunker_strategy ?? "recursive");
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const resp = await api(`/v1/kb/${kbId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          kind,
          visibility,
          chunker_strategy: chunker,
        }),
      });
      if (resp.ok) {
        alert(t("msg.saved"));
        await load();
      } else {
        alert(apiErrorMessage(await resp.json()));
      }
    } finally {
      setSaving(false);
    }
  }

  async function reindex() {
    const resp = await api(`/v1/kb/${kbId}/settings/reindex`, { method: "POST" });
    const data = (await resp.json()) as { message?: string };
    alert(data.message ?? t("msg.saved"));
    setReindexOpen(false);
  }

  async function deleteKb() {
    const resp = await api(`/v1/kb/${kbId}/settings`, { method: "DELETE" });
    if (resp.ok) {
      alert(t("msg.deleted"));
      router.push("/kbs");
    } else {
      alert(apiErrorMessage(await resp.json()));
    }
    setDeleteOpen(false);
  }

  if (!kb) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t("set.title")} />

      <Card className="mb-4 p-6">
        <h2 className="mb-4 text-base font-semibold">{t("set.general")}</h2>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="kb-name">{t("field.name")}</FieldLabel>
              <Input id="kb-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="kb-desc">{t("field.desc")}</FieldLabel>
              <Textarea
                id="kb-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="kb-kind">Kind</FieldLabel>
                <Select
                  items={[...KIND_ITEMS]}
                  value={kind}
                  onValueChange={(value) => setKind(String(value))}
                >
                  <SelectTrigger id="kb-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="kb-visibility">Visibility</FieldLabel>
                <Select
                  items={[...VISIBILITY_ITEMS]}
                  value={visibility}
                  onValueChange={(value) => setVisibility(String(value))}
                >
                  <SelectTrigger id="kb-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </FieldSet>
        <Button type="button" className="mt-4" disabled={saving} onClick={() => void save()}>
          {t("set.save")}
        </Button>
      </Card>

      <Card className="mb-4 p-6">
        <h2 className="mb-4 text-base font-semibold">{t("set.chunking")}</h2>
        <Field>
          <FieldLabel htmlFor="kb-chunker">Strategy</FieldLabel>
          <Select
            items={[...CHUNKER_ITEMS]}
            value={chunker}
            onValueChange={(value) => setChunker(String(value))}
          >
            <SelectTrigger id="kb-chunker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHUNKER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {t("set.current")} {kb.meta?.chunker_strategy ?? "recursive (default)"}
          </FieldDescription>
        </Field>
      </Card>

      <Card className="mb-4 p-6">
        <h2 className="mb-3 text-base font-semibold">{t("set.stats")}</h2>
        <p className="m-0 text-sm">
          <strong>{kb.stats?.documents ?? 0}</strong> {t("set.documents")} ·{" "}
          <strong>{kb.stats?.chunks ?? 0}</strong> {t("set.chunks")}
        </p>
      </Card>

      <Card className="border-destructive/40 p-6">
        <h2 className="mb-3 text-base font-semibold text-destructive">{t("set.danger")}</h2>
        <div className="flex flex-wrap gap-2">
          <AlertDialog open={reindexOpen} onOpenChange={setReindexOpen}>
            <AlertDialogTrigger render={<Button variant="secondary" type="button" />}>
              {t("set.reindex")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("set.reindex")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirm.reindex")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void reindex()}>{t("set.reindex")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger render={<Button variant="danger" type="button" />}>
              {t("set.deleteKb")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("set.deleteKb")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirm.deleteKbPerm")} {t("confirm.deleteKbReally")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="danger" onClick={() => void deleteKb()}>
                  {t("set.deleteKb")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </PageShell>
  );
}
