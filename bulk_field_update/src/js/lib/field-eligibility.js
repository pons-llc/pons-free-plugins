(function (root) {
  'use strict';

  // 一括更新の対象フィールドとして選べるフィールドの絞り込みロジック(純粋関数)。
  // idea.md「対象フィールドの絞り込み」参照。kintone.app.getFormFields()が返す
  // フィールド定義(REST APIのpropertiesと同様の値)を入力に、対象外にすべきフィールドを除外する。

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

  // フォームを装飾するだけで値を持たないフィールド(GROUPはgetFormFields()のpropertiesに
  // 含まれるが値の取得・登録・更新はできない。SPACER/LABEL/HRはそもそもpropertiesに含まれない)。
  const DECORATIVE_TYPES = ['GROUP'];

  // idea.md確定事項: テーブルは対象外。
  const TABLE_TYPES = ['SUBTABLE'];

  // idea.md確定事項: 組織選択・ユーザー選択・グループ選択は初期値の設定が実務上困難
  // (実在の組織/ユーザー/グループを選ぶ入力UIが必要になり複雑なため)、対象外とする。
  const ENTITY_SELECT_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ];

  // 添付ファイルは事前アップロードしたfileKeyが必要で、設定画面で初期値として指定できないため対象外。
  const FILE_TYPES = ['FILE'];

  const EXCLUDED_TYPES = [
    ...NOT_WRITABLE_TYPES,
    ...DECORATIVE_TYPES,
    ...TABLE_TYPES,
    ...ENTITY_SELECT_TYPES,
    ...FILE_TYPES,
  ];

  // 選択肢から選ぶ単一選択(空にする操作は許可しない。idea.md「選択肢系フィールドの初期値」参照:
  // ラジオボタンはAPI経由で空にする方法が無い〈空文字列を指定すると初期値が設定される〉ため、
  // ドロップダウンも含めて一貫して「必ず選択肢から選ぶ」仕様にしている)。
  const SINGLE_CHOICE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];

  // 選択肢から選ぶ複数選択(0件選択=空にする、を許可する)。
  const MULTI_CHOICE_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];

  const DATE_LIKE_TYPES = ['DATE', 'TIME', 'DATETIME'];

  // フィールドが一括更新の対象として選択可能かどうか。
  // ルックアップフィールド(field.lookupが設定されている)は、コピー元アプリからの
  // 自動転記と競合し得るため対象外とする(idea.md「ルックアップフィールドの除外」参照)。
  const isEligibleField = (field) => {
    if (!field || !field.type || !field.code) {
      return false;
    }
    if (EXCLUDED_TYPES.includes(field.type)) {
      return false;
    }
    if (field.lookup) {
      return false;
    }
    return true;
  };

  // ルックアップフィールドの「ほかのフィールドのコピー」設定で**コピー先**に指定されている
  // フィールドのコード一覧を集める。これらのフィールドはルックアップフィールドの値が確定する
  // たびに自動上書きされるため(コピー先フィールド自体は`field.lookup`を持たず、ルックアップ
  // フィールド側の`lookup.fieldMappings[].field`にコピー先として列挙される)、一括更新の対象に
  // すると次回のルックアップ実行時に上書きされてしまい、コピー元との整合性が壊れる
  // (idea.md「ルックアップのコピー先フィールドの除外」参照)。
  const collectLookupCopyDestinationCodes = (formFields) => {
    const codes = new Set();
    Object.values(formFields || {}).forEach((field) => {
      if (field && field.lookup && Array.isArray(field.lookup.fieldMappings)) {
        field.lookup.fieldMappings.forEach((mapping) => {
          if (mapping && mapping.field) {
            codes.add(mapping.field);
          }
        });
      }
    });
    return codes;
  };

  // formFields(kintone.app.getFormFields()の戻り値、フィールドコードをキーとするオブジェクト)から
  // 対象として選択可能なフィールドの配列を返す。isEligibleField()単体では判定できない
  // 「ルックアップのコピー先フィールド」もここで除外する。
  const listEligibleFields = (formFields) => {
    const copyDestinationCodes = collectLookupCopyDestinationCodes(formFields);
    return Object.values(formFields || {}).filter(
      (field) =>
        isEligibleField(field) && !copyDestinationCodes.has(field.code),
    );
  };

  // フィールド型に応じた設定画面での入力欄の種類を返す。config.js側のUI分岐に使う。
  const inputKindOf = (fieldType) => {
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
    DATE_LIKE_TYPES,
    isEligibleField,
    collectLookupCopyDestinationCodes,
    listEligibleFields,
    inputKindOf,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldEligibility;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.FieldEligibility = FieldEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
