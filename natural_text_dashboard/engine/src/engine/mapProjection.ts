import { LIMITS } from "../config/limits";
import type { RawRecord } from "../data/DataSource";
import { extractDimensionValues, extractMeasureNumber, rawValueOf } from "../data/values";
import { resolveEffectiveType } from "../semantic/fieldRole";
import type { FieldSchema } from "../types/fieldSchema";
import type { MapProjectionResult, PointResult } from "../types/result";
import type { MapQuery } from "../types/spec";

function parseLatLng(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parsePointText(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function isValidCoord(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function labelOf(schema: FieldSchema, field: string | undefined, record: RawRecord): string | undefined {
  if (!field) return undefined;
  const prop = schema.properties[field];
  if (!prop) return undefined;
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const raw = rawValueOf(record, field);
  if (effective === "NUMBER" || effective === "CALC") {
    const n = extractMeasureNumber(effective, raw);
    return n === null ? undefined : String(n);
  }
  const dims = extractDimensionValues(effective, raw);
  return dims[0]?.label;
}

function colorKeyOf(schema: FieldSchema, field: string | undefined, record: RawRecord): string | undefined {
  if (!field) return undefined;
  const prop = schema.properties[field];
  if (!prop) return undefined;
  const effective = resolveEffectiveType(prop.type, prop.lookup?.fieldType);
  const dims = extractDimensionValues(effective, rawValueOf(record, field));
  return dims[0]?.key;
}

/**
 * §7.5: 地図は集計ではなく座標への投影。レコード全体を保持せず、座標・ラベル・色分けキーだけを PointResult に絞る。
 * 妥当な座標を持たない行（範囲外・数値化不可・欠損）は除外し、除外件数を返す。
 */
export function projectToPoints(schema: FieldSchema, query: MapQuery, records: RawRecord[]): MapProjectionResult {
  const points: PointResult[] = [];
  let excludedCount = 0;
  const limit = Math.min(query.limit?.markers ?? LIMITS.maxMapMarkers, LIMITS.maxMapMarkers);

  for (const record of records) {
    let coord: { lat: number; lng: number } | null = null;
    if ("latField" in query.geo) {
      const lat = parseLatLng(rawValueOf(record, query.geo.latField));
      const lng = parseLatLng(rawValueOf(record, query.geo.lngField));
      coord = lat !== null && lng !== null ? { lat, lng } : null;
    } else {
      coord = parsePointText(rawValueOf(record, query.geo.pointField));
    }

    if (!coord || !isValidCoord(coord.lat, coord.lng)) {
      excludedCount += 1;
      continue;
    }

    if (points.length >= limit) {
      continue;
    }

    points.push({
      lat: coord.lat,
      lng: coord.lng,
      label: labelOf(schema, query.label, record),
      colorKey: colorKeyOf(schema, query.colorBy, record),
    });
  }

  const totalValid = records.length - excludedCount;
  return { points, excludedCount, truncated: totalValid > limit };
}
