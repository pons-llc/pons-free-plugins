(function (root) {
  'use strict';

  // 一括作成の対象として選べるフィールドの絞り込みロジック(純粋関数)。idea.md
  // 「テンプレート対象フィールドの絞り込み」参照。bulk_field_updateの除外基準を土台にしつつ、
  // 「新規作成」であることに由来する差分(ルックアップは常に除外、対象者フィールドは
  // テンプレートのチェックボックスに出さない)を反映している。

  // 値の取得・登録・更新ができない、またはレコード情報系(自動採番・作成者等)のフィールド。
  // kintoneドキュメントMCP「フィールド形式」で登録・更新不可と確認済み。
  const NOT_WRITABLE_TYPES = [
    'RECORD_NUMBER',
    'CREATOR',
    'CREATED_TIME',
    'MODIFIER',
    'UPDATED_TIME',
    'CALC',
    'CATEGORY',
    'STATUS',
    'STATUS_ASSIGNEE',
    'REFERENCE_TABLE',
  ];

  // フォームを装飾するだけで値を持たないフィールド。
  const DECORATIVE_TYPES = ['GROUP'];

  // idea.md確定事項: テーブルはテンプレート対象外。
  const TABLE_TYPES = ['SUBTABLE'];

  // idea.md確定事項: 組織選択・ユーザー選択・グループ選択は「対象者フィールド」専用の
  // 仕組みで扱うため、テンプレートのチェックボックス一覧には出さない
  // (対象者フィールドとして設定した場合でも、テンプレート項目としては選べない)。
  const ENTITY_SELECT_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ];

  // 添付ファイルは事前アップロードしたfileKeyが必要で、単純なテンプレート入力欄にできないため対象外。
  const FILE_TYPES = ['FILE'];

  const EXCLUDED_TYPES = [
    ...NOT_WRITABLE_TYPES,
    ...DECORATIVE_TYPES,
    ...TABLE_TYPES,
    ...ENTITY_SELECT_TYPES,
    ...FILE_TYPES,
  ];

  // フィールドがテンプレート対象として選択可能かどうか。
  // ルックアップフィールド(field.lookupが設定されている)は、新規作成時点では参照先が
  // 未確定で「現在の値」という概念が存在しないため、型を問わず常に対象外とする
  // (bulk_field_updateの「値をそのまま書き戻す」再取得の仕組みは新規作成には適用できない)。
  const isEligibleField = (field) => {
    if (!field || !field.type || !field.code) {
      return false;
    }
    if (field.lookup) {
      return false;
    }
    if (EXCLUDED_TYPES.includes(field.type)) {
      return false;
    }
    return true;
  };

  // formFields(kintone.app.getFormFields()の戻り値)から、テンプレート対象として選択可能な
  // フィールドの配列を返す。excludeFieldCodesには、設定画面で「繰り返し用日付フィールド」として
  // 選ばれたフィールドコードを渡し、テンプレート一覧からさらに除外する
  // (対象者フィールドはENTITY_SELECT_TYPESとして常に除外済みのため、ここで個別に除外する必要はない)。
  const listEligibleFields = (formFields, { excludeFieldCodes = [] } = {}) =>
    Object.values(formFields || {}).filter(
      (field) =>
        isEligibleField(field) && !excludeFieldCodes.includes(field.code),
    );

  // 設定画面の「対象者フィールド」ドロップダウンに出す候補(USER_SELECT/ORGANIZATION_SELECT/
  // GROUP_SELECT)。
  const listAssigneeCandidateFields = (formFields) =>
    Object.values(formFields || {}).filter(
      (field) =>
        field && field.type && ENTITY_SELECT_TYPES.includes(field.type),
    );

  // 設定画面の「繰り返し用日付/日時フィールド」ドロップダウンに出す候補。
  // DATE型は日付のみの繰り返し(毎日/毎週/毎月)、DATETIME型は日付の繰り返しに加えて
  // 時間帯を一定間隔で分割する繰り返し(会議室予約枠等、idea.md参照)にも対応する。
  const RECURRENCE_FIELD_TYPES = ['DATE', 'DATETIME'];
  const listRecurrenceFieldCandidates = (formFields) =>
    Object.values(formFields || {}).filter(
      (field) => field && RECURRENCE_FIELD_TYPES.includes(field.type),
    );

  const SINGLE_CHOICE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];
  const MULTI_CHOICE_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];

  // テンプレート対象フィールドの型に応じた、確認ダイアログでの入力欄の種類を返す
  // (bulk_field_updateのinputKindOfと同じ分類。本プラグインはルックアップを一律除外済みの
  // ため、LOOKUP_REFRESH相当の特別扱いは無い)。
  const inputKindOf = (fieldOrType) => {
    const isFieldObject =
      fieldOrType !== null && typeof fieldOrType === 'object';
    const fieldType = isFieldObject ? fieldOrType.type : fieldOrType;
    if (SINGLE_CHOICE_TYPES.includes(fieldType)) {
      return 'SINGLE_CHOICE';
    }
    if (MULTI_CHOICE_TYPES.includes(fieldType)) {
      return 'MULTI_CHOICE';
    }
    if (fieldType === 'DATE') {
      return 'DATE';
    }
    if (fieldType === 'TIME') {
      return 'TIME';
    }
    if (fieldType === 'DATETIME') {
      return 'DATETIME';
    }
    if (fieldType === 'NUMBER') {
      return 'NUMBER';
    }
    if (fieldType === 'MULTI_LINE_TEXT' || fieldType === 'RICH_TEXT') {
      return 'TEXTAREA';
    }
    return 'TEXT';
  };

  const FieldEligibility = {
    NOT_WRITABLE_TYPES,
    DECORATIVE_TYPES,
    TABLE_TYPES,
    ENTITY_SELECT_TYPES,
    FILE_TYPES,
    EXCLUDED_TYPES,
    SINGLE_CHOICE_TYPES,
    MULTI_CHOICE_TYPES,
    RECURRENCE_FIELD_TYPES,
    isEligibleField,
    listEligibleFields,
    listAssigneeCandidateFields,
    listRecurrenceFieldCandidates,
    inputKindOf,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldEligibility;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.FieldEligibility = FieldEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
