import type { ResultStore } from "../spec/resultStore";
import type { ToolError } from "../types/errors";
import type { FieldSchema } from "../types/fieldSchema";
import type { DashboardSpec, Filter, Widget } from "../types/spec";
import { isMapQuery } from "../types/spec";
import { fieldLabel, measureLabel } from "../render/labels";
import { CATEGORICAL_DARK, CATEGORICAL_LIGHT, THEME_CSS } from "../render/theme";
import { EXPORT_RUNTIME_JS } from "./runtimeScript";
import {
  chartJsSrc,
  leafletCssSrc,
  leafletJsSrc,
  markerClusterCssSrc,
  markerClusterDefaultCssSrc,
  markerClusterJsSrc,
} from "./vendorAssets";

function filterLabel(schema: FieldSchema, f: Filter): string {
  const label = fieldLabel(schema, f.field);
  switch (f.op) {
    case "eq":
      return `${label} = ${f.value}`;
    case "ne":
      return `${label} ≠ ${f.value}`;
    case "in":
      return `${label} ∈ {${f.values.join(", ")}}`;
    case "notIn":
      return `${label} ∉ {${f.values.join(", ")}}`;
    case "gt":
      return `${label} > ${f.value}`;
    case "gte":
      return `${label} ≥ ${f.value}`;
    case "lt":
      return `${label} < ${f.value}`;
    case "lte":
      return `${label} ≤ ${f.value}`;
    case "between":
      return `${label}: ${f.from}〜${f.to}`;
    case "contains":
      return `${label} に「${f.value}」を含む`;
    case "isEmpty":
      return `${label} が空`;
    case "isNotEmpty":
      return `${label} が空でない`;
  }
}

function buildExportWidget(
  schema: FieldSchema,
  widget: Widget,
  resultStore: ResultStore,
  dashboardId: string,
  failedWidgets: Map<string, ToolError>,
): Record<string, unknown> {
  const base = { id: widget.id, title: widget.title, type: widget.type, position: widget.position, options: widget.options ?? {} };
  const failure = failedWidgets.get(widget.id);
  if (failure) {
    return { ...base, kind: "error", message: failure.message };
  }
  const stored = resultStore.get(dashboardId, widget.id);

  if (widget.type === "map") {
    if (!stored || stored.kind !== "map") return { ...base, kind: "map", points: [], excludedCount: 0, truncated: false };
    return { ...base, kind: "map", points: stored.result.points, excludedCount: stored.result.excludedCount, truncated: stored.result.truncated };
  }

  const query = widget.query as Exclude<Widget["query"], { geo: unknown }>;
  const rowFieldLabels = query.rows.map((a) => fieldLabel(schema, a.field));
  const colFieldLabel = query.cols[0] ? fieldLabel(schema, query.cols[0].field) : undefined;
  const measureLabels = query.measures.map((m) => measureLabel(schema, m));

  if (!stored || stored.kind !== "agg") {
    return { ...base, kind: "agg", rowFieldLabels, colFieldLabel, measureLabels, cells: [], overlapping: false, truncated: false };
  }
  return {
    ...base,
    kind: "agg",
    rowFieldLabels,
    colFieldLabel,
    measureLabels,
    cells: stored.result.cells,
    overlapping: stored.result.overlapping,
    truncated: stored.result.truncated,
  };
}

function escapeForInlineScript(json: string): string {
  return json.replace(/</g, "\\u003C");
}

export type GenerateExportHtmlInput = {
  schema: FieldSchema;
  spec: DashboardSpec;
  resultStore: ResultStore;
  appName: string;
  recordCount?: number;
  /** render_dashboard で集計に失敗したウィジェット（TOO_MANY_GROUPSなど）。空データと区別してエラー表示する */
  failedWidgets?: Map<string, ToolError>;
};

/**
 * §9: DashboardSpec + Result を単一の自己完結HTMLファイルへ封入する。
 * テンプレートはコード中の定数で、AIが文字列を差し込む余地はない（P2）。
 * 埋め込みJSONは `<` をエスケープしてから挿入し、</script> によるコンテキスト脱出を防ぐ。
 */
export function generateExportHtml(input: GenerateExportHtmlInput): string {
  const { schema, spec, resultStore, appName, recordCount, failedWidgets = new Map() } = input;
  const hasMap = spec.widgets.some((w) => isMapQuery(w.query));

  const data = {
    appName,
    dashboardTitle: spec.title,
    exportedAt: new Date().toLocaleString("ja-JP"),
    filters: spec.filters.map((f) => filterLabel(schema, f)),
    recordCount: recordCount ?? null,
    widgets: spec.widgets.map((w) => buildExportWidget(schema, w, resultStore, spec.dashboardId, failedWidgets)),
  };

  const json = escapeForInlineScript(JSON.stringify(data));

  const mapAssets = hasMap
    ? `<style>${leafletCssSrc}\n${markerClusterCssSrc}\n${markerClusterDefaultCssSrc}</style>\n<script>${leafletJsSrc}</script>\n<script>${markerClusterJsSrc}</script>`
    : "";

  // 配色はここで render/theme.ts の値をそのまま埋め込む。ランタイムJS(runtimeScript.ts)は
  // 自前の配色定数を持たず、この window.KDM_PALETTE を読む。ライブアプリと同じ1つの定義から
  // 生成するため、パレットを変更してもエクスポートHTMLと画面表示が食い違わない。
  const paletteScript = `<script>window.KDM_PALETTE={light:${JSON.stringify(CATEGORICAL_LIGHT)},dark:${JSON.stringify(CATEGORICAL_DARK)}};</script>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtmlText(spec.title)} - ${escapeHtmlText(appName)}</title>
<style>${THEME_CSS}</style>
${mapAssets}
<script>${chartJsSrc}</script>
${paletteScript}
</head>
<body>
<div class="kdm-root">
  <div id="kdm-meta" style="padding:12px 12px 0;font-size:12px;color:var(--kdm-text-secondary);"></div>
  <div class="kdm-grid" id="kdm-grid"></div>
</div>
<script type="application/json" id="kdm-data">${json}</script>
<script>${EXPORT_RUNTIME_JS}</script>
</body>
</html>
`;
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
