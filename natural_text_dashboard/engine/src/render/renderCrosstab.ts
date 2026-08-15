import { OTHER_KEY } from "../engine/aggregate";
import type { FieldSchema } from "../types/fieldSchema";
import type { AggregatedResult } from "../types/result";
import type { Query } from "../types/spec";
import { appendNotes } from "./renderTable";
import type { AxisPath, DrillContext } from "./interaction";
import { attachHeaderDrillClick } from "./interaction";
import { fieldLabel, formatNumber, measureLabel } from "./labels";

function makeHeaderClickable(td: HTMLElement, query: Query, axisPath: AxisPath, key: string, label: string, interaction?: DrillContext): void {
  const [slot, idxStr] = axisPath.split(".") as ["rows" | "cols", string];
  const axis = (slot === "rows" ? query.rows : query.cols)[Number(idxStr)];
  if (!axis) return;
  attachHeaderDrillClick(td, axis, key, label, axisPath, interaction);
}

/** §6 crosstab: 行×列の集計＋小計・総計。行×列の直積をDOMの表として決定論的に描画する。 */
export function renderCrosstab(schema: FieldSchema, query: Query, result: AggregatedResult, interaction?: DrillContext): HTMLElement {
  const wrap = document.createElement("div");
  if (result.cells.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kdm-empty";
    empty.textContent = "データがありません。";
    wrap.appendChild(empty);
    return wrap;
  }

  const rowOrder: string[] = [];
  const rowLabelOf = new Map<string, string[]>();
  const rowKeyOf = new Map<string, string[]>();
  const colOrder: string[] = [];
  const colLabelOf = new Map<string, string>();
  const colKeyOf = new Map<string, string[]>();
  const valueOf = new Map<string, number | null>();

  for (const cell of result.cells) {
    const rk = cell.rowKey.join("␟");
    const ck = cell.colKey.join("␟");
    if (!rowLabelOf.has(rk)) {
      rowOrder.push(rk);
      rowLabelOf.set(rk, cell.rowLabel);
      rowKeyOf.set(rk, cell.rowKey);
    }
    if (!colLabelOf.has(ck)) {
      colOrder.push(ck);
      colLabelOf.set(ck, cell.colLabel.join(" / "));
      colKeyOf.set(ck, cell.colKey);
    }
    valueOf.set(`${rk}|${ck}`, cell.measures[0] ?? null);
  }

  const table = document.createElement("table");
  table.className = "kdm-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  query.rows.forEach((axis) => {
    const th = document.createElement("th");
    th.textContent = fieldLabel(schema, axis.field);
    headRow.appendChild(th);
  });
  for (const ck of colOrder) {
    const th = document.createElement("th");
    const colLabel = colLabelOf.get(ck) ?? ck;
    th.textContent = colLabel;
    const colKey = colKeyOf.get(ck)?.[0];
    if (colKey !== undefined && colKey !== OTHER_KEY) {
      makeHeaderClickable(th, query, "cols.0", colKey, colLabel, interaction);
    }
    headRow.appendChild(th);
  }
  const totalTh = document.createElement("th");
  totalTh.textContent = "総計";
  headRow.appendChild(totalTh);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const colTotals = new Array(colOrder.length).fill(0) as number[];
  let grandTotal = 0;

  for (const rk of rowOrder) {
    const tr = document.createElement("tr");
    const rowLabels = rowLabelOf.get(rk)!;
    const rowKeys = rowKeyOf.get(rk)!;
    rowLabels.forEach((label, i) => {
      const td = document.createElement("td");
      td.textContent = label;
      const key = rowKeys[i];
      if (key !== undefined && key !== OTHER_KEY) {
        makeHeaderClickable(td, query, (i === 0 ? "rows.0" : "rows.1") as AxisPath, key, label, interaction);
      }
      tr.appendChild(td);
    });
    let rowTotal = 0;
    colOrder.forEach((ck, i) => {
      const v = valueOf.get(`${rk}|${ck}`) ?? null;
      const td = document.createElement("td");
      td.textContent = formatNumber(v, { thousandSeparator: true });
      tr.appendChild(td);
      if (v !== null) {
        rowTotal += v;
        colTotals[i] = (colTotals[i] ?? 0) + v;
      }
    });
    const totalTd = document.createElement("td");
    totalTd.textContent = formatNumber(rowTotal, { thousandSeparator: true });
    tr.appendChild(totalTd);
    grandTotal += rowTotal;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const tfoot = document.createElement("tfoot");
  const footRow = document.createElement("tr");
  const footLabelTd = document.createElement("td");
  footLabelTd.textContent = "総計";
  footLabelTd.colSpan = query.rows.length;
  footRow.appendChild(footLabelTd);
  colTotals.forEach((t) => {
    const td = document.createElement("td");
    td.textContent = formatNumber(t, { thousandSeparator: true });
    footRow.appendChild(td);
  });
  const grandTd = document.createElement("td");
  grandTd.textContent = formatNumber(grandTotal, { thousandSeparator: true });
  footRow.appendChild(grandTd);
  tfoot.appendChild(footRow);
  table.appendChild(tfoot);

  wrap.appendChild(table);

  const caption = document.createElement("div");
  caption.className = "kdm-note";
  caption.textContent = query.measures[0] ? measureLabel(schema, query.measures[0]) : "";
  wrap.insertBefore(caption, table);

  appendNotes(wrap, result);
  return wrap;
}
