import { toJsonSchemaTools } from "./jsonSchema";
import type { AiTools, CreateSessionParams, ProviderDefinition, ProviderSession, ProviderTurnResult, ToolCallLog } from "./types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

type OpenAiToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type OpenAiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function callOpenAi(params: {
  apiKey: string;
  model: string;
  messages: OpenAiMessage[];
  tools: ReturnType<typeof toJsonSchemaTools>;
}): Promise<
  | { message: { content: string | null; tool_calls?: OpenAiToolCall[] } }
  | { error: string }
> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    });
  } catch (e) {
    return { error: `OpenAI APIへの通信に失敗しました(ネットワーク/CORS): ${String(e)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `OpenAI API error ${res.status} ${res.statusText}: ${text.slice(0, 800)}` };
  }
  const data = (await res.json()) as { choices?: { message: { content: string | null; tool_calls?: OpenAiToolCall[] } }[] };
  const message = data.choices?.[0]?.message;
  if (!message) return { error: `OpenAI APIから予期しない応答形式でした: ${JSON.stringify(data).slice(0, 800)}` };
  return { message };
}

class OpenAiSession implements ProviderSession {
  private messages: OpenAiMessage[];
  private readonly tools: ReturnType<typeof toJsonSchemaTools>;

  constructor(private readonly params: CreateSessionParams) {
    this.tools = toJsonSchemaTools(params.tools);
    this.messages = [{ role: "system", content: params.systemInstruction }];
  }

  async sendUserMessage(text: string, onToolCall: (log: ToolCallLog) => void): Promise<ProviderTurnResult> {
    this.messages.push({ role: "user", content: text });
    const toolMap = this.params.tools as unknown as Record<string, AiTools[keyof AiTools]>;
    const maxRounds = 8;

    for (let round = 0; round < maxRounds; round++) {
      const result = await callOpenAi({ apiKey: this.params.apiKey, model: this.params.model, messages: this.messages, tools: this.tools });
      if ("error" in result) return { error: result.error };
      const { message } = result;
      this.messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return { finalText: message.content ?? "" };
      }

      for (const call of message.tool_calls) {
        const { name } = call.function;
        let args: unknown = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          this.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, code: "INVALID_INPUT", message: "引数のJSONが不正です。" }) });
          continue;
        }
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
        this.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(response) });
      }
    }
    return { error: "最大ラウンド数に達したため打ち切りました(無限ループ防止)。" };
  }
}

export const openaiProvider: ProviderDefinition = {
  id: "openai",
  label: "OpenAI",
  defaultModel: "gpt-4.1",
  modelChoices: [
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4o", label: "GPT-4o" },
  ],
  createSession: (params) => new OpenAiSession(params),
};
