import type { z } from "zod";
import type { DataSource } from "../data/DataSource";
import { LIMITS } from "../config/limits";
import { renderDashboard } from "../engine";
import { generateExportHtml } from "../export/exportHtml";
import { buildSemanticModel } from "../semantic/buildSemanticModel";
import { ResultStore } from "../spec/resultStore";
import { SpecStore } from "../spec/specStore";
import { validateFilters, validateWidget } from "../spec/validator";
import type { FieldSchema } from "../types/fieldSchema";
import { toolError, type ToolError } from "../types/errors";
import type { SemanticModel } from "../types/semantic";
import type { DashboardSpec, Widget, WidgetType } from "../types/spec";
import { isMapQuery } from "../types/spec";
import * as S from "./schemas";

export function isToolError(x: unknown): x is ToolError {
  return typeof x === "object" && x !== null && "code" in x;
}

export type ToolDef<I, O> = { name: string; description: string; input: z.ZodType<I>; handler: (input: I) => Promise<O> };

export type ExportedFile = { filename: string; blob: Blob };

export type DashboardTools = {
  describe_app: ToolDef<z.infer<typeof S.DescribeAppInput>, SemanticModel>;
  create_dashboard: ToolDef<z.infer<typeof S.CreateDashboardInput>, { ok: true; dashboardId: string } | ToolError>;
  add_widget: ToolDef<z.infer<typeof S.AddWidgetInput>, { ok: true; widgetId: string; warnings: string[] } | ToolError>;
  update_widget: ToolDef<z.infer<typeof S.UpdateWidgetInput>, { ok: true; warnings: string[] } | ToolError>;
  remove_widget: ToolDef<z.infer<typeof S.RemoveWidgetInput>, { ok: true } | ToolError>;
  set_layout: ToolDef<z.infer<typeof S.SetLayoutInput>, { ok: true } | ToolError>;
  set_filters: ToolDef<z.infer<typeof S.SetFiltersInput>, { ok: true; matchedCount: number } | ToolError>;
  render_dashboard: ToolDef<
    z.infer<typeof S.RenderDashboardInput>,
    { ok: true; widgets: { id: string; status: string; rowCount?: number }[] } | ToolError
  >;
  get_dashboard: ToolDef<z.infer<typeof S.GetDashboardInput>, DashboardSpec | ToolError>;
  read_aggregate: ToolDef<
    z.infer<typeof S.ReadAggregateInput>,
    | {
        ok: true;
        rows: { rowLabel: string[]; colLabel: string[]; measures: (number | null)[] }[];
        truncated: boolean;
        overlapping: boolean;
      }
    | ToolError
  >;
  export_html: ToolDef<z.infer<typeof S.ExportHtmlInput>, { ok: true; filename: string; bytes: number; warnings: string[] } | ToolError>;
};

function defaultTriggerDownload(filename: string, html: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type DashboardRuntime = { tools: DashboardTools; specStore: SpecStore; resultStore: ResultStore };

/**
 * §5.1: ツール本体は (input) => output の純粋な関数として定義する。
 * navigator.modelContext への登録はアダプタ(register.ts)側が行い、この層はトランスポート非依存に保つ。
 *
 * specStore/resultStore はAI向けツール契約には含めないが、同一ランタイム内のレンダラ（アプリ側UI）が
 * 画面を描くためには参照が要る（P1はAIに対する境界であって、信頼済みのランタイム内部の話ではない）。
 * そのため createDashboardRuntime で合わせて返す。
 */
export function createDashboardRuntime(
  dataSource: DataSource,
  options?: { onExport?: (filename: string, html: string) => void },
): DashboardRuntime {
  const specStore = new SpecStore();
  const resultStore = new ResultStore();
  const triggerDownload = options?.onExport ?? defaultTriggerDownload;

  let cachedSchema: FieldSchema | undefined;
  let cachedModel: SemanticModel | undefined;

  async function getSchema(): Promise<FieldSchema> {
    if (!cachedSchema) cachedSchema = await dataSource.getSchema();
    return cachedSchema;
  }

  async function getModel(): Promise<SemanticModel> {
    if (cachedModel) return cachedModel;
    const schema = await getSchema();
    const appInfo = await dataSource.getAppInfo();
    const recordCountHint = await dataSource.countRecords([]);
    const records: import("../data/DataSource").RawRecord[] = [];
    for await (const chunk of dataSource.fetchRecords({ filters: [], fields: [] })) {
      records.push(...chunk);
    }
    cachedModel = { ...buildSemanticModel(schema, { recordCountHint, records }), appId: appInfo.appId, appName: appInfo.appName };
    return cachedModel;
  }

  function requireWidget(dashboardId: string, widgetId: string): { spec: DashboardSpec; widget: Widget } | ToolError {
    const spec = specStore.get(dashboardId);
    if (!spec) return toolError("DASHBOARD_NOT_FOUND", `ダッシュボード「${dashboardId}」は存在しません。`);
    const widget = spec.widgets.find((w) => w.id === widgetId);
    if (!widget) return toolError("WIDGET_NOT_FOUND", `ウィジェット「${widgetId}」は存在しません。`);
    return { spec, widget };
  }

  const tools: DashboardTools = {
    describe_app: {
      name: "describe_app",
      description: "起点。このアプリのデータについて何を聞けるか（軸・指標・時間フィールド・地図候補・質問例）を返す。",
      input: S.DescribeAppInput,
      handler: async () => getModel(),
    },

    create_dashboard: {
      name: "create_dashboard",
      description:
        "空のダッシュボードを作る。このダッシュボードは保存されず、ページを離れると消える。残すには export_html を使うこと。",
      input: S.CreateDashboardInput,
      handler: async (input) => {
        const schema = await getSchema();
        const filters = input.filters ?? [];
        const err = validateFilters(schema, filters);
        if (err) return err;
        const spec = specStore.create(schema.appId, input.title, filters);
        return { ok: true, dashboardId: spec.dashboardId };
      },
    },

    add_widget: {
      name: "add_widget",
      description: "ウィジェットを1個追加する。Spec検証を通し、失敗時は理由と代替候補を返す。",
      input: S.AddWidgetInput,
      handler: async (input) => {
        const schema = await getSchema();
        const draft: Widget = { id: "draft", position: { x: 0, y: 0, w: 0, h: 0 }, ...input.widget };
        const err = validateWidget(schema, draft);
        if (err) return err;
        const result = specStore.addWidget(input.dashboardId, input.widget);
        if (isToolError(result)) return result;
        return { ok: true, widgetId: result.id, warnings: [] };
      },
    },

    update_widget: {
      name: "update_widget",
      description: "既存ウィジェットを部分更新する。",
      input: S.UpdateWidgetInput,
      handler: async (input) => {
        const found = requireWidget(input.dashboardId, input.widgetId);
        if (isToolError(found)) return found;
        const schema = await getSchema();
        const merged: Widget = {
          ...found.widget,
          title: input.patch.title ?? found.widget.title,
          query: (input.patch.query ?? found.widget.query) as Widget["query"],
          options: input.patch.options ?? found.widget.options,
        };
        const err = validateWidget(schema, merged);
        if (err) return err;
        const result = specStore.updateWidget(input.dashboardId, input.widgetId, input.patch);
        if (isToolError(result)) return result;
        return { ok: true, warnings: [] };
      },
    },

    remove_widget: {
      name: "remove_widget",
      description: "ウィジェットを削除する。",
      input: S.RemoveWidgetInput,
      handler: async (input) => {
        const result = specStore.removeWidget(input.dashboardId, input.widgetId);
        if (isToolError(result)) return result;
        resultStore.clearWidget(input.dashboardId, input.widgetId);
        return { ok: true };
      },
    },

    set_layout: {
      name: "set_layout",
      description: "ダッシュボード全体のレイアウト（列数）を変更する。",
      input: S.SetLayoutInput,
      handler: async (input) => {
        const result = specStore.setLayout(input.dashboardId, input.layout);
        if (isToolError(result)) return result;
        return { ok: true };
      },
    },

    set_filters: {
      name: "set_filters",
      description: "ダッシュボード全体フィルタを設定する。マッチ件数のみ返す（レコードは返さない）。",
      input: S.SetFiltersInput,
      handler: async (input) => {
        const schema = await getSchema();
        const err = validateFilters(schema, input.filters);
        if (err) return err;
        const result = specStore.setFilters(input.dashboardId, input.filters);
        if (isToolError(result)) return result;
        const matchedCount = await dataSource.countRecords(input.filters);
        return { ok: true, matchedCount };
      },
    },

    render_dashboard: {
      name: "render_dashboard",
      description: "Specを実際に集計・描画する。データそのものは返さず、ウィジェットごとの成否と件数だけを返す。",
      input: S.RenderDashboardInput,
      handler: async (input) => {
        const spec = specStore.get(input.dashboardId);
        if (!spec) return toolError("DASHBOARD_NOT_FOUND", `ダッシュボード「${input.dashboardId}」は存在しません。`);
        const schema = await getSchema();
        const result = await renderDashboard(dataSource, schema, spec, resultStore);
        if (isToolError(result)) return result;
        return {
          ok: true,
          widgets: result.widgets.map((w) => ({ id: w.id, status: w.status, rowCount: w.status === "ok" ? w.rowCount : undefined })),
        };
      },
    },

    get_dashboard: {
      name: "get_dashboard",
      description: "現在のダッシュボード定義（メモリ上のSpec）を返す。",
      input: S.GetDashboardInput,
      handler: async (input) => {
        const spec = specStore.get(input.dashboardId);
        if (!spec) return toolError("DASHBOARD_NOT_FOUND", `ダッシュボード「${input.dashboardId}」は存在しません。`);
        return spec;
      },
    },

    read_aggregate: {
      name: "read_aggregate",
      description: "集計テーブルをAIに見せる（P1の明示的な例外）。地図ウィジェットには使えない。",
      input: S.ReadAggregateInput,
      handler: async (input) => {
        const found = requireWidget(input.dashboardId, input.widgetId);
        if (isToolError(found)) return found;
        if (found.widget.type === "map") {
          return toolError("MAP_NOT_READABLE", "地図ウィジェットの集計テーブルは取得できません（座標は生データに相当するため）。");
        }
        const stored = resultStore.get(input.dashboardId, input.widgetId);
        if (!stored || stored.kind !== "agg") {
          return toolError("WIDGET_NOT_FOUND", "先に render_dashboard を実行してください。");
        }
        const maxCells = Math.min(input.maxCells ?? LIMITS.maxReadAggregateCells, LIMITS.maxReadAggregateCells);
        const truncated = stored.result.cells.length > maxCells || stored.result.truncated;
        const rows = stored.result.cells.slice(0, maxCells).map((c) => ({ rowLabel: c.rowLabel, colLabel: c.colLabel, measures: c.measures }));
        return { ok: true, rows, truncated, overlapping: stored.result.overlapping };
      },
    },

    export_html: {
      name: "export_html",
      description: "現在のダッシュボードを自己完結HTMLファイルとしてダウンロードさせる。これがダッシュボードを残す唯一の方法。",
      input: S.ExportHtmlInput,
      handler: async (input) => {
        const spec = specStore.get(input.dashboardId);
        if (!spec) return toolError("DASHBOARD_NOT_FOUND", `ダッシュボード「${input.dashboardId}」は存在しません。`);
        const schema = await getSchema();
        const hasMap = spec.widgets.some((w) => isMapQuery(w.query));
        if (hasMap && !input.confirmed) {
          return toolError(
            "MAP_EXPORT_NEEDS_CONFIRMATION",
            "このダッシュボードは地図ウィジェットを含みます。エクスポートしたファイルには座標（実質的な生データ）が含まれ、kintoneのアクセス権の外に出ます。続行するには confirmed: true を指定してください。",
          );
        }
        // エクスポート時点のスナップショットにするため、直前に再描画して結果を最新化する（§9.1）
        const renderResult = await renderDashboard(dataSource, schema, spec, resultStore);
        if (isToolError(renderResult)) return renderResult;
        const failedWidgets = new Map(
          renderResult.widgets.filter((w): w is typeof w & { status: "error" } => w.status === "error").map((w) => [w.id, w.error]),
        );
        const warnings = spec.widgets
          .filter((w) => failedWidgets.has(w.id))
          .map((w) => `ウィジェット「${w.title}」は集計に失敗したため空のまま出力されました: ${failedWidgets.get(w.id)!.message}`);
        const recordCount = await dataSource.countRecords(spec.filters);
        const html = generateExportHtml({ schema, spec, resultStore, appName: schema.appName, recordCount, failedWidgets });
        const filename = input.filename ?? defaultExportFilename(schema.appName);
        triggerDownload(filename, html);
        return { ok: true, filename, bytes: new Blob([html]).size, warnings };
      },
    },
  };

  return { tools, specStore, resultStore };
}

/** AI向けツール群だけが要る呼び出し元（register.ts / テスト）向けの薄いラッパー */
export function createDashboardTools(
  dataSource: DataSource,
  options?: { onExport?: (filename: string, html: string) => void },
): DashboardTools {
  return createDashboardRuntime(dataSource, options).tools;
}

function defaultExportFilename(appName: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${appName}_dashboard_${stamp}.html`;
}

export type { WidgetType };
