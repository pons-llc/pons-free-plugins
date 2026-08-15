import type { AggregatedResult, MapProjectionResult } from "../types/result";

export type WidgetResult =
  | { kind: "agg"; result: AggregatedResult }
  | { kind: "map"; result: MapProjectionResult };

/**
 * render_dashboard が書き込み、read_aggregate / レンダラ / export_html が読む集計結果の置き場。
 * SpecStore同様メモリのみ（P6）。生レコードはここには一切乗らない。
 */
export class ResultStore {
  private readonly results = new Map<string, WidgetResult>();

  private key(dashboardId: string, widgetId: string): string {
    return `${dashboardId}:${widgetId}`;
  }

  set(dashboardId: string, widgetId: string, result: WidgetResult): void {
    this.results.set(this.key(dashboardId, widgetId), result);
  }

  get(dashboardId: string, widgetId: string): WidgetResult | undefined {
    return this.results.get(this.key(dashboardId, widgetId));
  }

  clearDashboard(dashboardId: string): void {
    for (const k of [...this.results.keys()]) {
      if (k.startsWith(`${dashboardId}:`)) this.results.delete(k);
    }
  }

  clearWidget(dashboardId: string, widgetId: string): void {
    this.results.delete(this.key(dashboardId, widgetId));
  }
}
