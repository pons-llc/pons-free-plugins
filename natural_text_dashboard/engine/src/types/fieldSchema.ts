/**
 * kintone `properties`（REST API「フィールドを取得する」/ kintone.app.getFormFields()）と同形の構造。
 * MVPではこの型のオブジェクトを MockDataSource がそのまま返す。
 */
export type KintoneFieldType =
  | "RECORD_NUMBER"
  | "NUMBER"
  | "CALC"
  | "DROP_DOWN"
  | "RADIO_BUTTON"
  | "CHECK_BOX"
  | "MULTI_SELECT"
  | "USER_SELECT"
  | "ORGANIZATION_SELECT"
  | "GROUP_SELECT"
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "SINGLE_LINE_TEXT"
  | "MULTI_LINE_TEXT"
  | "RICH_TEXT"
  | "LINK"
  | "FILE"
  | "CREATOR"
  | "MODIFIER"
  | "CREATED_TIME"
  | "UPDATED_TIME"
  | "CATEGORY"
  | "STATUS"
  | "STATUS_ASSIGNEE"
  | "SUBTABLE"
  | "GROUP"
  | "SPACER"
  | "LABEL"
  | "HR"
  | "REFERENCE_TABLE"
  | "LOOKUP";

export type FieldOption = {
  label: string;
  index: string;
};

export type KintoneFieldProperty = {
  type: KintoneFieldType;
  code: string;
  label: string;
  noLabel?: boolean;
  required?: boolean;
  unique?: boolean;
  options?: Record<string, FieldOption>;
  unit?: string;
  unitPosition?: "BEFORE" | "AFTER";
  digit?: boolean;
  displayScale?: string;
  /** LOOKUP: 参照先で実際に使われるフィールド型 */
  lookup?: { relatedAppId?: string; fieldType?: KintoneFieldType };
  /** SUBTABLE: 内包するフィールド */
  fields?: Record<string, KintoneFieldProperty>;
};

/** kintone REST API「フィールドを取得する」の `properties` そのもの */
export type FieldSchema = {
  appId: string;
  appName: string;
  properties: Record<string, KintoneFieldProperty>;
};
