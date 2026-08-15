import type { WidgetResult } from "../spec/resultStore";
import type { FieldSchema } from "../types/fieldSchema";
import type { Query, Widget } from "../types/spec";
import { forWidget, type InteractionBase } from "./interaction";
import { renderChart } from "./renderChart";
import { renderCrosstab } from "./renderCrosstab";
import { renderKpi } from "./renderKpi";
import { renderMap } from "./renderMap";
import { renderTable } from "./renderTable";

export { disposeWidgetResources } from "./chartRegistry";

/**
 * (Widget, Result) => HTMLElement の純関数群のエントリポイント。
 * ウィジェット種別ごとに固定の実装だけを呼び分け、外部テンプレートやHTML文字列は受け付けない（P2）。
 * interaction を渡すとチャート/表のクリックでドリルダウンメニューが有効になる（ライブアプリのみ。§10参照）。
 */
export function renderWidgetBody(
  schema: FieldSchema,
  widget: Widget,
  widgetResult: WidgetResult | undefined,
  interaction?: InteractionBase,
): HTMLElement {
  if (!widgetResult) {
    const pending = document.createElement("div");
    pending.className = "kdm-empty";
    pending.textContent = "未描画です。render_dashboard を実行してください。";
    return pending;
  }

  if (widget.type === "map") {
    if (widgetResult.kind !== "map") throw new Error("unexpected result kind for map widget");
    return renderMap(widgetResult.result, widget.options?.mapStyle ?? "pale");
  }

  if (widgetResult.kind !== "agg") throw new Error("unexpected result kind");
  const query = widget.query as Query;
  const drill = interaction ? forWidget(interaction, widget.id) : undefined;

  switch (widget.type) {
    case "kpi":
      return renderKpi(schema, query, widgetResult.result);
    case "table":
      return renderTable(schema, query, widgetResult.result, drill);
    case "crosstab":
      return renderCrosstab(schema, query, widgetResult.result, drill);
    case "bar":
    case "line":
    case "pie":
      return renderChart(schema, widget.type, query, widgetResult.result, widget.options, drill);
    default:
      throw new Error(`unknown widget type: ${widget.type satisfies never}`);
  }
}

export function renderWidgetCard(
  schema: FieldSchema,
  widget: Widget,
  widgetResult: WidgetResult | undefined,
  interaction?: InteractionBase,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "kdm-widget";
  card.style.gridColumn = `${widget.position.x + 1} / span ${widget.position.w}`;
  card.style.gridRow = `${widget.position.y + 1} / span ${widget.position.h}`;
  card.dataset.widgetId = widget.id;

  const title = document.createElement("h3");
  title.textContent = widget.title;
  card.appendChild(title);
  card.appendChild(renderWidgetBody(schema, widget, widgetResult, interaction));
  return card;
}
