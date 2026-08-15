import { zodToJsonSchema } from "zod-to-json-schema";
import type { AiTools } from "./types";

/** OpenAI/Claudeは標準に近いJSON Schemaをそのまま受け付けるため、Geminiほどの補正は不要。$schema等のメタキーだけ除く。 */
function stripMeta(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripMeta);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "$schema" || key === "definitions" || key === "$defs") continue;
    out[key] = stripMeta(value);
  }
  return out;
}

export type ToolJsonSchema = { name: string; description: string; parameters: Record<string, unknown> };

export function toJsonSchemaTools(tools: AiTools): ToolJsonSchema[] {
  return Object.values(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: stripMeta(zodToJsonSchema(tool.input as never, { $refStrategy: "none" })) as Record<string, unknown>,
  }));
}
