import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import type { ProviderDefinition, ProviderId } from "./types";

export const PROVIDERS: ProviderDefinition[] = [geminiProvider, openaiProvider, claudeProvider];

export function getProvider(id: ProviderId): ProviderDefinition {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown provider: ${id}`);
  return found;
}

export type { ProviderDefinition, ProviderId, ProviderSession, ToolCallLog, ProviderTurnResult, CreateSessionParams, AiTools } from "./types";
