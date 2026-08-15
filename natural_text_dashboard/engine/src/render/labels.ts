import type { FieldSchema } from "../types/fieldSchema";
import type { MeasureAgg } from "../types/semantic";
import type { MeasureRef } from "../types/spec";

const AGG_LABEL_JA: Record<MeasureAgg, string> = {
  count: "件数",
  sum: "合計",
  avg: "平均",
  min: "最小",
  max: "最大",
  distinct: "ユニーク数",
};

export function measureLabel(schema: FieldSchema, ref: MeasureRef): string {
  if (ref.agg === "count") return "件数";
  const label = schema.properties[ref.field]?.label ?? ref.field;
  return `${label}の${AGG_LABEL_JA[ref.agg]}`;
}

export function fieldLabel(schema: FieldSchema, code: string): string {
  return schema.properties[code]?.label ?? code;
}

export function formatNumber(n: number | null, opts?: { decimals?: number; thousandSeparator?: boolean; unit?: string }): string {
  if (n === null) return "-";
  const decimals = opts?.decimals ?? (Number.isInteger(n) ? 0 : 2);
  const rounded = Number(n.toFixed(decimals));
  const body = opts?.thousandSeparator === false ? String(rounded) : rounded.toLocaleString("ja-JP", { maximumFractionDigits: decimals, minimumFractionDigits: decimals > 0 ? decimals : 0 });
  return opts?.unit ? `${body}${opts.unit}` : body;
}
