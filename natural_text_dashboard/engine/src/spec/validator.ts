import type { FieldSchema, KintoneFieldProperty } from "../types/fieldSchema";
import { toolError, type ToolError } from "../types/errors";
import type { Axis, Filter, MeasureRef, Query, Widget, WidgetType } from "../types/spec";
import { isMapQuery } from "../types/spec";
import { isAggregatableAsAxis, isAggregatableAsMeasure, resolveEffectiveType, roleOf } from "../semantic/fieldRole";
import { detectGeoCandidates } from "../semantic/geo";

type ShapeRule = { rows: [number, number]; cols: [number, number]; measures: [number, number] };

/** §6「ウィジェット種別と必要な形」を単一の情報源として validator が形と型の両方を検証する */
const WIDGET_SHAPE: Record<Exclude<WidgetType, "map">, ShapeRule> = {
  kpi: { rows: [0, 0], cols: [0, 0], measures: [1, 1] },
  bar: { rows: [1, 1], cols: [0, 1], measures: [1, Infinity] },
  line: { rows: [1, 1], cols: [0, 1], measures: [1, Infinity] },
  pie: { rows: [1, 1], cols: [0, 0], measures: [1, 1] },
  table: { rows: [1, 2], cols: [0, 0], measures: [1, Infinity] },
  crosstab: { rows: [1, 2], cols: [1, 1], measures: [1, 1] },
};

function alternativeDimensionCodes(schema: FieldSchema, limit = 3): string[] {
  const out: string[] = [];
  for (const prop of Object.values(schema.properties)) {
    const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
    const role = roleOf(effective);
    if (role === "dimension" || role === "multiDimension") {
      out.push(prop.code);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function resolveField(schema: FieldSchema, code: string): KintoneFieldProperty | undefined {
  return schema.properties[code];
}

function checkShape(type: WidgetType, query: Query): ToolError | null {
  const rule = WIDGET_SHAPE[type as Exclude<WidgetType, "map">];
  if (!rule) return null;
  const { rows, cols, measures } = rule;
  if (query.rows.length < rows[0] || query.rows.length > rows[1]) {
    return toolError(
      "WIDGET_SHAPE_INVALID",
      `${type} は rows を${rows[0]}〜${rows[1] === Infinity ? "∞" : rows[1]}個持つ必要があります（現在${query.rows.length}個）。`,
    );
  }
  if (query.cols.length < cols[0] || query.cols.length > cols[1]) {
    return toolError(
      "WIDGET_SHAPE_INVALID",
      `${type} は cols を${cols[0]}〜${cols[1] === Infinity ? "∞" : cols[1]}個持つ必要があります（現在${query.cols.length}個）。`,
    );
  }
  if (query.measures.length < measures[0] || query.measures.length > measures[1]) {
    return toolError(
      "WIDGET_SHAPE_INVALID",
      `${type} は measures を${measures[0]}〜${measures[1] === Infinity ? "∞" : measures[1]}個持つ必要があります（現在${query.measures.length}個）。`,
    );
  }
  return null;
}

function checkAxisField(schema: FieldSchema, axis: Axis): ToolError | null {
  const prop = resolveField(schema, axis.field);
  if (!prop) {
    return toolError("FIELD_NOT_FOUND", `フィールド「${axis.field}」は存在しません。`, { field: axis.field });
  }
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  if (effective === "SUBTABLE") {
    return toolError("SUBTABLE_UNSUPPORTED", `フィールド「${prop.label}」はサブテーブルのためMVPでは非対応です。`, {
      field: axis.field,
    });
  }
  const role = roleOf(effective);
  if (!isAggregatableAsAxis(role, effective)) {
    return toolError(
      "FIELD_NOT_AGGREGATABLE",
      `フィールド「${prop.label}」(${prop.type}) は集計軸に使えません。`,
      { field: axis.field, alternatives: alternativeDimensionCodes(schema) },
    );
  }
  if ("bucket" in axis) {
    if (role !== "time") {
      return toolError("BUCKET_NOT_APPLICABLE", `フィールド「${prop.label}」は時間フィールドではないため時間バケットを指定できません。`, {
        field: axis.field,
      });
    }
  }
  if ("bins" in axis) {
    if (role !== "measure") {
      return toolError("AGG_TYPE_MISMATCH", `フィールド「${prop.label}」は数値フィールドではないためビン化できません。`, {
        field: axis.field,
      });
    }
  }
  return null;
}

function checkMeasureRef(schema: FieldSchema, ref: MeasureRef): ToolError | null {
  if (ref.agg === "count") return null;
  const prop = resolveField(schema, ref.field);
  if (!prop) {
    return toolError("FIELD_NOT_FOUND", `フィールド「${ref.field}」は存在しません。`, { field: ref.field });
  }
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  if (effective === "SUBTABLE") {
    return toolError("SUBTABLE_UNSUPPORTED", `フィールド「${prop.label}」はサブテーブルのためMVPでは非対応です。`, {
      field: ref.field,
    });
  }
  const role = roleOf(effective);
  if (ref.agg === "distinct") {
    if (!isAggregatableAsAxis(role, effective)) {
      return toolError("AGG_TYPE_MISMATCH", `フィールド「${prop.label}」には distinct を適用できません。`, { field: ref.field });
    }
    return null;
  }
  if (!isAggregatableAsMeasure(role)) {
    return toolError(
      "AGG_TYPE_MISMATCH",
      `フィールド「${prop.label}」(${prop.type}) は数値型ではないため ${ref.agg} を適用できません。`,
      { field: ref.field },
    );
  }
  return null;
}

function checkFilter(schema: FieldSchema, filter: Filter): ToolError | null {
  const prop = resolveField(schema, filter.field);
  if (!prop) {
    return toolError("FIELD_NOT_FOUND", `フィールド「${filter.field}」は存在しません。`, { field: filter.field });
  }
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const role = roleOf(effective);
  const isOrderable = role === "measure" || role === "time";
  if (["gt", "gte", "lt", "lte", "between"].includes(filter.op) && !isOrderable) {
    return toolError(
      "AGG_TYPE_MISMATCH",
      `フィールド「${prop.label}」(${prop.type}) に演算子「${filter.op}」は使えません。`,
      { field: filter.field },
    );
  }
  // "contains" はテキスト系のフィールドのみ対応（filterMatch.ts の実装と一致させる）。
  // 数値・時間フィールドに使うと filterMatch.ts 側では常に false を返し、検証は通るのに0件になる。
  if (filter.op === "contains" && (isOrderable || effective === "SUBTABLE")) {
    return toolError(
      "AGG_TYPE_MISMATCH",
      `フィールド「${prop.label}」(${prop.type}) に演算子「contains」は使えません。`,
      { field: filter.field },
    );
  }
  return null;
}

function checkMapQuery(schema: FieldSchema, widget: Widget): ToolError | null {
  if (!isMapQuery(widget.query)) {
    return toolError(
      "WIDGET_SHAPE_INVALID",
      `type: "map" のウィジェットは MapQuery（geoフィールドを持つ形）である必要がありますが、通常の Query が渡されました。`,
    );
  }
  const { geo } = widget.query;
  const candidates = detectGeoCandidates(schema);

  if ("latField" in geo) {
    const latProp = resolveField(schema, geo.latField);
    const lngProp = resolveField(schema, geo.lngField);
    if (!latProp) return toolError("FIELD_NOT_FOUND", `フィールド「${geo.latField}」は存在しません。`, { field: geo.latField });
    if (!lngProp) return toolError("FIELD_NOT_FOUND", `フィールド「${geo.lngField}」は存在しません。`, { field: geo.lngField });
    const latEffective = resolveEffectiveType(latProp.type, latProp.lookup?.fieldType);
    const lngEffective = resolveEffectiveType(lngProp.type, lngProp.lookup?.fieldType);
    if (latEffective !== "NUMBER" || lngEffective !== "NUMBER") {
      return toolError(
        "GEO_FIELD_UNRESOLVED",
        `緯度経度フィールドは数値型である必要があります。候補: ${candidates.map((c) => (c.kind === "latLngPair" ? `${c.latField}/${c.lngField}` : c.pointField)).join(", ") || "なし"}`,
        { alternatives: candidates.filter((c) => c.kind === "latLngPair").map((c) => (c as { latField: string }).latField) },
      );
    }
  } else {
    const pointProp = resolveField(schema, geo.pointField);
    if (!pointProp) return toolError("FIELD_NOT_FOUND", `フィールド「${geo.pointField}」は存在しません。`, { field: geo.pointField });
    const pointEffective = resolveEffectiveType(pointProp.type, pointProp.lookup?.fieldType);
    if (pointEffective !== "SINGLE_LINE_TEXT") {
      return toolError("GEO_FIELD_UNRESOLVED", `座標フィールドは文字列型である必要があります。`, { field: geo.pointField });
    }
  }

  if (widget.query.colorBy) {
    const err = checkAxisField(schema, { field: widget.query.colorBy });
    if (err) return err;
  }

  return null;
}

/** add_widget / update_widget 時に呼ぶ。null は検証OK。 */
export function validateWidget(schema: FieldSchema, widget: Widget): ToolError | null {
  if (widget.type === "map") {
    return checkMapQuery(schema, widget);
  }
  if (isMapQuery(widget.query)) {
    return toolError(
      "WIDGET_SHAPE_INVALID",
      `type: "${widget.type}" のウィジェットに MapQuery（geoフィールドを持つ形）が渡されました。この型には通常の Query が必要です。`,
    );
  }

  const query = widget.query as Query;
  const shapeErr = checkShape(widget.type, query);
  if (shapeErr) return shapeErr;

  for (const axis of [...query.rows, ...query.cols]) {
    const err = checkAxisField(schema, axis);
    if (err) return err;
  }
  for (const m of query.measures) {
    const err = checkMeasureRef(schema, m);
    if (err) return err;
  }
  for (const f of [...query.filters]) {
    const err = checkFilter(schema, f);
    if (err) return err;
  }
  return null;
}

export function validateFilters(schema: FieldSchema, filters: Filter[]): ToolError | null {
  for (const f of filters) {
    const err = checkFilter(schema, f);
    if (err) return err;
  }
  return null;
}
