(function (root) {
  'use strict';

  // モーダルの一覧表(コンフィグで選択した表示項目)に出す、フィールド値の表示用文字列化。
  // kintoneドキュメントMCP「フィールド形式」で確認した型ごとの値の形をそのまま処理する
  // (idea.md「対象レコードの取得」参照)。

  // 値が {code, name} の配列になる型(名前だけを「、」区切りで表示する)。
  const ENTITY_ARRAY_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'STATUS_ASSIGNEE',
  ];
  // 値が文字列の配列になる型。
  const STRING_ARRAY_TYPES = ['CHECK_BOX', 'MULTI_SELECT', 'CATEGORY'];
  // 値が単一の {code, name} オブジェクトになる型。
  const SINGLE_ENTITY_TYPES = ['CREATOR', 'MODIFIER'];

  // field: { type, value } (kintoneのフィールド形式そのもの)
  const formatFieldValue = (field) => {
    if (!field) {
      return '';
    }
    const { type, value } = field;
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (type === 'FILE') {
      return Array.isArray(value) ? value.map((f) => f.name).join('、') : '';
    }
    if (ENTITY_ARRAY_TYPES.includes(type)) {
      return Array.isArray(value) ? value.map((e) => e.name).join('、') : '';
    }
    if (SINGLE_ENTITY_TYPES.includes(type)) {
      return value.name || '';
    }
    if (STRING_ARRAY_TYPES.includes(type)) {
      return Array.isArray(value) ? value.join('、') : '';
    }
    // SUBTABLE等、表として展開が必要な型は対象外(config-validation.jsで選択候補からも除外する)。
    if (type === 'SUBTABLE') {
      return '';
    }
    return String(value);
  };

  const FieldValueFormatter = { formatFieldValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValueFormatter;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.FieldValueFormatter = FieldValueFormatter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
