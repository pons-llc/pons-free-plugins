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
  // ルックアップフィールド(field.lookupが設定されている)は対象に含める(2026-08-09再訂正・
  // idea.md「ルックアップフィールドの再取得」参照)。kintone公式Tips「ルックアップの更新を
  // 自動で行う」の通り、ルックアップフィールドの値をPUTで指定するとそのルックアップの
  // 「ほかのフィールドのコピー」設定に従いコピー先フィールドが自動的に最新化されるため、
  // 「現在の値をそのまま書き戻して関連レコードを再取得する」という一括更新の使い道がある
  // (`inputKindOf()`が'LOOKUP_REFRESH'として分類し、確認ダイアログでは値の入力欄を出さない)。
  const isEligibleField = (field) => {
    if (!field || !field.type || !field.code) {
      return false;
    }
    if (EXCLUDED_TYPES.includes(field.type)) {
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

  // フィールド(またはフィールド型文字列)に応じた確認ダイアログでの入力欄の種類を返す。
  // フィールドオブジェクト({ type, lookup })を渡した場合のみ、lookupの有無を判定できる。
  // 型文字列だけを渡した場合(record-patch-builder.jsの`normalizeValue`等、値の型別正規化のみが
  // 必要でlookupの有無を問わない箇所)はLOOKUP_REFRESHにはならず、型だけで判定する。
  // ルックアップフィールド(field.lookupが設定されている)は'LOOKUP_REFRESH'を返す。値の入力欄を
  // 出さず、現在の値をそのまま書き戻して関連レコードを再取得する専用の扱いにするため
  // (bulk-update.jsのbuildConfirmDialogBody参照、idea.md「ルックアップフィールドの再取得」)。
  const inputKindOf = (fieldOrType) => {
    const isFieldObject =
      fieldOrType !== null && typeof fieldOrType === 'object';
    if (isFieldObject && fieldOrType.lookup) {
      return 'LOOKUP_REFRESH';
    }
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
