(function (root) {
  'use strict';

  // kintoneのレコード値(フィールドコード => { type, value })を、カンバンカードの
  // タイトル・ホバー・バッジ表示用の文字列に変換する。ユーザー選択/組織選択/グループ選択/
  // チェックボックス/複数選択は配列(オブジェクトまたは文字列の配列)のため、
  // 表示用に結合する。

  const displayNameOf = (item) => {
    if (item === null || item === undefined) {
      return '';
    }
    if (typeof item === 'object') {
      return item.name || item.code || '';
    }
    return String(item);
  };

  const formatFieldValue = (field) => {
    if (!field || field.value === null || field.value === undefined) {
      return '';
    }
    const value = field.value;
    if (Array.isArray(value)) {
      return value
        .map(displayNameOf)
        .filter((v) => v !== '')
        .join(', ');
    }
    return String(value);
  };

  const FormatFieldValue = { formatFieldValue, displayNameOf };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormatFieldValue;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.FormatFieldValue = FormatFieldValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
