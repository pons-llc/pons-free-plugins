import type { DataSource } from "../data/DataSource";
import type { DashboardTools } from "../mcp/tools";
import { disposeWidgetResources, renderWidgetCard } from "../render";
import { fieldLabel } from "../render/labels";
import type { ResultStore } from "../spec/resultStore";
import type { SpecStore } from "../spec/specStore";
import type { FieldSchema } from "../types/fieldSchema";
import type { Filter } from "../types/spec";

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** ドリルダウンが埋め込むISO日時文字列は、チップ上では読みやすい日本語表記に変換する */
function formatFilterValue(v: string | number): string {
  if (typeof v === "string" && ISO_DATETIME_RE.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("ja-JP", { dateStyle: "medium" });
  }
  return String(v);
}

export function filterChipText(schema: FieldSchema, f: Filter): string {
  const label = fieldLabel(schema, f.field);
  switch (f.op) {
    case "eq":
      return `${label} = ${formatFilterValue(f.value)}`;
    case "ne":
      return `${label} ≠ ${formatFilterValue(f.value)}`;
    case "in":
      return `${label} ∈ {${f.values.map(formatFilterValue).join(", ")}}`;
    case "notIn":
      return `${label} ∉ {${f.values.map(formatFilterValue).join(", ")}}`;
    case "gt":
      return `${label} > ${formatFilterValue(f.value)}`;
    case "gte":
      return `${label} ${formatFilterValue(f.value)} 以降`;
    case "lt":
      return `${label} ${formatFilterValue(f.value)} より前`;
    case "lte":
      return `${label} ≤ ${formatFilterValue(f.value)}`;
    case "between":
      return `${label}: ${formatFilterValue(f.from)}〜${formatFilterValue(f.to)}`;
    case "contains":
      return `${label} に「${f.value}」を含む`;
    case "isEmpty":
      return `${label} が空`;
    case "isNotEmpty":
      return `${label} が空でない`;
  }
}

export type DashboardPanel = { render: (dashboardId: string) => Promise<void> };

/**
 * フィルタchipバー + ウィジェットグリッドの描画・再描画をまとめた共通部品。
 * デモUI(main.ts)とチャットUI(chat.ts)の両方から使う。
 * ドリルダウン（render/interaction.ts）は onChanged 経由でこの render() を呼び直す。
 */
export function createDashboardPanel(opts: {
  dataSource: DataSource;
  tools: DashboardTools;
  specStore: SpecStore;
  resultStore: ResultStore;
  filterBarEl: HTMLElement;
  gridEl: HTMLElement;
}): DashboardPanel {
  async function render(dashboardId: string): Promise<void> {
    const spec = opts.specStore.get(dashboardId);
    if (!spec) return;
    const schema = await opts.dataSource.getSchema();

    opts.filterBarEl.innerHTML = "";
    for (const f of spec.filters) {
      const chip = document.createElement("span");
      chip.className = "kdm-filter-chip";
      const text = document.createElement("span");
      text.textContent = filterChipText(schema, f);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "このフィルタを解除");
      removeBtn.addEventListener("click", () => {
        void (async () => {
          const nextFilters = spec.filters.filter((other) => other !== f);
          await opts.tools.set_filters.handler({ dashboardId, filters: nextFilters });
          await opts.tools.render_dashboard.handler({ dashboardId });
          await render(dashboardId);
        })();
      });
      chip.append(text, removeBtn);
      opts.filterBarEl.appendChild(chip);
    }

    disposeWidgetResources(opts.gridEl);
    opts.gridEl.innerHTML = "";
    for (const widget of spec.widgets) {
      opts.gridEl.appendChild(
        renderWidgetCard(schema, widget, opts.resultStore.get(dashboardId, widget.id), {
          tools: opts.tools,
          dashboardId,
          onChanged: () => render(dashboardId),
        }),
      );
    }
  }

  return { render };
}
