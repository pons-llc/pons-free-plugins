import type { FieldSchema, KintoneFieldProperty } from "../types/fieldSchema";
import type { GeoCandidate } from "../types/semantic";

const LAT_RE = /(lat|latitude|緯度)/i;
const LNG_RE = /(lng|lon|longitude|経度)/i;
const POINT_RE = /(座標|位置|coordinates?)/i;

function matches(prop: KintoneFieldProperty, re: RegExp): boolean {
  return re.test(prop.code) || re.test(prop.label);
}

/**
 * §4.5: kintoneに地理型がないため、フィールドコード／ラベルの慣習からヒューリスティックに候補を推定する。
 * 明示設定の仕組みはMVPにはまだないため、すべて confidence: "inferred" として返す。
 */
export function detectGeoCandidates(schema: FieldSchema): GeoCandidate[] {
  const props = Object.values(schema.properties);
  const candidates: GeoCandidate[] = [];

  const latFields = props.filter((p) => p.type === "NUMBER" && matches(p, LAT_RE));
  const lngFields = props.filter((p) => p.type === "NUMBER" && matches(p, LNG_RE));
  for (const lat of latFields) {
    for (const lng of lngFields) {
      candidates.push({
        kind: "latLngPair",
        latField: lat.code,
        lngField: lng.code,
        confidence: "inferred",
      });
    }
  }

  const pointFields = props.filter((p) => p.type === "SINGLE_LINE_TEXT" && matches(p, POINT_RE));
  for (const point of pointFields) {
    candidates.push({ kind: "pointText", pointField: point.code, confidence: "inferred" });
  }

  return candidates;
}
