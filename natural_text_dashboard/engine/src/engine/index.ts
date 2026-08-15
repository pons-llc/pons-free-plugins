import { LIMITS } from "../config/limits";
import type { DataSource, FetchPlan, RawRecord } from "../data/DataSource";
import type { ResultStore } from "../spec/resultStore";
import { toolError, type ToolError } from "../types/errors";
import type { FieldSchema } from "../types/fieldSchema";
import type { DashboardSpec, MapQuery, Query } from "../types/spec";
import { aggregateQuery } from "./aggregate";
import { projectToPoints } from "./mapProjection";
import { buildFetchPlans, widgetsById } from "./planner";

export type WidgetRenderStatus =
  | { id: string; status: "ok"; rowCount: number }
  | { id: string; status: "error"; error: ToolError };

async function collectRecords(dataSource: DataSource, plan: FetchPlan): Promise<RawRecord[] | ToolError> {
  const records: RawRecord[] = [];
  for await (const chunk of dataSource.fetchRecords(plan)) {
    records.push(...chunk);
    if (records.length > LIMITS.maxFetchRecords) {
      return toolError(
        "RECORD_LIMIT_EXCEEDED",
        `取得見込み件数が上限（${LIMITS.maxFetchRecords}）を超えました。フィルタで絞り込んでください。`,
      );
    }
  }
  return records;
}

/**
 * §7.1 の実行計画どおり、FetchPlanごとに1回だけ取得し、そのストリームを
 * 該当ウィジェットの集計/地図投影に多重に流す。結果は resultStore に書き込むだけで、
 * AIへは §5.2 の render_dashboard 戻り値（id/status/rowCountのみ）しか返さない。
 */
export async function renderDashboard(
  dataSource: DataSource,
  schema: FieldSchema,
  spec: DashboardSpec,
  resultStore: ResultStore,
): Promise<{ ok: true; widgets: WidgetRenderStatus[] } | ToolError> {
  resultStore.clearDashboard(spec.dashboardId);
  const plans = buildFetchPlans(spec);
  const widgets = widgetsById(spec);
  const statuses: WidgetRenderStatus[] = [];

  for (const group of plans) {
    const records = await collectRecords(dataSource, group.plan);
    if (!Array.isArray(records)) {
      for (const widgetId of group.widgetIds) {
        statuses.push({ id: widgetId, status: "error", error: records });
      }
      continue;
    }

    for (const widgetId of group.widgetIds) {
      const widget = widgets.get(widgetId);
      if (!widget) continue;

      if (widget.type === "map") {
        const result = projectToPoints(schema, widget.query as MapQuery, records);
        resultStore.set(spec.dashboardId, widgetId, { kind: "map", result });
        statuses.push({ id: widgetId, status: "ok", rowCount: result.points.length });
        continue;
      }

      const result = aggregateQuery(schema, widget.query as Query, records, widget.type);
      if ("code" in result) {
        statuses.push({ id: widgetId, status: "error", error: result });
        continue;
      }
      resultStore.set(spec.dashboardId, widgetId, { kind: "agg", result });
      statuses.push({ id: widgetId, status: "ok", rowCount: result.cells.length });
    }
  }

  return { ok: true, widgets: statuses };
}

export { buildFetchPlans } from "./planner";
export { aggregateQuery } from "./aggregate";
export { projectToPoints } from "./mapProjection";
