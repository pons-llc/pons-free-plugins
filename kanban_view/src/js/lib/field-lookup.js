(function (root) {
  'use strict';

  // kintone.app.getFormFields() の戻り値(フィールドコード => フィールド定義)から、
  // 指定した型のフィールドコードを探す。ステータス(STATUS)・作業者(STATUS_ASSIGNEE)は
  // 名前ではなく型で特定する(bulk_approval/idea.mdの既知の落とし穴と同じ理由:
  // 「ステータス」「作業者」という名前は変更されている場合があるため)。
  // 同じ型のフィールドはアプリに1つしか存在しないため、最初に見つかったものを返す。

  const findFieldCodeByType = (formFields, type) => {
    const fields = formFields || {};
    const code = Object.keys(fields).find((key) => fields[key].type === type);
    return code || null;
  };

  // DROP_DOWN/RADIO_BUTTONフィールドの選択肢を、フォーム設定の並び順(index昇順)で返す。
  const optionsOf = (field) => {
    if (!field || !field.options) {
      return [];
    }
    return Object.keys(field.options)
      .map((code) => ({ code, label: field.options[code].label || code }))
      .sort(
        (a, b) =>
          Number(field.options[a.code].index) -
          Number(field.options[b.code].index),
      );
  };

  const FieldLookup = { findFieldCodeByType, optionsOf };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldLookup;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.FieldLookup = FieldLookup;
  }
})(typeof window !== 'undefined' ? window : globalThis);
