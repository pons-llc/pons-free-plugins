import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { toolError, type ToolError } from "../types/errors";
import type { DashboardTools } from "./tools";

type ToolContent = { content: { type: "text"; text: string }[]; isError?: boolean };

function toContent(output: unknown): ToolContent {
  const isError = typeof output === "object" && output !== null && "code" in output;
  return { content: [{ type: "text", text: JSON.stringify(output) }], isError };
}

type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (args: unknown) => Promise<ToolContent>;
};

declare global {
  interface Navigator {
    modelContext?: {
      registerTool: (tool: ModelContextTool) => void;
    };
  }
  interface Window {
    __kintoneDashboardMcp?: Record<string, (args: unknown) => Promise<unknown>>;
  }
}

/**
 * zod の .parse() は失敗時に例外を投げるため、そのまま呼ぶと不正な入力で
 * Promise が reject し、他のあらゆるエラー経路が守っている ToolError({ok:false,code,...}) の
 * 統一契約を破ってしまう。ここで一度だけ吸収し、失敗時は INVALID_INPUT の ToolError にする。
 */
function safeParseInput<T>(schema: ZodType<T>, args: unknown): { ok: true; value: T } | { ok: false; error: ToolError } {
  const result = schema.safeParse(args);
  if (result.success) return { ok: true, value: result.data };
  const message = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join(" / ");
  return { ok: false, error: toolError("INVALID_INPUT", `入力が不正です: ${message}`) };
}

/**
 * §5.1: navigator.modelContext (WebMCP) はまだ標準化途上のため機能検出し、
 * 未提供の環境では window.__kintoneDashboardMcp に同じツール群を露出するフォールバックを置く。
 * ツール本体(tools.ts)は (input) => output の純関数のままで、ここはトランスポートを吸収するだけ。
 */
export function registerTools(tools: DashboardTools): { transport: "webmcp" | "fallback" } {
  const entries = Object.values(tools) as { name: string; description: string; input: ZodType<unknown>; handler: (input: unknown) => Promise<unknown> }[];

  if (typeof navigator !== "undefined" && navigator.modelContext) {
    for (const tool of entries) {
      navigator.modelContext.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.input as never),
        execute: async (args) => {
          const parsed = safeParseInput(tool.input, args);
          if (!parsed.ok) return toContent(parsed.error);
          return toContent(await tool.handler(parsed.value));
        },
      });
    }
    return { transport: "webmcp" };
  }

  if (typeof window !== "undefined") {
    window.__kintoneDashboardMcp = {};
    for (const tool of entries) {
      window.__kintoneDashboardMcp[tool.name] = async (args: unknown) => {
        const parsed = safeParseInput(tool.input, args);
        if (!parsed.ok) return parsed.error;
        return tool.handler(parsed.value);
      };
    }
  }
  return { transport: "fallback" };
}
