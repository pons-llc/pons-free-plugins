import { LIMITS } from "../config/limits";
import { toolError, type ToolError } from "../types/errors";
import type { DashboardSpec, Filter, Widget, WidgetType } from "../types/spec";

let dashboardSeq = 0;
let widgetSeq = 0;

function nextDashboardId(): string {
  dashboardSeq += 1;
  return `dash_${dashboardSeq}`;
}

function nextWidgetId(): string {
  widgetSeq += 1;
  return `widget_${widgetSeq}`;
}

const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  kpi: { w: 4, h: 2 },
  bar: { w: 6, h: 4 },
  line: { w: 6, h: 4 },
  pie: { w: 6, h: 4 },
  table: { w: 12, h: 5 },
  crosstab: { w: 12, h: 6 },
  map: { w: 12, h: 8 },
};

type FlowCursor = { x: number; y: number; rowH: number };

/**
 * DashboardSpec の唯一の保持場所。§2 P6（使い捨て）どおりメモリのみ、プロセス終了・リロードで消える。
 * サーバへの保存やシリアライズ永続化は行わない。
 */
export class SpecStore {
  private readonly dashboards = new Map<string, DashboardSpec>();
  private readonly flowCursors = new Map<string, FlowCursor>();

  create(appId: string, title: string, filters: Filter[] = []): DashboardSpec {
    const dashboardId = nextDashboardId();
    const spec: DashboardSpec = {
      specVersion: "1.0",
      dashboardId,
      appId,
      title,
      filters,
      layout: { columns: 12 },
      widgets: [],
    };
    this.dashboards.set(dashboardId, spec);
    this.flowCursors.set(dashboardId, { x: 0, y: 0, rowH: 0 });
    return spec;
  }

  get(dashboardId: string): DashboardSpec | undefined {
    return this.dashboards.get(dashboardId);
  }

  requireGet(dashboardId: string): DashboardSpec | ToolError {
    const spec = this.dashboards.get(dashboardId);
    if (!spec) return toolError("DASHBOARD_NOT_FOUND", `ダッシュボード「${dashboardId}」は存在しません。`);
    return spec;
  }

  private nextPosition(dashboardId: string, w: number, h: number): { x: number; y: number; w: number; h: number } {
    const cursor = this.flowCursors.get(dashboardId) ?? { x: 0, y: 0, rowH: 0 };
    if (cursor.x + w > 12) {
      cursor.y += cursor.rowH;
      cursor.x = 0;
      cursor.rowH = 0;
    }
    const position = { x: cursor.x, y: cursor.y, w, h };
    cursor.x += w;
    cursor.rowH = Math.max(cursor.rowH, h);
    this.flowCursors.set(dashboardId, cursor);
    return position;
  }

  addWidget(
    dashboardId: string,
    input: { type: WidgetType; title: string; query: Widget["query"]; options?: Widget["options"] },
  ): Widget | ToolError {
    const spec = this.requireGet(dashboardId);
    if ("ok" in spec) return spec;
    if (spec.widgets.length >= LIMITS.maxWidgetsPerDashboard) {
      return toolError("WIDGET_LIMIT_EXCEEDED", `ダッシュボードあたりのウィジェット数上限（${LIMITS.maxWidgetsPerDashboard}）を超えています。`);
    }
    const size = DEFAULT_SIZE[input.type];
    const widget: Widget = {
      id: nextWidgetId(),
      type: input.type,
      title: input.title,
      position: this.nextPosition(dashboardId, size.w, size.h),
      query: input.query,
      options: input.options,
    };
    spec.widgets.push(widget);
    return widget;
  }

  updateWidget(dashboardId: string, widgetId: string, patch: Partial<Pick<Widget, "title" | "query" | "options">>): Widget | ToolError {
    const spec = this.requireGet(dashboardId);
    if ("ok" in spec) return spec;
    const widget = spec.widgets.find((w) => w.id === widgetId);
    if (!widget) return toolError("WIDGET_NOT_FOUND", `ウィジェット「${widgetId}」は存在しません。`);
    if (patch.title !== undefined) widget.title = patch.title;
    if (patch.query !== undefined) widget.query = patch.query;
    if (patch.options !== undefined) widget.options = patch.options;
    return widget;
  }

  removeWidget(dashboardId: string, widgetId: string): true | ToolError {
    const spec = this.requireGet(dashboardId);
    if ("ok" in spec) return spec;
    const idx = spec.widgets.findIndex((w) => w.id === widgetId);
    if (idx === -1) return toolError("WIDGET_NOT_FOUND", `ウィジェット「${widgetId}」は存在しません。`);
    spec.widgets.splice(idx, 1);
    return true;
  }

  setLayout(dashboardId: string, layout: { columns: 12 }): true | ToolError {
    const spec = this.requireGet(dashboardId);
    if ("ok" in spec) return spec;
    spec.layout = layout;
    return true;
  }

  setFilters(dashboardId: string, filters: Filter[]): true | ToolError {
    const spec = this.requireGet(dashboardId);
    if ("ok" in spec) return spec;
    spec.filters = filters;
    return true;
  }
}
