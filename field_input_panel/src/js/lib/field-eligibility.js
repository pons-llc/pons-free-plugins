(function (root) {
  'use strict';

  // 本プラグインのパネルに表示できるフィールド型(idea.md「対応フィールド型」参照)。
  // ユーザー選択・組織選択・グループ選択・添付ファイル・リッチエディター・関連レコード一覧・
  // テーブル・計算・システム項目(レコード番号/作成者/作成日時/更新者/更新日時/ステータス/
  // 作業者/カテゴリー)は対象外。
  const ELIGIBLE_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'LINK',
    'RADIO_BUTTON',
    'CHECK_BOX',
    'MULTI_SELECT',
    'DROP_DOWN',
    'DATE',
    'TIME',
    'DATETIME',
  ];

  // ルックアップフィールドは、コピー元フィールドの型で`type`が返る(kintoneドキュメントMCPで確認済み。
  // 「フィールドを取得する」REST APIの`properties.フィールドコード.type`の説明を参照)ため、
  // `lookup`プロパティの有無で判定する必要がある。
  const isEligibleField = (fieldProperty) => {
    if (!fieldProperty) {
      return false;
    }
    if (fieldProperty.lookup) {
      return false;
    }
    return ELIGIBLE_TYPES.includes(fieldProperty.type);
  };

  // formFields(kintone.app.getFormFields()の戻り値、フィールドコード→プロパティのオブジェクト)から、
  // 選択可能なフィールドの一覧を{ code, label, type }の配列で返す。
  const listEligibleFields = (formFields) => {
    return Object.keys(formFields || {})
      .filter((code) => isEligibleField(formFields[code]))
      .map((code) => ({
        code,
        label: formFields[code].label || code,
        type: formFields[code].type,
      }));
  };

  const FieldEligibility = {
    ELIGIBLE_TYPES,
    isEligibleField,
    listEligibleFields,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldEligibility;
  } else {
    root.FieldInputPanel = root.FieldInputPanel || {};
    root.FieldInputPanel.FieldEligibility = FieldEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
