import type { RawRecord } from "../data/DataSource";
import { extractDate, extractDimensionValues, extractMeasureNumber, rawValueOf } from "../data/values";
import { resolveEffectiveType } from "../semantic/fieldRole";
import type { FieldSchema } from "../types/fieldSchema";
import type { MeasureRef } from "../types/spec";

/** sum/avg/min/max 用の数値を取り出す（count/distinctはこの関数を使わない） */
export function extractMeasureNumeric(schema: FieldSchema, ref: Extract<MeasureRef, { field: string }>, record: RawRecord): number | null {
  const prop = schema.properties[ref.field];
  if (!prop) return null;
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  return extractMeasureNumber(effective, rawValueOf(record, ref.field));
}

/** distinct 用の「比較可能な値」を取り出す。フィールドの役割にかかわらず文字列表現に正規化する。 */
export function extractDistinctKeys(schema: FieldSchema, field: string, record: RawRecord): string[] {
  const prop = schema.properties[field];
  if (!prop) return [];
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const raw = rawValueOf(record, field);

  const num = extractMeasureNumber(effective, raw);
  if (num !== null) return [String(num)];

  const date = extractDate(effective, raw);
  if (date) return [date.toISOString()];

  return extractDimensionValues(effective, raw).map((v) => v.key);
}
