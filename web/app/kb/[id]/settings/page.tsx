"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@minikb/ui/components/ui/tabs";
import { Textarea } from "@minikb/ui/components/ui/textarea";
import { ModelStatusPanel } from "@/components/settings/ModelStatusPanel";
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

const SETTINGS_TABS = ["general", "qa", "indexing", "models", "danger"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(value: string | null): SettingsTab {
  if (value && SETTINGS_TABS.includes(value as SettingsTab)) {
    return value as SettingsTab;
  }
  return "general";
}

type KbSettings = {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  visibility?: string;
  meta?: { chunker_strategy?: string; opening_statement?: string; embedding_model?: string };
  stats?: { documents?: number; chunks?: number };
};

export default function KbSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseSettingsTab(searchParams.get("tab"));
  const [kb, setKb] = useState<KbSettings | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("general");
  const [visibility, setVisibility] = useState("private");
  const [chunker, setChunker] = useState("recursive");
  const [openingStatement, setOpeningStatement] = useState("");
  const [saving, setSaving] = useState(false);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setActiveTab = useCallback(
    (tab: string) => {
      const next = parseSettingsTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

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
    setOpeningStatement(data.meta?.opening_statement ?? "");
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
          opening_statement: openingStatement,
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="general">{t("set.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="qa">{t("set.tabQa")}</TabsTrigger>
          <TabsTrigger value="indexing">{t("set.tabIndexing")}</TabsTrigger>
          <TabsTrigger value="models">{t("set.tabModels")}</TabsTrigger>
          <TabsTrigger value="danger">{t("set.tabDanger")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6">
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

            <div className="mt-6 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{t("set.stats")}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <strong>{kb.stats?.documents ?? 0}</strong> {t("set.documents")}
              <span className="mx-2 text-muted-foreground">·</span>
              <strong>{kb.stats?.chunks ?? 0}</strong> {t("set.chunks")}
            </div>

            <Button type="button" className="mt-4" disabled={saving} onClick={() => void save()}>
              {t("set.save")}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="qa">
          <Card className="p-6">
            <Field>
              <FieldLabel htmlFor="kb-opening">{t("set.openingStatement")}</FieldLabel>
              <Textarea
                id="kb-opening"
                rows={4}
                value={openingStatement}
                onChange={(e) => setOpeningStatement(e.target.value)}
                placeholder={t("set.openingStatementPlaceholder")}
              />
              <FieldDescription>{t("set.openingStatementHint")}</FieldDescription>
            </Field>
            <Button type="button" className="mt-4" disabled={saving} onClick={() => void save()}>
              {t("set.save")}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="indexing">
          <Card className="p-6">
            <Field>
              <FieldLabel htmlFor="kb-chunker">{t("set.chunking")}</FieldLabel>
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

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t("set.reindex")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("confirm.reindex")}</p>
              </div>
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
            </div>

            <Button type="button" className="mt-4" disabled={saving} onClick={() => void save()}>
              {t("set.save")}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <ModelStatusPanel kbEmbeddingModel={kb.meta?.embedding_model} />
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive/40 p-6">
            <h2 className="mb-2 text-base font-semibold text-destructive">{t("set.deleteKb")}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("confirm.deleteKbPerm")} {t("confirm.deleteKbReally")}
            </p>
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
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
