import type { KintoneFieldType } from "../types/fieldSchema";
import type { FieldRole } from "../types/semantic";

/**
 * §4.2 決定表の実体: kintoneフィールド型 → 役割(FieldRole)。
 * セマンティック層・バリデータ・集計エンジンはすべてこの1つの表を単一の情報源として参照する。
 */
export const FIELD_TYPE_ROLE: Record<KintoneFieldType, FieldRole> = {
  RECORD_NUMBER: "identifier",
  NUMBER: "measure",
  CALC: "measure",
  DROP_DOWN: "dimension",
  RADIO_BUTTON: "dimension",
  CHECK_BOX: "multiDimension",
  MULTI_SELECT: "multiDimension",
  USER_SELECT: "multiDimension",
  ORGANIZATION_SELECT: "multiDimension",
  GROUP_SELECT: "multiDimension",
  DATE: "time",
  DATETIME: "time",
  TIME: "dimension",
  SINGLE_LINE_TEXT: "text",
  MULTI_LINE_TEXT: "text",
  RICH_TEXT: "text",
  LINK: "text",
  FILE: "attachment",
  CREATOR: "dimension",
  MODIFIER: "dimension",
  CREATED_TIME: "time",
  UPDATED_TIME: "time",
  CATEGORY: "dimension",
  STATUS: "dimension",
  STATUS_ASSIGNEE: "dimension",
  SUBTABLE: "subScope",
  GROUP: "layout",
  SPACER: "layout",
  LABEL: "layout",
  HR: "layout",
  REFERENCE_TABLE: "layout",
  // LOOKUPは呼び出し元で lookup.fieldType を見て委譲する。表引き失敗時のフォールバックとして text を返す。
  LOOKUP: "text",
};

/** LOOKUPは元の型に従う（§4.2）。委譲先の型を解決してから role を引く。 */
export function resolveEffectiveType(
  type: KintoneFieldType,
  lookupFieldType: KintoneFieldType | undefined,
): KintoneFieldType {
  if (type === "LOOKUP" && lookupFieldType) return lookupFieldType;
  return type;
}

export function roleOf(type: KintoneFieldType, lookupFieldType?: KintoneFieldType): FieldRole {
  const effective = resolveEffectiveType(type, lookupFieldType);
  return FIELD_TYPE_ROLE[effective];
}

/**
 * 集計軸（Axis）として使える role か。
 * SINGLE_LINE_TEXT は role としては "text" だが、決定表(§4.2)では
 * 「△＝カーディナリティ不明。軸にする場合は上位N＋その他」として集計軸に使える例外。
 * role だけでは判定できないため呼び出し元は effectiveType も渡す。
 */
export function isAggregatableAsAxis(role: FieldRole, effectiveType?: KintoneFieldType): boolean {
  if (effectiveType === "SINGLE_LINE_TEXT") return true;
  return role === "dimension" || role === "multiDimension" || role === "time" || role === "measure";
}

/** 指標（Measure）として使える role か */
export function isAggregatableAsMeasure(role: FieldRole): boolean {
  return role === "measure";
}
