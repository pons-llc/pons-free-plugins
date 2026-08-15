import { zodToJsonSchema } from "zod-to-json-schema";
import type { AiTools, CreateSessionParams, ProviderDefinition, ProviderSession, ProviderTurnResult, ToolCallLog } from "./types";

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function endpoint(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Gemini の function calling が受け付ける parameters は OpenAPI 3.0 の部分集合(protobufのSchemaメッセージ)で、
 * 標準の JSON Schema より狭い(kintone-dashboard-mcp/src/gemini/functionDeclarations.ts で実機確認済みの補正をそのまま移植)。
 */
function sanitizeForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "additionalProperties" || key === "$schema" || key === "definitions" || key === "$defs") continue;
    if (key === "type" && Array.isArray(value)) {
      out.anyOf = value.map((t) => ({ type: t }));
      continue;
    }
    if (key === "const") {
      if (typeof value === "string") out.enum = [value];
      continue;
    }
    if (key === "exclusiveMinimum") {
      out.minimum = value;
      continue;
    }
    out[key] = sanitizeForGemini(value);
  }
  return out;
}

function toFunctionDeclarations(tools: AiTools) {
  return Object.values(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: sanitizeForGemini(zodToJsonSchema(tool.input as never, { $refStrategy: "none" })) as Record<string, unknown>,
  }));
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: GeminiContent[];
  functionDeclarations: ReturnType<typeof toFunctionDeclarations>;
}): Promise<{ parts: GeminiPart[] } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint(params.model, params.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        contents: params.contents,
        tools: [{ functionDeclarations: params.functionDeclarations }],
      }),
    });
  } catch (e) {
    return { error: `Gemini APIへの通信に失敗しました(ネットワーク/CORS): ${String(e)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Gemini API error ${res.status} ${res.statusText}: ${text.slice(0, 800)}` };
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) return { error: `Geminiにブロックされました: ${data.promptFeedback.blockReason}` };
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return { error: `Gemini APIから予期しない応答形式でした: ${JSON.stringify(data).slice(0, 800)}` };
  return { parts };
}

class GeminiSession implements ProviderSession {
  private contents: GeminiContent[] = [];
  private readonly functionDeclarations: ReturnType<typeof toFunctionDeclarations>;

  constructor(private readonly params: CreateSessionParams) {
    this.functionDeclarations = toFunctionDeclarations(params.tools);
  }

  async sendUserMessage(text: string, onToolCall: (log: ToolCallLog) => void): Promise<ProviderTurnResult> {
    this.contents.push({ role: "user", parts: [{ text }] });
    const toolMap = this.params.tools as unknown as Record<string, AiTools[keyof AiTools]>;
    const maxRounds = 8;

    for (let round = 0; round < maxRounds; round++) {
      const result = await callGemini({
        apiKey: this.params.apiKey,
        model: this.params.model,
        systemInstruction: this.params.systemInstruction,
        contents: this.contents,
        functionDeclarations: this.functionDeclarations,
      });
      if ("error" in result) return { error: result.error };
      this.contents.push({ role: "model", parts: result.parts });

      const functionCalls = result.parts.filter(
        (p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p,
      );
      if (functionCalls.length === 0) {
        return { finalText: result.parts.map((p) => ("text" in p ? p.text : "")).join("") };
      }

      const responseParts: GeminiPart[] = [];
      for (const call of functionCalls) {
        const { name, args } = call.functionCall;
        const tool = toolMap[name];
        let response: Record<string, unknown>;
        if (!tool) {
          response = { ok: false, code: "UNKNOWN_TOOL", message: `ツール「${name}」は存在しません。` };
        } else {
          const parsed = tool.input.safeParse(args);
          if (!parsed.success) {
            response = { ok: false, code: "INVALID_INPUT", message: parsed.error.message };
          } else {
            const raw = await tool.handler(parsed.data as never);
            response = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : { value: raw };
          }
        }
        onToolCall({ name, args, result: response });
        responseParts.push({ functionResponse: { name, response } });
      }
      this.contents.push({ role: "user", parts: responseParts });
    }
    return { error: "最大ラウンド数に達したため打ち切りました(無限ループ防止)。" };
  }
}

export const geminiProvider: ProviderDefinition = {
  id: "gemini",
  label: "Google Gemini",
  defaultModel: "gemini-3.5-flash-lite",
  modelChoices: [
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite(軽量・無料枠向け)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  createSession: (params) => new GeminiSession(params),
};
