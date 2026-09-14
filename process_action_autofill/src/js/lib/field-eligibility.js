(function (root) {
  'use strict';

  // 対象フィールドとして選択できる型(process.proceedイベントの「フィールドの値を書き換える」
  // 非対応フィールド一覧、およびフィールド形式ドキュメントで登録・更新不可とされる型を除いたもの)。
  // 非対応: レコード番号・作成者・作成日時・更新者・更新日時・ステータス・作業者・計算・
  // 自動計算にした文字列1行・添付ファイル・ルックアップ・ルックアップコピー先フィールド・
  // カテゴリー・関連レコード一覧・テーブル(SUBTABLE内は今回スコープ外)。
  const SUPPORTED_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'RADIO_BUTTON',
    'DROP_DOWN',
    'CHECK_BOX',
    'MULTI_SELECT',
    'DATE',
    'DATETIME',
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ];

  const CATEGORY_BY_TYPE = {
    SINGLE_LINE_TEXT: 'TEXT',
    MULTI_LINE_TEXT: 'TEXT',
    NUMBER: 'NUMBER',
    RADIO_BUTTON: 'CHOICE',
    DROP_DOWN: 'CHOICE',
    CHECK_BOX: 'MULTI_CHOICE',
    MULTI_SELECT: 'MULTI_CHOICE',
    DATE: 'DATE_TIME',
    DATETIME: 'DATE_TIME',
    USER_SELECT: 'USER',
    ORGANIZATION_SELECT: 'ORGANIZATION',
    GROUP_SELECT: 'GROUP',
  };

  const COPY_SOURCE_TYPES_BY_CATEGORY = {
    TEXT: ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'],
    NUMBER: ['NUMBER'],
  };

  // kintone.app.getFormFields()の戻り値(フィールドコード→フィールド情報のオブジェクト、
  // ラップされない)から、対象フィールドの選択肢に列挙してよいフィールドだけを抽出する。
  // ルックアップフィールドは実体がSINGLE_LINE_TEXT/NUMBER/LINK型として現れるが、lookupプロパティ
  // (auto_lookupと同じ確認方法)の有無で除外する。
  const listEligibleFields = (formFields) =>
    Object.values(formFields || {}).filter(
      (f) => SUPPORTED_TYPES.includes(f.type) && !f.lookup,
    );

  const categoryOf = (fieldType) => CATEGORY_BY_TYPE[fieldType] || null;

  // 文字列/数値フィールドの「特定フィールドのコピー」で、コピー元として選択できる候補
  // (同カテゴリ〈文字列系はSINGLE_LINE_TEXT・MULTI_LINE_TEXTのみ、数値はNUMBERのみ〉に限定)。
  const listCopySourceCandidates = (formFields, category) => {
    const allowedTypes = COPY_SOURCE_TYPES_BY_CATEGORY[category] || [];
    if (allowedTypes.length === 0) {
      return [];
    }
    return Object.values(formFields || {}).filter(
      (f) => allowedTypes.includes(f.type) && !f.lookup,
    );
  };

  const FieldEligibility = {
    SUPPORTED_TYPES,
    categoryOf,
    listEligibleFields,
    listCopySourceCandidates,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldEligibility;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.FieldEligibility = FieldEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
