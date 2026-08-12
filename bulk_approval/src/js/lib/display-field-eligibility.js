(function (root) {
  'use strict';

  // モーダルの一覧表に表示できるフィールドの絞り込み。
  // テーブル(値がオブジェクトの配列でそのまま1セルに表示できない)・関連レコード一覧
  // (値の取得ができない)・フォームを装飾するだけのフィールド(値を持たない)は対象外にする
  // (kintoneドキュメントMCP「フィールド形式」で確認済み、idea.md「設定画面」参照)。
  const EXCLUDED_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'LABEL',
    'SPACER',
    'HR',
    'GROUP',
  ];

  // formFields: kintone.app.getFormFields()の戻り値(フィールドコードをキーとするオブジェクト)
  const listEligibleFields = (formFields) =>
    Object.values(formFields || {}).filter(
      (field) => !EXCLUDED_TYPES.includes(field.type),
    );

  const DisplayFieldEligibility = { EXCLUDED_TYPES, listEligibleFields };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayFieldEligibility;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.DisplayFieldEligibility = DisplayFieldEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
