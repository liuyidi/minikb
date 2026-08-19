"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@minikb/ui/components/ui/button";
import { PageHeader, PageShell } from "@minikb/ui/components/ui/page";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Card } from "@minikb/ui/components/ui/card";
import { EmptyState } from "@minikb/ui/components/ui/empty";
import { inputClassName as inputStyle } from "@minikb/ui/lib/field-styles";
import { api, apiErrorMessage } from "@/lib/api";
import type { Locale } from "@/lib/locale";

type ApiKeyItem = {
  id: string;
  prefix: string;
  name: string;
  created_at?: string;
  last_used_at?: string | null;
  disabled?: boolean;
};

export default function SystemSettingsPage() {
  const { t, locale, setLocale } = useLocale();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [keyName, setKeyName] = useState("");
  const [rawSecret, setRawSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadKeys = useCallback(async () => {
    const resp = await api("/v1/api-keys");
    if (!resp.ok) return;
    const data = (await resp.json()) as { items: ApiKeyItem[] };
    setKeys(data.items ?? []);
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey() {
    if (!keyName.trim()) {
      alert(t("err.name"));
      return;
    }
    setCreating(true);
    try {
      const resp = await api("/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      if (!resp.ok) {
        alert(apiErrorMessage(await resp.json()));
        return;
      }
      const created = (await resp.json()) as ApiKeyItem & { raw_secret?: string };
      setRawSecret(created.raw_secret ?? null);
      setKeyName("");
      await loadKeys();
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title={t("sys.title")} />

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>{t("sys.account")}</h2>
        <label htmlFor="sys-locale" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          {t("lang.label")}
        </label>
        <select
          id="sys-locale"
          className={inputStyle}
          style={{ width: 220 }}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>{t("sys.apiKeys")}</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--mini-color-muted)" }}>{t("sys.apiKeyHint")}</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            className={inputStyle}
            style={{ flex: 1 }}
            placeholder={t("sys.keyName")}
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />
          <Button type="button" disabled={creating} onClick={() => void createKey()}>
            {t("sys.createKey")}
          </Button>
        </div>
        {rawSecret ? (
          <p
            style={{
              margin: "0 0 16px",
              padding: 12,
              background: "var(--mini-color-surface)",
              borderRadius: "var(--mini-radius-control)",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {t("sys.rawSecret")} {rawSecret}
          </p>
        ) : null}
        {keys.length === 0 ? (
          <EmptyState message={t("sys.emptyKeys")} />
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid var(--mini-color-border-soft)",
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{key.name}</div>
                <div style={{ fontSize: 12, color: "var(--mini-color-muted)", marginTop: 4 }}>
                  {key.prefix}…
                </div>
              </div>
              {key.disabled ? <Badge variant="danger">disabled</Badge> : <Badge variant="info">active</Badge>}
            </div>
          ))
        )}
      </Card>
    </PageShell>
  );
}
