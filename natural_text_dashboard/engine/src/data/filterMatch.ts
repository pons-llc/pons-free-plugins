import { resolveEffectiveType, roleOf } from "../semantic/fieldRole";
import type { FieldSchema } from "../types/fieldSchema";
import type { Filter } from "../types/spec";
import type { RawRecord } from "./DataSource";
import { extractDate, extractDimensionValues, extractMeasureNumber, rawValueOf } from "./values";

function isEmptyValue(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === "") return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}

type InNotInFilter = Extract<Filter, { op: "in" | "notIn" }>;

/**
 * in/notIn の比較集合はレコードごとに同じ filter オブジェクトへ何度も問い合わせるため、
 * 数値化・文字列化を毎レコードやり直さず filter オブジェクト単位でキャッシュする。
 * （matchesFilters は1レコードにつき1回呼ばれるが、同じ filters 配列がレコード数だけ再利用される）
 */
const inSetCache = new WeakMap<InNotInFilter, { numSet: Set<number>; strSet: Set<string>; timeSet: Set<number> }>();

function getInSets(filter: InNotInFilter): { numSet: Set<number>; strSet: Set<string>; timeSet: Set<number> } {
  let cached = inSetCache.get(filter);
  if (!cached) {
    cached = {
      numSet: new Set(filter.values.map(Number)),
      strSet: new Set(filter.values.map(String)),
      timeSet: new Set(filter.values.map((v) => new Date(String(v)).getTime())),
    };
    inSetCache.set(filter, cached);
  }
  return cached;
}

function matchesOne(schema: FieldSchema, record: RawRecord, filter: Filter): boolean {
  const prop = schema.properties[filter.field];
  if (!prop) return false;
  const raw = rawValueOf(record, filter.field);

  if (filter.op === "isEmpty") return isEmptyValue(raw);
  if (filter.op === "isNotEmpty") return !isEmptyValue(raw);

  // LOOKUPフィールドは参照先の型に従う（他の全モジュールと同じ resolveEffectiveType を使う。
  // §4.2の決定表を単一の情報源とする、という設計原則をここでも守る）。
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const role = roleOf(effective);
  const isMeasureType = role === "measure";
  const isTimeType = role === "time";

  if (isMeasureType) {
    const n = extractMeasureNumber(effective, raw);
    if (n === null) return false;
    switch (filter.op) {
      case "eq":
        return n === Number(filter.value);
      case "ne":
        return n !== Number(filter.value);
      case "in":
        return getInSets(filter).numSet.has(n);
      case "notIn":
        return !getInSets(filter).numSet.has(n);
      case "gt":
        return n > Number(filter.value);
      case "gte":
        return n >= Number(filter.value);
      case "lt":
        return n < Number(filter.value);
      case "lte":
        return n <= Number(filter.value);
      case "between":
        return n >= Number(filter.from) && n <= Number(filter.to);
      default:
        return false;
    }
  }

  if (isTimeType) {
    const d = extractDate(effective, raw);
    if (!d) return false;
    const t = d.getTime();
    switch (filter.op) {
      case "eq":
        return t === new Date(String(filter.value)).getTime();
      case "ne":
        return t !== new Date(String(filter.value)).getTime();
      case "in":
        return getInSets(filter).timeSet.has(t);
      case "notIn":
        return !getInSets(filter).timeSet.has(t);
      case "gt":
        return t > new Date(String(filter.value)).getTime();
      case "gte":
        return t >= new Date(String(filter.value)).getTime();
      case "lt":
        return t < new Date(String(filter.value)).getTime();
      case "lte":
        return t <= new Date(String(filter.value)).getTime();
      case "between":
        return t >= new Date(String(filter.from)).getTime() && t <= new Date(String(filter.to)).getTime();
      default:
        return false;
    }
  }

  // dimension / multiDimension / text: 文字列としての一致・部分一致で判定
  const dims = extractDimensionValues(effective, raw);
  const keys = dims.length > 0 ? dims.map((d) => d.key) : [String(raw ?? "")];

  switch (filter.op) {
    case "eq":
      return keys.includes(String(filter.value));
    case "ne":
      return !keys.includes(String(filter.value));
    case "in":
      return keys.some((k) => getInSets(filter).strSet.has(k));
    case "notIn":
      return !keys.some((k) => getInSets(filter).strSet.has(k));
    case "contains":
      return keys.some((k) => k.includes(filter.value));
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "between":
      // 文字列比較は行わない（数値/日時フィールドのみ対応）。バリデータ側で AGG_TYPE_MISMATCH として弾く想定。
      return false;
    default:
      return false;
  }
}

export function matchesFilters(schema: FieldSchema, record: RawRecord, filters: Filter[]): boolean {
  return filters.every((f) => matchesOne(schema, record, f));
}
