"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Card } from "@minikb/ui/components/ui/card";
import { inputClassName as inputStyle, textareaClassName as textareaStyle } from "@minikb/ui/lib/field-styles";
import { api, apiErrorMessage } from "@/lib/api";

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
    if (!window.confirm(t("confirm.reindex"))) return;
    const resp = await api(`/v1/kb/${kbId}/settings/reindex`, { method: "POST" });
    const data = (await resp.json()) as { message?: string };
    alert(data.message ?? t("msg.saved"));
  }

  async function deleteKb() {
    if (!window.confirm(t("confirm.deleteKbPerm"))) return;
    if (!window.confirm(t("confirm.deleteKbReally"))) return;
    const resp = await api(`/v1/kb/${kbId}/settings`, { method: "DELETE" });
    if (resp.ok) {
      alert(t("msg.deleted"));
      router.push("/kbs");
    } else {
      alert(apiErrorMessage(await resp.json()));
    }
  }

  if (!kb) {
    return (
      <PageShell>
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t("set.title")} />

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>{t("set.general")}</h2>
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>{t("field.name")}</label>
        <input className={inputStyle} style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} />
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>{t("field.desc")}</label>
        <textarea
          className={textareaStyle}
          style={{ marginBottom: 12 }}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Kind</label>
            <select className={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="general">General</option>
              <option value="code_sandbox">Code Sandbox</option>
              <option value="wiki">Wiki</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Visibility</label>
            <select className={inputStyle} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private</option>
              <option value="org">Organization</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {t("set.save")}
        </Button>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>{t("set.chunking")}</h2>
        <select className={inputStyle} value={chunker} onChange={(e) => setChunker(e.target.value)}>
          <option value="recursive">Recursive</option>
          <option value="heading">By Heading</option>
          <option value="semantic">Semantic</option>
          <option value="code_aware">Code Aware</option>
          <option value="sliding_window">Sliding Window</option>
        </select>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--mini-color-muted)" }}>
          {t("set.current")} {kb.meta?.chunker_strategy ?? "recursive (default)"}
        </p>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>{t("set.stats")}</h2>
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>{kb.stats?.documents ?? 0}</strong> {t("set.documents")} ·{" "}
          <strong>{kb.stats?.chunks ?? 0}</strong> {t("set.chunks")}
        </p>
      </Card>

      <Card style={{ borderColor: "var(--mini-color-danger)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px", color: "var(--mini-color-danger)" }}>
          {t("set.danger")}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" type="button" onClick={() => void reindex()}>
            {t("set.reindex")}
          </Button>
          <Button variant="danger" type="button" onClick={() => void deleteKb()}>
            {t("set.deleteKb")}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
