import type { RawRecord } from "../data/DataSource";
import { LIMITS } from "../config/limits";
import { toolError, type ToolError } from "../types/errors";
import type { FieldSchema } from "../types/fieldSchema";
import type { AggregatedResult, ResultCell } from "../types/result";
import type { Query, WidgetType } from "../types/spec";
import { advanceBucket, bucketDate, extractAxisValues, parseBucketKeyToDate, type KeyLabel } from "./axisValues";
import { extractDistinctKeys, extractMeasureNumeric } from "./measureValues";

const KEY_SEP = " ";
/** limit.rows/cols超過時に畳んだグループのキー。複数値の合算なので、クリックしてもドリルダウン対象にはしない */
export const OTHER_KEY = "__other__";
const OTHER_LABEL = "その他";

type MeasureAcc = {
  sum: number;
  count: number;
  min: number;
  max: number;
  distinct: Set<string>;
};

function newMeasureAcc(): MeasureAcc {
  return { sum: 0, count: 0, min: Infinity, max: -Infinity, distinct: new Set() };
}

type Cell = {
  rowKey: string[];
  rowLabel: string[];
  colKey: string[];
  colLabel: string[];
  count: number;
  measureAccs: MeasureAcc[];
};

function comboKey(combo: KeyLabel[]): string {
  return combo.map((c) => c.key).join(KEY_SEP);
}

/** 複数軸のそれぞれが返す候補値配列から、直積（デカルト積）のコンボ一覧を作る */
function cartesian(perAxisValues: KeyLabel[][]): KeyLabel[][] {
  if (perAxisValues.length === 0) return [[]];
  let result: KeyLabel[][] = [[]];
  for (const values of perAxisValues) {
    const next: KeyLabel[][] = [];
    for (const prefix of result) {
      for (const v of values) {
        next.push([...prefix, v]);
      }
    }
    result = next;
  }
  return result;
}

function finalizeMeasures(query: Query, cell: Cell): (number | null)[] {
  return query.measures.map((ref, i) => {
    if (ref.agg === "count") return cell.count;
    const acc = cell.measureAccs[i]!;
    switch (ref.agg) {
      case "sum":
        return acc.count > 0 ? acc.sum : 0;
      case "avg":
        return acc.count > 0 ? acc.sum / acc.count : null;
      case "min":
        return acc.count > 0 ? acc.min : null;
      case "max":
        return acc.count > 0 ? acc.max : null;
      case "distinct":
        return acc.distinct.size;
      default:
        return null;
    }
  });
}

function primaryMeasureValue(query: Query, cell: Cell): number {
  const values = finalizeMeasures(query, cell);
  return values[0] ?? 0;
}

/** query.sort（現状は誰にも消費されず無視されていた）を最終セル列に適用する */
function sortResultCells(cells: ResultCell[], sort: NonNullable<Query["sort"]>): void {
  const dir = sort.order === "asc" ? 1 : -1;
  cells.sort((a, b) => {
    let cmp: number;
    if (sort.by === "row") {
      const av = a.rowLabel.join(KEY_SEP);
      const bv = b.rowLabel.join(KEY_SEP);
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    } else {
      const mi = sort.index ?? 0;
      const av = a.measures[mi] ?? -Infinity;
      const bv = b.measures[mi] ?? -Infinity;
      cmp = av - bv;
    }
    return cmp * dir;
  });
}

/** limit.rows/cols を超えるグループを上位N + 「その他」に畳む。otherBucket未指定なら TOO_MANY_GROUPS を返す。 */
function foldExcessGroups(
  query: Query,
  cells: Map<string, Cell> | Cell[],
  axis: "row" | "col",
  limit: number,
): { cells: Cell[]; truncated: boolean } | ToolError {
  const source = Array.isArray(cells) ? cells : [...cells.values()];
  const groupKeyOf = (c: Cell) => (axis === "row" ? c.rowKey.join(KEY_SEP) : c.colKey.join(KEY_SEP));
  const groups = new Map<string, Cell[]>();
  for (const cell of source) {
    const gk = groupKeyOf(cell);
    const arr = groups.get(gk) ?? [];
    arr.push(cell);
    groups.set(gk, arr);
  }
  if (groups.size <= limit) return { cells: source, truncated: false };

  if (!query.limit?.otherBucket) {
    return toolError(
      "TOO_MANY_GROUPS",
      `${axis === "row" ? "行" : "列"}のグループ数が上限（${limit}）を超えています。limit.otherBucket を指定すると上位N＋「その他」に畳めます。`,
    );
  }

  const totals = [...groups.entries()].map(([gk, groupCells]) => ({
    gk,
    total: groupCells.reduce((s, c) => s + primaryMeasureValue(query, c), 0),
    cells: groupCells,
  }));
  totals.sort((a, b) => b.total - a.total);
  const kept = new Set(totals.slice(0, limit - 1).map((t) => t.gk));

  const result: Cell[] = [];
  const otherByComplement = new Map<string, Cell>();
  for (const { gk, cells: groupCells } of totals) {
    if (kept.has(gk)) {
      result.push(...groupCells);
      continue;
    }
    for (const cell of groupCells) {
      const complementKey = axis === "row" ? cell.colKey.join(KEY_SEP) : cell.rowKey.join(KEY_SEP);
      let other = otherByComplement.get(complementKey);
      if (!other) {
        other = {
          rowKey: axis === "row" ? [OTHER_KEY] : cell.rowKey,
          rowLabel: axis === "row" ? [OTHER_LABEL] : cell.rowLabel,
          colKey: axis === "col" ? [OTHER_KEY] : cell.colKey,
          colLabel: axis === "col" ? [OTHER_LABEL] : cell.colLabel,
          count: 0,
          measureAccs: query.measures.map(newMeasureAcc),
        };
        otherByComplement.set(complementKey, other);
      }
      other.count += cell.count;
      cell.measureAccs.forEach((acc, i) => {
        const oacc = other!.measureAccs[i]!;
        oacc.sum += acc.sum;
        oacc.count += acc.count;
        oacc.min = Math.min(oacc.min, acc.min);
        oacc.max = Math.max(oacc.max, acc.max);
        acc.distinct.forEach((v) => oacc.distinct.add(v));
      });
    }
  }
  result.push(...otherByComplement.values());
  return { cells: result, truncated: true };
}

function zeroFillLine(schema: FieldSchema, query: Query, cells: Cell[]): Cell[] {
  const rowAxis = query.rows[0];
  if (!rowAxis || !("bucket" in rowAxis)) return cells;
  if (cells.length === 0) return cells;
  const bucket = rowAxis.bucket;

  // 列軸(crosstab的なline)がある場合、系列(colKey)ごとに個別にゼロ埋めする。
  // 全系列を通じた日付範囲は揃える（系列によって範囲がバラバラだと比較しづらいため）。
  const colGroups = new Map<string, { colKey: string[]; colLabel: string[]; cells: Cell[] }>();
  for (const c of cells) {
    const ck = c.colKey.join(KEY_SEP);
    let group = colGroups.get(ck);
    if (!group) {
      group = { colKey: c.colKey, colLabel: c.colLabel, cells: [] };
      colGroups.set(ck, group);
    }
    group.cells.push(c);
  }

  const allKeys = cells.map((c) => c.rowKey[0]!).sort();
  const start = parseBucketKeyToDate(allKeys[0]!, bucket);
  const end = parseBucketKeyToDate(allKeys[allKeys.length - 1]!, bucket);
  if (!start || !end) return cells;

  const out: Cell[] = [];
  for (const group of colGroups.values()) {
    const filled = new Map<string, Cell>();
    for (const c of group.cells) filled.set(c.rowKey[0]!, c);

    let cursor = start;
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 10_000) {
      guard++;
      const { key, label } = bucketDate(cursor, bucket);
      const existing = filled.get(key);
      if (existing) {
        out.push(existing);
      } else {
        out.push({
          rowKey: [key],
          rowLabel: [label],
          colKey: group.colKey,
          colLabel: group.colLabel,
          count: 0,
          measureAccs: query.measures.map(newMeasureAcc),
        });
      }
      cursor = advanceBucket(cursor, bucket);
    }
  }
  return out;
}

/**
 * 決定論的な group-by 集計。§7.1/7.2 に従い、1回の取得(records)から
 * 複数軸・複数指標の集計テーブルを1パスで作る。
 */
export function aggregateQuery(
  schema: FieldSchema,
  query: Query,
  records: RawRecord[],
  widgetType?: WidgetType,
): AggregatedResult | ToolError {
  const cells = new Map<string, Cell>();
  let overlapping = false;

  for (const record of records) {
    const rowValuesPerAxis = query.rows.map((axis) => extractAxisValues(schema, axis, record));
    const colValuesPerAxis = query.cols.map((axis) => extractAxisValues(schema, axis, record));

    if (query.rows.some((_, i) => rowValuesPerAxis[i]!.length > 1) || query.cols.some((_, i) => colValuesPerAxis[i]!.length > 1)) {
      overlapping = true;
    }
    // 行/列いずれかの軸で値が取れなかったレコードはそのウィジェットの集計から除外する
    if (rowValuesPerAxis.some((v) => v.length === 0) || colValuesPerAxis.some((v) => v.length === 0)) {
      continue;
    }

    const rowCombos = cartesian(rowValuesPerAxis);
    const colCombos = cartesian(colValuesPerAxis);

    for (const rowCombo of rowCombos) {
      for (const colCombo of colCombos) {
        const key = `${comboKey(rowCombo)}|${comboKey(colCombo)}`;
        let cell = cells.get(key);
        if (!cell) {
          cell = {
            rowKey: rowCombo.map((c) => c.key),
            rowLabel: rowCombo.map((c) => c.label),
            colKey: colCombo.map((c) => c.key),
            colLabel: colCombo.map((c) => c.label),
            count: 0,
            measureAccs: query.measures.map(newMeasureAcc),
          };
          cells.set(key, cell);
        }
        cell.count += 1;
        query.measures.forEach((ref, i) => {
          if (ref.agg === "count") return;
          const acc = cell!.measureAccs[i]!;
          if (ref.agg === "distinct") {
            extractDistinctKeys(schema, ref.field, record).forEach((k) => acc.distinct.add(k));
            return;
          }
          const n = extractMeasureNumeric(schema, ref, record);
          if (n === null) return;
          acc.sum += n;
          acc.count += 1;
          acc.min = Math.min(acc.min, n);
          acc.max = Math.max(acc.max, n);
        });
      }
    }
  }

  let truncated = false;
  let cellList: Cell[];

  // limit.rows/cols に 0 以下が渡ると slice(0, limit-1) が slice(0,-1) など意図しない範囲になるため、
  // 上限だけでなく下限も 1 にクランプする（0件へ畳む用途は otherBucket 一本で表現し、limit では表さない）。
  const rowLimit = Math.max(1, Math.min(query.limit?.rows ?? LIMITS.maxGroupsPerWidget, LIMITS.maxGroupsPerWidget));
  const rowFolded = foldExcessGroups(query, cells, "row", rowLimit);
  if ("code" in rowFolded) return rowFolded;
  truncated = truncated || rowFolded.truncated;
  cellList = rowFolded.cells;

  if (query.cols.length > 0) {
    const colLimit = Math.max(1, Math.min(query.limit?.cols ?? LIMITS.maxGroupsPerWidget, LIMITS.maxGroupsPerWidget));
    const colFolded = foldExcessGroups(query, cellList, "col", colLimit);
    if ("code" in colFolded) return colFolded;
    truncated = truncated || colFolded.truncated;
    cellList = colFolded.cells;
  }

  if (widgetType === "line" && query.rows.length === 1 && "bucket" in query.rows[0]!) {
    cellList = zeroFillLine(schema, query, cellList);
  }

  const resultCells: ResultCell[] = cellList
    .filter((c) => c.count > 0 || widgetType === "line")
    .map((c) => ({
      rowKey: c.rowKey,
      rowLabel: c.rowLabel,
      colKey: c.colKey,
      colLabel: c.colLabel,
      measures: finalizeMeasures(query, c),
    }));

  if (query.sort) {
    sortResultCells(resultCells, query.sort);
  }

  return {
    cells: resultCells,
    overlapping,
    truncated,
    rowCount: records.length,
  };
}
