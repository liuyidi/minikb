"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  History,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ChatBubble } from "@minikb/chat/components/chat-bubble";
import { ChatSender } from "@minikb/chat/components/chat-sender";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@minikb/ui/components/ui/alert-dialog";
import { Badge } from "@minikb/ui/components/ui/badge";
import { Button } from "@minikb/ui/components/ui/button";
import { Label } from "@minikb/ui/components/ui/label";
import { Separator } from "@minikb/ui/components/ui/separator";
import { Switch } from "@minikb/ui/components/ui/switch";
import { toast } from "@minikb/ui/components/ui/sonner";
import { useLocale } from "@/app/providers";
import { api, apiErrorFromResponse, readResponseJson } from "@/lib/api";
import { useRerankProviders } from "@/lib/use-rerank-providers";
import { kbPath } from "@/lib/paths";
import { RetrievalSettingsPanel } from "@/components/retrieval/RetrievalSettingsPanel";
import {
  buildRetrievalBody,
  applyDifyStarterPreset,
  defaultRetrievalPreset,
  loadRetrievalPreset,
  resolveOpeningStatement,
  saveRetrievalPreset,
  type RetrievalPreset,
} from "@/lib/qa-config";
import { streamQaAnswer, type QaCitation } from "@/lib/qa-stream";

const MAX_QUERY_CHARS = 8000;

type QaMeta = {
  model?: string;
  retrieval_hits?: number;
  elapsed_ms?: number;
  faithfulness_score?: number;
  citations?: QaCitation[];
};

type QaMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; meta?: QaMeta; pending?: boolean; userQuery?: string };

type QaLogItem = {
  id: string;
  query: string;
  answer?: string | null;
  citations?: QaCitation[];
  model?: string | null;
  elapsed_ms?: number | null;
  created_at?: string;
};

function faithVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";
  return "danger";
}

function AssistantExtras({
  meta,
  kbId,
  userQuery,
  showCitations,
  t,
}: {
  meta?: QaMeta;
  kbId: string;
  userQuery?: string;
  showCitations: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [thinkingOpen, setThinkingOpen] = useState(true);
  if (!meta) return null;

  const faithScore = meta.faithfulness_score ?? 0;
  const citations = meta.citations ?? [];

  return (
    <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
      {meta.elapsed_ms != null ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[var(--radius)] bg-[#f3f0ff] px-3 py-2 text-left text-sm text-[#5b4bb7]"
          onClick={() => setThinkingOpen((open) => !open)}
        >
          {thinkingOpen ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <Sparkles className="size-4 shrink-0" />
          <span>
            {t("qa.thinkingDone")}（{t("qa.elapsed", { s: (meta.elapsed_ms / 1000).toFixed(2) })})
          </span>
        </button>
      ) : null}

      {showCitations && citations.length > 0 ? (
        <div className="rounded-[var(--radius)] border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="mb-2 text-sm font-medium text-foreground">
            {t("qa.referenceDocs", { n: citations.length })}
          </div>
          <ul className="space-y-2">
            {citations.map((citation) => (
              <li
                key={citation.index}
                className="flex items-start gap-2 rounded-[var(--radius)] border border-border/50 bg-background px-2.5 py-2 text-sm"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {citation.doc_title ?? t("qa.untitled")}
                  </div>
                  {citation.text_snippet ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {citation.text_snippet}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {citation.chunk_id ? (
                      <Link
                        href={`${kbPath(kbId, "chunks")}?chunk=${citation.chunk_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {t("qa.openChunk")}
                      </Link>
                    ) : null}
                    {userQuery ? (
                      <Link
                        href={`${kbPath(kbId, "retrieval")}?query=${encodeURIComponent(userQuery)}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {t("qa.openRetrieval")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t("qa.metaModel", { model: meta.model ?? "?" })}</span>
        <span>·</span>
        <span>{t("qa.metaHits", { n: meta.retrieval_hits ?? 0 })}</span>
        <span>·</span>
        <span>{t("qa.metaTime", { ms: meta.elapsed_ms?.toFixed(0) ?? "?" })}</span>
        <Badge variant={faithVariant(faithScore)} className="text-[11px]">
          {t("qa.faithfulness", { pct: (faithScore * 100).toFixed(0) })}
        </Badge>
      </div>
    </div>
  );
}

export function QaPlayground({ kbId }: { kbId: string }) {
  const { t, locale } = useLocale();
  const { items: rerankProviders } = useRerankProviders();
  const [preset, setPreset] = useState<RetrievalPreset>(defaultRetrievalPreset);
  const [docCount, setDocCount] = useState(0);
  const [kbName, setKbName] = useState("");
  const [openingStatement, setOpeningStatement] = useState("");
  const [showCitations, setShowCitations] = useState(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [logs, setLogs] = useState<QaLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearLogsOpen, setClearLogsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPreset(loadRetrievalPreset(kbId));
  }, [kbId]);

  const updatePreset = useCallback(
    (patch: Partial<RetrievalPreset> | ((prev: RetrievalPreset) => RetrievalPreset)) => {
      setPreset((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        saveRetrievalPreset(next, kbId);
        return next;
      });
    },
    [kbId],
  );

  const loadKb = useCallback(async () => {
    try {
      const [kbResp, settingsResp] = await Promise.all([
        api(`/v1/kb/${kbId}`),
        api(`/v1/kb/${kbId}/settings`),
      ]);
      if (kbResp.ok) {
        const data = await readResponseJson<{ name?: string; stats?: { documents?: number } }>(kbResp);
        setKbName(data.name ?? "");
        setDocCount(data.stats?.documents ?? 0);
      }
      if (settingsResp.ok) {
        const settings = await readResponseJson<{
          meta?: {
            opening_statement?: string;
            show_citations?: boolean;
            suggested_questions?: string[];
          };
        }>(settingsResp);
        setOpeningStatement(
          resolveOpeningStatement(settings.meta?.opening_statement, locale),
        );
        setShowCitations(settings.meta?.show_citations !== false);
        setSuggestedQuestions(
          Array.isArray(settings.meta?.suggested_questions)
            ? settings.meta.suggested_questions.filter((item) => item.trim().length > 0)
            : [],
        );
      } else {
        setOpeningStatement(resolveOpeningStatement(undefined, locale));
        setShowCitations(true);
        setSuggestedQuestions([]);
      }
    } catch {
      setOpeningStatement(resolveOpeningStatement(undefined, locale));
    }
  }, [kbId, locale]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const resp = await api(`/v1/kb/${kbId}/qa/logs?limit=30`);
      if (!resp.ok) return;
      setLogs((await readResponseJson<QaLogItem[]>(resp)) ?? []);
    } catch {
      // Logs are optional when API is unavailable.
    } finally {
      setLogsLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    void loadKb();
    void loadLogs();
  }, [loadKb, loadLogs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;
    setError(null);
    setQuery("");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "", pending: true, userQuery: trimmed },
    ]);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let answer = "";
    let meta: QaMeta = {};

    try {
      const body = buildRetrievalBody(preset, trimmed);
      for await (const event of streamQaAnswer(kbId, body, controller.signal)) {
        if (event.event === "retrieval") {
          meta = { ...meta, retrieval_hits: event.hits };
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, meta: { ...meta }, pending: true }
                : message,
            ),
          );
        } else if (event.event === "token") {
          answer += event.content;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: answer, pending: true, meta: { ...meta } }
                : message,
            ),
          );
        } else if (event.event === "citations") {
          meta = { ...meta, citations: event.citations };
        } else if (event.event === "done") {
          answer = event.answer ?? answer;
          meta = {
            model: event.model,
            retrieval_hits: event.retrieval_hits ?? meta.retrieval_hits,
            elapsed_ms: event.elapsed_ms,
            faithfulness_score: event.faithfulness_score,
            citations: event.citations ?? meta.citations,
          };
        }
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                id: assistantId,
                role: "assistant",
                content: answer,
                userQuery: trimmed,
                meta,
              }
            : message,
        ),
      );
      void loadLogs();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : t("err.failed"));
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function deleteMessage(messageId: string) {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;

    const msg = messages[index];
    const pairedAssistant = messages[index + 1];
    const shouldAbort =
      (msg.role === "assistant" && msg.pending) ||
      (msg.role === "user" && pairedAssistant?.role === "assistant" && pairedAssistant.pending);

    if (shouldAbort) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
    }

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (current.role === "user") {
        const next = [...prev];
        next.splice(idx, 1);
        if (next[idx]?.role === "assistant") {
          next.splice(idx, 1);
        }
        return next;
      }
      return prev.filter((m) => m.id !== messageId);
    });
  }

  function clearMessagesIfShowingLog(logId: string) {
    const userId = `log-user-${logId}`;
    const assistantId = `log-assistant-${logId}`;
    setMessages((prev) => {
      if (prev.some((m) => m.id === userId || m.id === assistantId)) {
        return [];
      }
      return prev;
    });
  }

  async function deleteLog(logId: string) {
    try {
      const resp = await api(`/v1/kb/${kbId}/qa/logs/${logId}`, { method: "DELETE" });
      if (!resp.ok) {
        toast.error(t("qa.logDeleteFailed"), {
          description: await apiErrorFromResponse(resp),
        });
        return;
      }
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      clearMessagesIfShowingLog(logId);
      toast.success(t("qa.logDeleted"));
    } catch (e) {
      toast.error(t("qa.logDeleteFailed"), {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function clearAllLogs() {
    try {
      const resp = await api(`/v1/kb/${kbId}/qa/logs`, { method: "DELETE" });
      if (!resp.ok) {
        toast.error(t("qa.logsClearFailed"), {
          description: await apiErrorFromResponse(resp),
        });
        return;
      }
      setLogs([]);
      setMessages((prev) =>
        prev.some((m) => m.id.startsWith("log-user-") || m.id.startsWith("log-assistant-")) ? [] : prev,
      );
      setClearLogsOpen(false);
      toast.success(t("qa.logsCleared"));
    } catch (e) {
      toast.error(t("qa.logsClearFailed"), {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function loadLogIntoChat(log: QaLogItem) {
    setMessages([
      { id: `log-user-${log.id}`, role: "user", content: log.query },
      {
        id: `log-assistant-${log.id}`,
        role: "assistant",
        content: log.answer ?? "",
        userQuery: log.query,
        meta: {
          model: log.model ?? undefined,
          elapsed_ms: log.elapsed_ms ?? undefined,
          citations: log.citations,
        },
      },
    ]);
  }

  function clearChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setQuery("");
    setMessages([]);
    setError(null);
    setClearOpen(false);
  }

  function requestClearChat() {
    if (messages.length === 0) {
      clearChat();
      return;
    }
    setClearOpen(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-0px)]">
      <aside className="flex w-[272px] shrink-0 flex-col border-r border-border/70 bg-muted/15 px-4 py-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">{t("qa.paramsTitle")}</h2>
        <div className="space-y-5">
          <RetrievalSettingsPanel
            preset={preset}
            onChange={(next) => updatePreset(next)}
            t={t}
            rerankProviders={rerankProviders}
            topKMax={20}
          />
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">{t("qa.queryRewrite")}</Label>
            <Switch
              checked={preset.query_rewrite}
              onCheckedChange={(checked) => updatePreset({ query_rewrite: checked === true })}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="w-full"
            onClick={() => updatePreset(applyDifyStarterPreset(kbId))}
          >
            {t("qa.difyPreset")}
          </Button>
        </div>
        <Separator className="my-6" />
        <p className="text-xs leading-relaxed text-muted-foreground">{t("qa.paramsHint")}</p>

        <Separator className="my-6" />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-1">
            <h3 className="text-sm font-semibold text-foreground">{t("qa.logsTitle")}</h3>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label={t("qa.logsRefresh")}
                onClick={() => void loadLogs()}
              >
                <History className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label={t("qa.logsClearAll")}
                disabled={logs.length === 0}
                onClick={() => setClearLogsOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <AlertDialog open={clearLogsOpen} onOpenChange={setClearLogsOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("qa.logsClearConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("qa.logsClearConfirmDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="danger" onClick={() => void clearAllLogs()}>
                  {t("qa.logsClearAll")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {logsLoading ? (
              <p className="text-xs text-muted-foreground">...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("qa.logsEmpty")}</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="group flex items-stretch gap-1 rounded-[var(--radius)] border border-border/50 bg-background pr-1"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2.5 py-2 text-left text-xs hover:bg-muted/40 rounded-[var(--radius)]"
                    onClick={() => loadLogIntoChat(log)}
                  >
                    <div className="line-clamp-2 font-medium text-foreground">{log.query}</div>
                    {log.created_at ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    ) : null}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="my-1 size-7 shrink-0 text-muted-foreground opacity-80 hover:text-destructive"
                    aria-label={t("qa.deleteLog")}
                    onClick={() => void deleteLog(log.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h1 className="m-0 text-lg font-semibold tracking-tight text-foreground">{t("qa.title")}</h1>
            {kbName ? (
              <p className="mt-1 mb-0 text-xs text-muted-foreground">{kbName}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`${kbPath(kbId, "qa")}/dify`} />}>
              {t("qa.difyImport")}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={requestClearChat}>
              <Trash2 className="size-4" />
              {t("qa.clearChat")}
            </Button>
            <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("qa.clearChatConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("qa.clearChatConfirmDesc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="danger" onClick={clearChat}>
                    {t("qa.clearChat")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">{openingStatement}</p>
              {suggestedQuestions.length > 0 ? (
                <div className="mt-5 w-full max-w-lg">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("qa.suggestedQuestions")}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestedQuestions.map((question) => (
                      <Button
                        key={question}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto whitespace-normal px-3 py-2 text-left text-xs"
                        onClick={() => void sendQuestion(question)}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-4 max-w-md text-xs text-muted-foreground">{t("qa.emptyHint")}</p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {messages.map((message, index) => {
                const userQuery =
                  message.role === "assistant"
                    ? message.userQuery ??
                      (messages[index - 1]?.role === "user" ? messages[index - 1].content : undefined)
                    : undefined;
                return message.role === "user" ? (
                  <div
                    key={message.id}
                    className="group relative ml-auto w-full max-w-[min(100%,42rem)]"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-1 right-0 size-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={t("qa.deleteMessage")}
                      onClick={() => deleteMessage(message.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <ChatBubble role="user" content={message.content} />
                  </div>
                ) : (
                  <div key={message.id} className="group relative w-full max-w-[min(100%,42rem)]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-1 right-0 size-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={t("qa.deleteMessage")}
                      onClick={() => deleteMessage(message.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <ChatBubble
                      role="assistant"
                      content={message.pending ? message.content || "" : message.content}
                      streaming={message.pending}
                    />
                    {!message.pending ? (
                      <AssistantExtras
                        meta={message.meta}
                        kbId={kbId}
                        userQuery={userQuery}
                        showCitations={showCitations}
                        t={t}
                      />
                    ) : message.meta?.retrieval_hits != null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("qa.retrievalHits", { n: message.meta.retrieval_hits })}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {error ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-border/60 bg-background px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("qa.contextDocs", { n: docCount })}</span>
              <span>
                {query.length}/{MAX_QUERY_CHARS}
              </span>
            </div>
            <ChatSender
              value={query}
              onChange={setQuery}
              loading={loading}
              placeholder={t("qa.query")}
              autosize={{ minRows: 2, maxRows: 6 }}
              actions={["send"]}
              labels={{
                placeholder: t("qa.query"),
                send: t("qa.ask"),
                stop: t("qa.thinking"),
              }}
              onSend={(value) => void sendQuestion(value)}
              className="shadow-none"
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
