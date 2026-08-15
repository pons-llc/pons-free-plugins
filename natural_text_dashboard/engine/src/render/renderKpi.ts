import type { FieldSchema } from "../types/fieldSchema";
import type { AggregatedResult } from "../types/result";
import type { Query } from "../types/spec";
import { formatNumber, measureLabel } from "./labels";

export function renderKpi(schema: FieldSchema, query: Query, result: AggregatedResult): HTMLElement {
  const wrap = document.createElement("div");
  const cell = result.cells[0];
  const value = document.createElement("div");
  value.className = "kdm-kpi-value";
  value.textContent = cell ? formatNumber(cell.measures[0] ?? null, { thousandSeparator: true }) : "-";
  wrap.appendChild(value);

  const label = document.createElement("div");
  label.className = "kdm-note";
  label.textContent = query.measures[0] ? measureLabel(schema, query.measures[0]) : "";
  wrap.appendChild(label);

  return wrap;
}
