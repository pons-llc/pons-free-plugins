import { MAX_SUGGESTED_QUESTIONS } from "../config/limits";
import type { RawRecord } from "../data/DataSource";
import { extractDate } from "../data/values";
import type { FieldSchema, KintoneFieldProperty } from "../types/fieldSchema";
import type { Dimension, FilterOperator, Measure, SemanticModel, TimeField } from "../types/semantic";
import { detectGeoCandidates } from "./geo";
import { resolveEffectiveType } from "./fieldRole";

const SELECT_OPERATORS: FilterOperator[] = ["eq", "ne", "in", "notIn", "isEmpty", "isNotEmpty"];
const TEXT_OPERATORS: FilterOperator[] = ["eq", "ne", "contains", "isEmpty", "isNotEmpty"];
const TIME_BUCKETS = ["day", "week", "month", "quarter", "year"] as const;

function knownValues(prop: KintoneFieldProperty): { key: string; label: string }[] {
  if (!prop.options) return [];
  return Object.values(prop.options)
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((o) => ({ key: o.label, label: o.label }));
}

function timeFieldRange(records: RawRecord[] | undefined, prop: KintoneFieldProperty): { min: string; max: string } | undefined {
  if (!records || records.length === 0) return undefined;
  let min: Date | undefined;
  let max: Date | undefined;
  for (const r of records) {
    const d = extractDate(prop.type, r[prop.code]?.value);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min || !max) return undefined;
  return { min: min.toISOString(), max: max.toISOString() };
}

function buildSuggestedQuestions(dimensions: Dimension[], measures: Measure[], timeFields: TimeField[]): string[] {
  const sortedDims = [...dimensions].sort((a, b) => {
    const aKnown = a.cardinality.known ? 0 : 1;
    const bKnown = b.cardinality.known ? 0 : 1;
    return aKnown - bKnown;
  });
  const topDims = sortedDims.slice(0, 6);
  const topMeasures = measures.slice(0, 3);
  const topTime = timeFields.slice(0, 2);

  const questions: string[] = [];

  for (const t of topTime) {
    for (const m of topMeasures) {
      questions.push(`${t.label}別の${m.label}の推移`);
    }
  }
  for (const d of topDims) {
    for (const m of topMeasures) {
      questions.push(`${d.label}別の${m.label}`);
    }
  }
  for (let i = 0; i < topDims.length; i++) {
    for (let j = i + 1; j < topDims.length; j++) {
      for (const m of topMeasures.slice(0, 1)) {
        questions.push(`${topDims[i]!.label}×${topDims[j]!.label}の${m.label}`);
      }
    }
  }
  for (const d of topDims) {
    for (const m of topMeasures.slice(0, 1)) {
      questions.push(`${m.label}が大きい${d.label}の上位N`);
    }
  }
  for (const d of topDims) {
    for (const m of topMeasures.slice(0, 1)) {
      questions.push(`${d.label}別${m.label}の構成比`);
    }
  }

  return questions.slice(0, MAX_SUGGESTED_QUESTIONS);
}

/**
 * §4.2 決定表を FieldSchema に適用し、SemanticModel を機械的に導出する。
 * records を渡すと時間フィールドの実データ範囲(min/max)も埋める（P1: 生レコードそのものはAIに渡らない）。
 */
export function buildSemanticModel(schema: FieldSchema, options?: { recordCountHint?: number; records?: RawRecord[] }): SemanticModel {
  const dimensions: Dimension[] = [];
  const measures: Measure[] = [{ code: null, label: "レコード件数", aggs: ["count"] }];
  const timeFields: TimeField[] = [];
  const unsupported: { code: string; reason: string }[] = [];

  for (const prop of Object.values(schema.properties)) {
    const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);

    switch (effective) {
      case "RECORD_NUMBER":
        break; // count のみ。個別には露出しない

      case "NUMBER":
      case "CALC":
        measures.push({
          code: prop.code,
          label: prop.label,
          aggs: ["sum", "avg", "min", "max"],
          unit: prop.unit,
          format: { decimals: 0, thousandSeparator: true },
        });
        break;

      case "DROP_DOWN":
      case "RADIO_BUTTON":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "single",
          cardinality: { known: true, values: knownValues(prop) },
          operators: SELECT_OPERATORS,
        });
        break;

      case "CHECK_BOX":
      case "MULTI_SELECT":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "multi",
          cardinality: { known: true, values: knownValues(prop) },
          operators: SELECT_OPERATORS,
        });
        break;

      case "USER_SELECT":
      case "ORGANIZATION_SELECT":
      case "GROUP_SELECT":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "multi",
          cardinality: { known: false, hint: "low" },
          operators: SELECT_OPERATORS,
        });
        break;

      case "CREATOR":
      case "MODIFIER":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "single",
          cardinality: { known: false, hint: "low" },
          operators: SELECT_OPERATORS,
        });
        break;

      case "STATUS":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "single",
          cardinality: { known: false, hint: "low" },
          operators: SELECT_OPERATORS,
        });
        break;

      // CATEGORY は複数選択可能（values.ts の extractDimensionValues と同じ扱い）
      case "CATEGORY":
      case "STATUS_ASSIGNEE":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "multi",
          cardinality: { known: false, hint: "low" },
          operators: SELECT_OPERATORS,
        });
        break;

      case "TIME":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "single",
          cardinality: { known: false, hint: "low" },
          operators: SELECT_OPERATORS,
        });
        break;

      case "DATE":
      case "DATETIME":
      case "CREATED_TIME":
      case "UPDATED_TIME":
        timeFields.push({
          code: prop.code,
          label: prop.label,
          buckets: [...TIME_BUCKETS],
          range: timeFieldRange(options?.records, prop),
        });
        break;

      case "SINGLE_LINE_TEXT":
        dimensions.push({
          code: prop.code,
          label: prop.label,
          kind: "single",
          cardinality: { known: false, hint: "high" },
          operators: TEXT_OPERATORS,
        });
        break;

      case "MULTI_LINE_TEXT":
      case "RICH_TEXT":
        unsupported.push({ code: prop.code, reason: `フィールド「${prop.label}」は自由記述のため集計軸にできません（絞り込みのみ利用可能）。` });
        break;

      case "LINK":
        unsupported.push({ code: prop.code, reason: `フィールド「${prop.label}」はリンクのため集計対象外です。` });
        break;

      case "FILE":
        unsupported.push({ code: prop.code, reason: `フィールド「${prop.label}」は添付ファイルのため集計対象外です。` });
        break;

      case "SUBTABLE":
        unsupported.push({ code: prop.code, reason: `フィールド「${prop.label}」はサブテーブルのためMVPでは非対応です。` });
        break;

      case "GROUP":
      case "SPACER":
      case "LABEL":
      case "HR":
      case "REFERENCE_TABLE":
        break; // レイアウト要素。除外

      default:
        break;
    }
  }

  const geoCandidates = detectGeoCandidates(schema);
  const suggestedQuestions = buildSuggestedQuestions(dimensions, measures, timeFields);

  return {
    appId: schema.appId,
    appName: schema.appName,
    recordCountHint: options?.recordCountHint,
    dimensions,
    measures,
    timeFields,
    geoCandidates,
    unsupported,
    suggestedQuestions,
  };
}
