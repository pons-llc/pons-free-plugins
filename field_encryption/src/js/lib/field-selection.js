(function (root) {
  'use strict';

  // kintone.app.getFormFields() の戻り値(フィールドコードをキーにした平坦なオブジェクト。
  // REST APIレスポンスのpropertiesと同様の値であり、{properties: {...}}のようにラップされない
  // 点はconfig.js側の呼び出し箇所にもコメントを残す、CLAUDE.mdの既知の落とし穴参照)から、
  // 暗号化対象にできるフィールド(文字列1行/文字列複数行)だけを抽出する。

  const ELIGIBLE_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];

  const filterEligibleFields = (formFields) =>
    Object.values(formFields || {})
      .filter((field) => ELIGIBLE_TYPES.includes(field.type))
      .map((field) => ({
        code: field.code,
        label: field.label,
        type: field.type,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  const FieldSelection = { ELIGIBLE_TYPES, filterEligibleFields };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldSelection;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.FieldSelection = FieldSelection;
  }
})(typeof window !== 'undefined' ? window : globalThis);
