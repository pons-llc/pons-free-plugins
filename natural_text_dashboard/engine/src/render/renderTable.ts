import { OTHER_KEY } from "../engine/aggregate";
import type { FieldSchema } from "../types/fieldSchema";
import type { AggregatedResult } from "../types/result";
import type { Query } from "../types/spec";
import type { AxisPath, DrillContext } from "./interaction";
import { attachHeaderDrillClick } from "./interaction";
import { fieldLabel, formatNumber, measureLabel } from "./labels";

function appendNotes(container: HTMLElement, result: AggregatedResult): void {
  if (result.overlapping) {
    const note = document.createElement("div");
    note.className = "kdm-note";
    note.textContent = "※ 多値項目を含むため、合計はレコード数と一致しません。";
    container.appendChild(note);
  }
  if (result.truncated) {
    const note = document.createElement("div");
    note.className = "kdm-note";
    note.textContent = "※ グループ数が上限を超えたため、上位のみ表示し残りは「その他」に集約しています。";
    container.appendChild(note);
  }
}

export function renderTable(schema: FieldSchema, query: Query, result: AggregatedResult, interaction?: DrillContext): HTMLElement {
  const wrap = document.createElement("div");
  if (result.cells.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kdm-empty";
    empty.textContent = "データがありません。";
    wrap.appendChild(empty);
    return wrap;
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
  query.measures.forEach((ref) => {
    const th = document.createElement("th");
    th.textContent = measureLabel(schema, ref);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const cell of result.cells) {
    const tr = document.createElement("tr");
    cell.rowLabel.forEach((label, i) => {
      const td = document.createElement("td");
      td.textContent = label;
      const key = cell.rowKey[i];
      const axis = query.rows[i];
      if (key !== undefined && key !== OTHER_KEY && axis) {
        attachHeaderDrillClick(td, axis, key, label, (i === 0 ? "rows.0" : "rows.1") as AxisPath, interaction);
      }
      tr.appendChild(td);
    });
    cell.measures.forEach((m, i) => {
      const td = document.createElement("td");
      td.textContent = formatNumber(m, { thousandSeparator: true });
      tr.appendChild(td);
      void i;
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  appendNotes(wrap, result);
  return wrap;
}

export { appendNotes };
