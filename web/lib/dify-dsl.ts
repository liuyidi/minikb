import { parse } from "yaml";

export type DifyFlowNode = {
  id: string;
  type: string;
  title: string;
};

export type DifyFlowEdge = {
  source: string;
  target: string;
  sourceTitle?: string;
  targetTitle?: string;
};

export type DifyFileUpload = {
  enabled: boolean;
  allowedTypes: string[];
  maxCount: number;
};

export type DifyAppFeatures = {
  openingStatement?: string;
  suggestedQuestions: string[];
  suggestedQuestionsAfterAnswer: boolean;
  retrieverResource: boolean;
  fileUpload: DifyFileUpload;
  contentModeration: boolean;
};

export type DifyAppSummary = {
  appName: string;
  mode: string;
  icon?: string;
  openingStatement?: string;
  retrieverResource: boolean;
  features: DifyAppFeatures;
  flowNodes: DifyFlowNode[];
  flowEdges: DifyFlowEdge[];
  retrieval?: {
    topK: number;
    rerankEnabled: boolean;
    vectorWeight: number;
    keywordWeight: number;
    embeddingModel?: string;
  };
  llm?: {
    model: string;
    systemPrompt?: string;
    retryEnabled: boolean;
  };
  rawNodeCount: number;
  noteCount: number;
};

type YamlNode = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

function nodeType(node: YamlNode): string {
  if (node.type === "custom-note") return "custom-note";
  const data = node.data ?? {};
  return String(data.type ?? "unknown");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nodeTitle(node: YamlNode): string {
  const data = node.data ?? {};
  return String(data.title ?? data.type ?? node.id ?? "node");
}

function isExecutableNode(type: string): boolean {
  return type !== "custom-note" && type !== "";
}

export function parseDifyDsl(source: string): DifyAppSummary {
  const doc = parse(source) as Record<string, unknown>;
  const app = asRecord(doc.app) ?? {};
  const workflow = asRecord(doc.workflow) ?? {};
  const features = asRecord(workflow.features) ?? {};
  const graph = asRecord(workflow.graph) ?? {};
  const nodes = (Array.isArray(graph.nodes) ? graph.nodes : []) as YamlNode[];
  const edges = (Array.isArray(graph.edges) ? graph.edges : []) as Array<Record<string, unknown>>;

  const nodeById = new Map<string, YamlNode>();
  for (const node of nodes) {
    if (node.id) nodeById.set(String(node.id), node);
  }

  const flowNodes: DifyFlowNode[] = [];
  let noteCount = 0;
  for (const node of nodes) {
    const type = nodeType(node);
    if (type === "custom-note") {
      noteCount += 1;
      continue;
    }
    if (!isExecutableNode(type)) continue;
    flowNodes.push({
      id: String(node.id ?? type),
      type,
      title: nodeTitle(node),
    });
  }

  const flowEdges: DifyFlowEdge[] = [];
  for (const edge of edges) {
    const source = String(edge.source ?? "");
    const target = String(edge.target ?? "");
    if (!source || !target) continue;
    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    const sourceType = sourceNode ? nodeType(sourceNode) : "";
    const targetType = targetNode ? nodeType(targetNode) : "";
    if (!isExecutableNode(sourceType) || !isExecutableNode(targetType)) continue;
    flowEdges.push({
      source,
      target,
      sourceTitle: sourceNode ? nodeTitle(sourceNode) : source,
      targetTitle: targetNode ? nodeTitle(targetNode) : target,
    });
  }

  const retrievalNode = nodes.find((node) => nodeType(node) === "knowledge-retrieval");
  const llmNode = nodes.find((node) => nodeType(node) === "llm");
  const retrievalData = asRecord(retrievalNode?.data);
  const llmData = asRecord(llmNode?.data);
  const multi = asRecord(retrievalData?.multiple_retrieval_config);
  const weights = asRecord(multi?.weights);
  const vectorSetting = asRecord(weights?.vector_setting);
  const keywordSetting = asRecord(weights?.keyword_setting);
  const model = asRecord(llmData?.model);
  const promptTemplate = Array.isArray(llmData?.prompt_template)
    ? (llmData.prompt_template as Array<Record<string, unknown>>)
    : [];
  const systemPrompt = promptTemplate.find((item) => item.role === "system")?.text;
  const retryConfig = asRecord(llmData?.retry_config);
  const retrieverResource = asRecord(features.retriever_resource);
  const suggestedAfterAnswer = asRecord(features.suggested_questions_after_answer);
  const fileUpload = asRecord(features.file_upload);
  const sensitiveWord = asRecord(features.sensitive_word_avoidance);
  const suggestedQuestions = Array.isArray(features.suggested_questions)
    ? features.suggested_questions
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
        .slice(0, 10)
    : [];
  const allowedFileTypes = Array.isArray(fileUpload?.allowed_file_types)
    ? fileUpload.allowed_file_types.map((item) => String(item))
    : [];
  const openingStatement =
    typeof features.opening_statement === "string" ? features.opening_statement : undefined;
  const appFeatures: DifyAppFeatures = {
    openingStatement,
    suggestedQuestions,
    suggestedQuestionsAfterAnswer: suggestedAfterAnswer?.enabled === true,
    retrieverResource: retrieverResource?.enabled === true,
    fileUpload: {
      enabled: fileUpload?.enabled === true,
      allowedTypes: allowedFileTypes,
      maxCount: Number(fileUpload?.number_limits ?? 0),
    },
    contentModeration: sensitiveWord?.enabled === true,
  };

  return {
    appName: String(app.name ?? "Dify App"),
    mode: String(app.mode ?? "unknown"),
    icon: app.icon != null ? String(app.icon) : undefined,
    openingStatement,
    retrieverResource: appFeatures.retrieverResource,
    features: appFeatures,
    flowNodes,
    flowEdges,
    retrieval: retrievalData
      ? {
          topK: Number(multi?.top_k ?? 4),
          rerankEnabled: multi?.reranking_enable === true,
          vectorWeight: Number(vectorSetting?.vector_weight ?? 1),
          keywordWeight: Number(keywordSetting?.keyword_weight ?? 0),
          embeddingModel:
            vectorSetting?.embedding_model_name != null
              ? String(vectorSetting.embedding_model_name)
              : undefined,
        }
      : undefined,
    llm: llmData
      ? {
          model: String(model?.name ?? "unknown"),
          systemPrompt: systemPrompt != null ? String(systemPrompt) : undefined,
          retryEnabled: retryConfig?.retry_enabled === true,
        }
      : undefined,
    rawNodeCount: nodes.length,
    noteCount,
  };
}

export function formatDifyFlow(summary: DifyAppSummary): string {
  if (summary.flowEdges.length === 0 && summary.flowNodes.length === 0) {
    return "(no executable nodes)";
  }
  const lines = summary.flowEdges.map(
    (edge) => `${edge.sourceTitle ?? edge.source} → ${edge.targetTitle ?? edge.target}`,
  );
  if (lines.length > 0) return lines.join("\n");
  return summary.flowNodes.map((node) => node.title).join(" → ");
}
