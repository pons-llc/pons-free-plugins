(function (root) {
  'use strict';

  // フィールドタイプ→値の整形カテゴリの対応(idea.md「選択できるフィールドの種類」参照)。
  // ここに無いタイプ(SUBTABLE/REFERENCE_TABLE/FILE/GROUP等)は帳票の値として選択できない。
  const TYPE_TO_CATEGORY = {
    SINGLE_LINE_TEXT: 'TEXT',
    MULTI_LINE_TEXT: 'TEXT',
    RICH_TEXT: 'TEXT',
    LINK: 'TEXT',
    CALC: 'TEXT',
    RECORD_NUMBER: 'TEXT',
    STATUS: 'TEXT',
    STATUS_ASSIGNEE: 'TEXT',
    CATEGORY: 'TEXT',
    NUMBER: 'NUMBER',
    DATE: 'DATE',
    DATETIME: 'DATETIME',
    CREATED_TIME: 'DATETIME',
    UPDATED_TIME: 'DATETIME',
    TIME: 'TIME',
    DROP_DOWN: 'CHOICE',
    RADIO_BUTTON: 'CHOICE',
    CHECK_BOX: 'MULTI_CHOICE',
    MULTI_SELECT: 'MULTI_CHOICE',
    USER_SELECT: 'ENTITY',
    ORGANIZATION_SELECT: 'ENTITY',
    GROUP_SELECT: 'ENTITY',
    CREATOR: 'ENTITY',
    MODIFIER: 'ENTITY',
  };

  const categoryForType = (type) => TYPE_TO_CATEGORY[type] || null;

  const isSelectableField = (field) => categoryForType(field.type) !== null;

  const isSubtableField = (field) => field.type === 'SUBTABLE';

  // NUMBER型、またはCALC型で数値形式(NUMBER/NUMBER_DIGIT)のフィールド。単位・桁区切りの
  // 表示可否を選べるようにするため、この判定だけカテゴリ分類(TEXT/NUMBER)とは別に持つ
  // (CALCは値の整形自体はTEXTカテゴリ扱いのままだが、数値形式のときは単位・桁区切りの対象にする)。
  const NUMERIC_CALC_FORMATS = ['NUMBER', 'NUMBER_DIGIT'];
  const isNumericField = (field) =>
    field.type === 'NUMBER' ||
    (field.type === 'CALC' && NUMERIC_CALC_FORMATS.includes(field.format));

  // kintone.app.getFormFields()の戻り値(フィールドコードをキーとするオブジェクト、ラップされない
  // CLAUDE.md既知の落とし穴参照)から、通常フィールド(テーブルを除く)の選択肢を作る。
  // 数値フィールドは、kintone側で設定済みの単位(unit/unitPosition)・桁区切り(digit)を
  // 項目配置時の初期値として使えるよう合わせて返す。
  const listSelectableFields = (formFields) =>
    Object.values(formFields)
      .filter(isSelectableField)
      .map((field) => {
        const isNumeric = isNumericField(field);
        const base = {
          code: field.code,
          label: field.label,
          type: field.type,
          isNumeric,
        };
        if (!isNumeric) {
          return base;
        }
        return {
          ...base,
          unit: field.unit || '',
          unitPosition: field.unitPosition === 'BEFORE' ? 'BEFORE' : 'AFTER',
          digit: !!field.digit,
        };
      });

  // SUBTABLEフィールドとその中の選択可能な列を取り出す。REST APIドキュメントの
  // get-form-fieldsサンプルレスポンス確認済み: SUBTABLEの`.fields`は`properties`と同じ構造。
  const listTableFields = (formFields) =>
    Object.values(formFields)
      .filter(isSubtableField)
      .map((field) => ({
        code: field.code,
        label: field.label,
        columns: listSelectableFields(field.fields || {}),
      }));

  const isFileField = (field) => field.type === 'FILE';

  // 生成した帳票(PDF)を保存する先の候補として、添付ファイルフィールドの一覧を返す
  // (ユーザー指示「詳細画面から添付ファイルフィールドに保存できるようにしよう」)。
  const listFileFields = (formFields) =>
    Object.values(formFields)
      .filter(isFileField)
      .map((field) => ({ code: field.code, label: field.label }));

  const FieldCatalog = {
    categoryForType,
    isSelectableField,
    isSubtableField,
    isNumericField,
    isFileField,
    listSelectableFields,
    listTableFields,
    listFileFields,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldCatalog;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.FieldCatalog = FieldCatalog;
  }
})(typeof window !== 'undefined' ? window : globalThis);
