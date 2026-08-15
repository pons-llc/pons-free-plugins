import { toJsonSchemaTools } from "./jsonSchema";
import type { AiTools, CreateSessionParams, ProviderDefinition, ProviderSession, ProviderTurnResult, ToolCallLog } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 4096;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };
type ClaudeMessage = { role: "user" | "assistant"; content: string | ClaudeContentBlock[] };

async function callClaude(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: ClaudeMessage[];
  tools: ReturnType<typeof toJsonSchemaTools>;
}): Promise<{ content: ClaudeContentBlock[]; stopReason: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        // ブラウザから直接叩くための明示的なオプトイン(通常はサーバーサイド専用エンドポイント)。
        // このプラグインはローカル利用専用でAPIキーをユーザーがその場で入力する前提のため許容する。
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: MAX_TOKENS,
        system: params.system,
        messages: params.messages,
        tools: params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      }),
    });
  } catch (e) {
    return { error: `Claude APIへの通信に失敗しました(ネットワーク/CORS): ${String(e)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Claude API error ${res.status} ${res.statusText}: ${text.slice(0, 800)}` };
  }
  const data = (await res.json()) as { content?: ClaudeContentBlock[]; stop_reason?: string };
  if (!Array.isArray(data.content)) return { error: `Claude APIから予期しない応答形式でした: ${JSON.stringify(data).slice(0, 800)}` };
  return { content: data.content, stopReason: data.stop_reason ?? "end_turn" };
}

class ClaudeSession implements ProviderSession {
  private messages: ClaudeMessage[] = [];
  private readonly tools: ReturnType<typeof toJsonSchemaTools>;

  constructor(private readonly params: CreateSessionParams) {
    this.tools = toJsonSchemaTools(params.tools);
  }

  async sendUserMessage(text: string, onToolCall: (log: ToolCallLog) => void): Promise<ProviderTurnResult> {
    this.messages.push({ role: "user", content: text });
    const toolMap = this.params.tools as unknown as Record<string, AiTools[keyof AiTools]>;
    const maxRounds = 8;

    for (let round = 0; round < maxRounds; round++) {
      const result = await callClaude({
        apiKey: this.params.apiKey,
        model: this.params.model,
        system: this.params.systemInstruction,
        messages: this.messages,
        tools: this.tools,
      });
      if ("error" in result) return { error: result.error };
      this.messages.push({ role: "assistant", content: result.content });

      const toolUses = result.content.filter((b): b is Extract<ClaudeContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      if (result.stopReason !== "tool_use" || toolUses.length === 0) {
        const finalText = result.content
          .filter((b): b is Extract<ClaudeContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("");
        return { finalText };
      }

      const toolResults: ClaudeContentBlock[] = [];
      for (const call of toolUses) {
        const tool = toolMap[call.name];
        let response: Record<string, unknown>;
        if (!tool) {
          response = { ok: false, code: "UNKNOWN_TOOL", message: `ツール「${call.name}」は存在しません。` };
        } else {
          const parsed = tool.input.safeParse(call.input);
          if (!parsed.success) {
            response = { ok: false, code: "INVALID_INPUT", message: parsed.error.message };
          } else {
            const raw = await tool.handler(parsed.data as never);
            response = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : { value: raw };
          }
        }
        onToolCall({ name: call.name, args: call.input, result: response });
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(response) });
      }
      this.messages.push({ role: "user", content: toolResults });
    }
    return { error: "最大ラウンド数に達したため打ち切りました(無限ループ防止)。" };
  }
}

export const claudeProvider: ProviderDefinition = {
  id: "claude",
  label: "Anthropic Claude",
  defaultModel: "claude-sonnet-5",
  modelChoices: [
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { value: "claude-opus-5", label: "Claude Opus 5" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  createSession: (params) => new ClaudeSession(params),
};
