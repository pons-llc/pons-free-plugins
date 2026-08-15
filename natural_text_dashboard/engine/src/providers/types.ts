import type { DashboardTools } from "../mcp/tools";

export type ToolCallLog = { name: string; args: unknown; result: unknown };

export type ProviderTurnResult = { finalText?: string; error?: string };

/** 1つのチャットセッション = 1つのプロバイダAPIとの会話履歴を内部に保持する状態機械 */
export interface ProviderSession {
  sendUserMessage(text: string, onToolCall: (log: ToolCallLog) => void): Promise<ProviderTurnResult>;
}

export type ProviderId = "gemini" | "openai" | "claude";

/**
 * AIに渡すツール集合からは export_html を除く。ダウンロードはAIの気まぐれな判断でなく、
 * 常設のダウンロードボタン(entry.tsが直接 tools.export_html を呼ぶ)からユーザーが明示操作した
 * ときだけ発生させたいため。ボタン側は createDashboardRuntime() が返す完全な DashboardTools を使う。
 */
export type AiTools = Omit<DashboardTools, "export_html">;

export type CreateSessionParams = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  tools: AiTools;
};

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  modelChoices: { value: string; label: string }[];
  createSession: (params: CreateSessionParams) => ProviderSession;
};
