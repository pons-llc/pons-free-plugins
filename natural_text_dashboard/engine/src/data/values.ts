import type { KintoneFieldType } from "../types/fieldSchema";
import type { RawRecord } from "./DataSource";

export function rawValueOf(record: RawRecord, code: string): unknown {
  return record[code]?.value;
}

type KeyLabel = { key: string; label: string };

function codeNamePair(v: unknown): KeyLabel | null {
  if (v && typeof v === "object" && "code" in v) {
    const o = v as { code: string; name?: string };
    return { key: o.code, label: o.name ?? o.code };
  }
  return null;
}

/**
 * 次元としての値を [{key,label}] の配列で返す。
 * single次元なら要素0〜1、multi次元なら要素0〜N（多値展開）。
 */
export function extractDimensionValues(fieldType: KintoneFieldType, raw: unknown): KeyLabel[] {
  switch (fieldType) {
    // CATEGORY はポータルのカテゴリ同様、値は文字列の配列（CHECK_BOX/MULTI_SELECTと同じ形）
    case "CHECK_BOX":
    case "MULTI_SELECT":
    case "CATEGORY": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      return arr.filter((v) => v !== "").map((v) => ({ key: v, label: v }));
    }
    // STATUS_ASSIGNEE（作業者）はプロセス管理の複数担当者を持ち、値は {code,name} の配列（USER_SELECTと同じ形）
    case "USER_SELECT":
    case "ORGANIZATION_SELECT":
    case "GROUP_SELECT":
    case "STATUS_ASSIGNEE": {
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map(codeNamePair).filter((v): v is KeyLabel => v !== null);
    }
    case "CREATOR":
    case "MODIFIER": {
      const pair = codeNamePair(raw);
      return pair ? [pair] : [];
    }
    case "TIME":
    case "DROP_DOWN":
    case "RADIO_BUTTON":
    case "STATUS":
    case "SINGLE_LINE_TEXT": {
      const s = typeof raw === "string" ? raw : "";
      return s === "" ? [] : [{ key: s, label: s }];
    }
    default:
      return [];
  }
}

export function extractMeasureNumber(fieldType: KintoneFieldType, raw: unknown): number | null {
  if (fieldType !== "NUMBER" && fieldType !== "CALC") return null;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** DATE/DATETIME/CREATED_TIME/UPDATED_TIME を Date に変換 */
export function extractDate(fieldType: KintoneFieldType, raw: unknown): Date | null {
  if (fieldType !== "DATE" && fieldType !== "DATETIME" && fieldType !== "CREATED_TIME" && fieldType !== "UPDATED_TIME") {
    return null;
  }
  if (typeof raw !== "string" || raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
