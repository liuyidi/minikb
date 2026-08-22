import { api, apiErrorFromResponse } from "@/lib/api";

export type QaCitation = {
  index: number;
  chunk_id?: string;
  document_id?: string;
  doc_title?: string;
  doc_uri?: string;
  text_snippet?: string;
};

export type QaStreamEvent =
  | { event: "retrieval"; hits: number }
  | { event: "token"; content: string }
  | { event: "citations"; citations: QaCitation[] }
  | {
      event: "done";
      answer?: string;
      citations?: QaCitation[];
      model?: string;
      elapsed_ms?: number;
      faithfulness_score?: number;
      retrieval_hits?: number;
    };

function parseSseChunk(chunk: string): QaStreamEvent | null {
  const line = chunk.trim();
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as QaStreamEvent;
  } catch {
    return null;
  }
}

export async function* streamQaAnswer(
  kbId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<QaStreamEvent> {
  const resp = await api(`/v1/kb/${kbId}/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!resp.ok) {
    throw new Error(await apiErrorFromResponse(resp));
  }
  if (!resp.body) {
    throw new Error("No response body");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseSseChunk(part);
      if (event) yield event;
    }
  }

  if (buffer.trim()) {
    const event = parseSseChunk(buffer);
    if (event) yield event;
  }
}
