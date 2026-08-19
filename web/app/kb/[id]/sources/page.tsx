"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/app/providers";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Badge, Card, EmptyState, FormGroup, PageHeader, PageShell, inputStyle, statusBadgeVariant, textareaStyle } from "@/components/ui";
import { api, apiErrorMessage } from "@/lib/api";

type DataSource = {
  id: string;
  name: string;
  kind: string;
  status: string;
  last_sync_at?: string;
  last_error?: string;
  stats?: { total_synced?: number };
};

export default function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  const { t, locale } = useLocale();
  const [items, setItems] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [kind, setKind] = useState("url");
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [connString, setConnString] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [feishuEntryType, setFeishuEntryType] = useState("space");
  const [feishuToken, setFeishuToken] = useState("");
  const [feishuAppId, setFeishuAppId] = useState("");
  const [feishuAppSecret, setFeishuAppSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadDataSources = useCallback(async () => {
    const resp = await api(`/v1/kb/${kbId}/data-sources`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { items: DataSource[] };
    setItems(data.items ?? []);
    setLoading(false);

    const syncing = (data.items ?? []).some((ds) => ds.status === "syncing");
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (syncing) {
      refreshTimer.current = setTimeout(() => void loadDataSources(), 3000);
    }
  }, [kbId]);

  useEffect(() => {
    void loadDataSources();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadDataSources]);

  async function createDataSource() {
    if (!name.trim()) {
      setError(t("err.name"));
      return;
    }
    let config: Record<string, unknown> = {};
    if (kind === "url") {
      config = { urls: urls.split("\n").map((u) => u.trim()).filter(Boolean) };
    } else if (kind === "git") {
      config = { repo_url: repoUrl.trim() };
      if (branch.trim()) config.branch = branch.trim();
    } else if (kind === "sql") {
      config = { connection_string: connString.trim(), query: sqlQuery.trim() };
    } else if (kind === "feishu") {
      config = {
        app_id: feishuAppId.trim(),
        app_secret: feishuAppSecret.trim(),
        entry_type: feishuEntryType,
      };
      if (feishuEntryType === "space") config.space_id = feishuToken.trim();
      else if (feishuEntryType === "wiki") config.wiki_id = feishuToken.trim();
      else if (feishuEntryType === "docx") config.doc_token = feishuToken.trim();
    }

    const resp = await api(`/v1/kb/${kbId}/data-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: name.trim(), config }),
    });
    if (!resp.ok) {
      setError(apiErrorMessage(await resp.json()));
      return;
    }
    setModalOpen(false);
    setName("");
    setError(null);
    void loadDataSources();
  }

  async function syncDataSource(dsId: string) {
    const resp = await api(`/v1/kb/${kbId}/data-sources/${dsId}/sync`, { method: "POST" });
    if (resp.ok) {
      alert(t("msg.syncStarted"));
      setTimeout(() => void loadDataSources(), 2000);
    } else {
      alert(apiErrorMessage(await resp.json()));
    }
  }

  async function probeDataSource(dsId: string) {
    try {
      const resp = await api(`/v1/kb/${kbId}/data-sources/${dsId}/probe`, { method: "POST" });
      const data = (await resp.json()) as { status: string; message: string };
      alert(`${data.status}: ${data.message}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("err.failed"));
    }
  }

  async function deleteDataSource(dsId: string) {
    if (!confirm(t("confirm.delete"))) return;
    await api(`/v1/kb/${kbId}/data-sources/${dsId}`, { method: "DELETE" });
    void loadDataSources();
  }

  const syncing = items.filter((ds) => ds.status === "syncing");
  const totalSynced = items.reduce((sum, ds) => sum + (ds.stats?.total_synced ?? 0), 0);
  const totalErrors = items.filter((ds) => ds.status === "error").length;

  return (
    <PageShell>
      <PageHeader
        title={t("src.title")}
        actions={
          <Button type="button" onClick={() => { setError(null); setModalOpen(true); }}>
            {t("src.add")}
          </Button>
        }
      />

      {syncing.length > 0 ? (
        <Card style={{ padding: "12px 16px", fontSize: 13 }}>
          Syncing: <strong>{syncing.length}</strong> source(s) · {totalSynced} records synced
          {totalErrors > 0 ? (
            <span style={{ marginLeft: 12, color: "var(--mini-color-danger)" }}>{totalErrors} error(s)</span>
          ) : null}
        </Card>
      ) : totalSynced > 0 && items.length > 0 ? (
        <Card style={{ padding: "12px 16px", fontSize: 13 }}>
          All idle · <strong>{totalSynced}</strong> total records synced across {items.length} source(s)
        </Card>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--mini-color-muted)", fontSize: 14 }}>...</p>
      ) : items.length === 0 ? (
        <EmptyState message={t("src.empty")} />
      ) : (
        items.map((ds) => (
          <Card key={ds.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{ds.name}</span>
              <Badge variant={statusBadgeVariant(ds.status)}>{ds.status}</Badge>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--mini-color-muted)" }}>
              {t("src.type")}: {ds.kind} · {t("src.lastSync")}:{" "}
              {ds.last_sync_at ? new Date(ds.last_sync_at).toLocaleString(locale) : t("src.never")} ·{" "}
              {t("src.records")}: {ds.stats?.total_synced ?? 0}
            </p>
            {ds.last_error ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--mini-color-danger)" }}>{ds.last_error}</p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" type="button" style={{ fontSize: 12, height: 36 }} onClick={() => void syncDataSource(ds.id)}>
                {t("src.sync")}
              </Button>
              <Button variant="secondary" type="button" style={{ fontSize: 12, height: 36 }} onClick={() => void probeDataSource(ds.id)}>
                {t("src.test")}
              </Button>
              <Button variant="danger" type="button" style={{ fontSize: 12, height: 36 }} onClick={() => void deleteDataSource(ds.id)}>
                {t("src.delete")}
              </Button>
            </div>
          </Card>
        ))
      )}

      <Modal
        open={modalOpen}
        title={t("modal.addSource")}
        onClose={() => setModalOpen(false)}
        closeLabel={t("btn.close")}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              {t("btn.cancel")}
            </Button>
            <Button type="button" onClick={() => void createDataSource()}>
              {t("btn.addSource")}
            </Button>
          </>
        }
      >
        <FormGroup label={t("field.name")}>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </FormGroup>
        <FormGroup label={t("field.sourceType")}>
          <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="url">URL</option>
            <option value="git">{t("src.kind.git")}</option>
            <option value="sql">{t("src.kind.sql")}</option>
            <option value="feishu">{t("src.kind.feishu")}</option>
          </select>
        </FormGroup>
        {kind === "url" ? (
          <FormGroup label={t("field.urls")}>
            <textarea style={textareaStyle} rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} />
          </FormGroup>
        ) : null}
        {kind === "git" ? (
          <>
            <FormGroup label={t("field.repo")}>
              <input style={inputStyle} value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </FormGroup>
            <FormGroup label={t("field.branch")}>
              <input style={inputStyle} value={branch} onChange={(e) => setBranch(e.target.value)} />
            </FormGroup>
          </>
        ) : null}
        {kind === "sql" ? (
          <>
            <FormGroup label={t("field.conn")}>
              <input style={inputStyle} value={connString} onChange={(e) => setConnString(e.target.value)} />
            </FormGroup>
            <FormGroup label={t("field.sql")}>
              <textarea style={textareaStyle} rows={3} value={sqlQuery} onChange={(e) => setSqlQuery(e.target.value)} />
            </FormGroup>
          </>
        ) : null}
        {kind === "feishu" ? (
          <>
            <FormGroup label={t("field.entryType")}>
              <select style={inputStyle} value={feishuEntryType} onChange={(e) => setFeishuEntryType(e.target.value)}>
                <option value="space">{t("feishu.space")}</option>
                <option value="wiki">{t("feishu.wiki")}</option>
                <option value="docx">{t("feishu.docx")}</option>
              </select>
            </FormGroup>
            <FormGroup label={t("field.feishuToken")}>
              <input style={inputStyle} value={feishuToken} onChange={(e) => setFeishuToken(e.target.value)} />
            </FormGroup>
            <FormGroup label="App ID">
              <input style={inputStyle} value={feishuAppId} onChange={(e) => setFeishuAppId(e.target.value)} />
            </FormGroup>
            <FormGroup label="App Secret">
              <input style={inputStyle} type="password" value={feishuAppSecret} onChange={(e) => setFeishuAppSecret(e.target.value)} />
            </FormGroup>
          </>
        ) : null}
        {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--mini-color-danger)" }}>{error}</p> : null}
      </Modal>
    </PageShell>
  );
}
