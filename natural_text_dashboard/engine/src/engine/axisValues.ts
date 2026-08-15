import type { RawRecord } from "../data/DataSource";
import { extractDate, extractDimensionValues, extractMeasureNumber, rawValueOf } from "../data/values";
import { resolveEffectiveType, roleOf } from "../semantic/fieldRole";
import type { FieldSchema } from "../types/fieldSchema";
import type { TimeBucket } from "../types/semantic";
import type { Axis } from "../types/spec";

export type KeyLabel = { key: string; label: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function bucketDate(date: Date, bucket: TimeBucket): KeyLabel {
  switch (bucket) {
    case "day": {
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      return { key, label: key };
    }
    case "week": {
      const monday = startOfWeekMonday(date);
      const key = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      return { key, label: `${key}週` };
    }
    case "month": {
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      return { key, label: key };
    }
    case "quarter": {
      const q = Math.floor(date.getMonth() / 3) + 1;
      const key = `${date.getFullYear()}-Q${q}`;
      return { key, label: key };
    }
    case "year": {
      const key = String(date.getFullYear());
      return { key, label: key };
    }
  }
}

/** bucketDate() が作ったキー文字列から、そのバケットの開始日時を逆算する */
export function parseBucketKeyToDate(key: string, bucket: TimeBucket): Date | null {
  if (bucket === "day" || bucket === "week") return new Date(`${key}T00:00:00`);
  if (bucket === "month") return new Date(`${key}-01T00:00:00`);
  if (bucket === "year") return new Date(`${key}-01-01T00:00:00`);
  if (bucket === "quarter") {
    const [y, q] = key.split("-Q");
    const month = (Number(q) - 1) * 3 + 1;
    return new Date(`${y}-${String(month).padStart(2, "0")}-01T00:00:00`);
  }
  return null;
}

export function advanceBucket(d: Date, bucket: TimeBucket): Date {
  const next = new Date(d);
  if (bucket === "day") next.setDate(next.getDate() + 1);
  else if (bucket === "week") next.setDate(next.getDate() + 7);
  else if (bucket === "month") next.setMonth(next.getMonth() + 1);
  else if (bucket === "quarter") next.setMonth(next.getMonth() + 3);
  else if (bucket === "year") next.setFullYear(next.getFullYear() + 1);
  return next;
}

/** bucketKey の表す期間 [start, end) を返す（end は次のバケットの開始＝排他的上限） */
export function bucketRange(key: string, bucket: TimeBucket): { start: Date; end: Date } | null {
  const start = parseBucketKeyToDate(key, bucket);
  if (!start) return null;
  return { start, end: advanceBucket(start, bucket) };
}

/** ドリルダウンで「もう一段細かく見る」場合の次のバケット。無ければこれ以上は掘れない */
export const NEXT_TIME_BUCKET: Record<TimeBucket, TimeBucket | null> = {
  year: "quarter",
  quarter: "month",
  month: "day",
  week: "day",
  day: null,
};

function numberBin(value: number, bins: { width: number } | { edges: number[] }): KeyLabel {
  if ("width" in bins) {
    const lo = Math.floor(value / bins.width) * bins.width;
    const hi = lo + bins.width;
    return { key: `${lo}-${hi}`, label: `${lo}〜${hi}` };
  }
  const edges = [...bins.edges].sort((a, b) => a - b);
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    if (value >= lo && value < hi) return { key: `${lo}-${hi}`, label: `${lo}〜${hi}` };
  }
  if (edges.length > 0 && value < edges[0]!) return { key: `<${edges[0]}`, label: `${edges[0]}未満` };
  const last = edges[edges.length - 1];
  return { key: `>=${last}`, label: `${last}以上` };
}

/**
 * Axis 1つに対して、レコード1件から得られる値の一覧を返す。
 * multiDimension は複数件（呼び出し側で explode に使う）、単値/該当なしは0〜1件。
 */
export function extractAxisValues(schema: FieldSchema, axis: Axis, record: RawRecord): KeyLabel[] {
  const prop = schema.properties[axis.field];
  if (!prop) return [];
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const raw = rawValueOf(record, axis.field);

  if ("bucket" in axis) {
    const d = extractDate(effective, raw);
    if (!d) return [];
    return [bucketDate(d, axis.bucket)];
  }

  if ("bins" in axis) {
    const n = extractMeasureNumber(effective, raw);
    if (n === null) return [];
    return [numberBin(n, axis.bins)];
  }

  const role = roleOf(effective);
  if (role === "time") {
    const d = extractDate(effective, raw);
    if (!d) return [];
    return [bucketDate(d, "day")];
  }
  if (role === "measure") {
    const n = extractMeasureNumber(effective, raw);
    if (n === null) return [];
    const s = String(n);
    return [{ key: s, label: s }];
  }
  return extractDimensionValues(effective, raw);
}
