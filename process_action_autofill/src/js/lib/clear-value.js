(function (root) {
  'use strict';

  const EMPTY_STRING_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'DROP_DOWN',
  ];
  const EMPTY_ARRAY_TYPES = [
    'CHECK_BOX',
    'MULTI_SELECT',
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ];
  const EMPTY_NULL_TYPES = ['DATE', 'DATETIME'];

  // kintoneドキュメントMCP「フィールド形式」の「フィールドの値を空に設定する場合」表に準拠した
  // 型別の空値を返す。対応外の型はundefinedを返す(呼び出し側でスキップの合図に使う)。
  //
  // 既知の制約: RADIO_BUTTONは空文字列("")を指定すると、フィールドに設定されている初期値の
  // 選択肢が選ばれる(kintoneドキュメントMCP「イベントオブジェクトで実行できる操作」に明記の仕様)。
  // 真の空にはならないが、APIで「クリア」に相当する操作はこれしか無いため""を返す
  // (idea.md「動作=クリアのとき」参照。設定画面・実行時のいずれでもこの制約を利用者に明示する)。
  const resolveClearValue = (fieldType) => {
    if (EMPTY_NULL_TYPES.includes(fieldType)) {
      return null;
    }
    if (EMPTY_ARRAY_TYPES.includes(fieldType)) {
      return [];
    }
    if (
      EMPTY_STRING_TYPES.includes(fieldType) ||
      fieldType === 'RADIO_BUTTON'
    ) {
      return '';
    }
    return undefined;
  };

  const ClearValue = { resolveClearValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClearValue;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.ClearValue = ClearValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
