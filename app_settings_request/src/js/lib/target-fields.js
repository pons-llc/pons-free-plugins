(function (root) {
  'use strict';

  // 対象アプリのフィールド定義(GET /k/v1/app/form/fields.json のproperties)を、
  // 依頼画面のフィールド選択肢として扱いやすい一覧にする。
  // ステータス・作業者・カテゴリーは変更・削除APIの制限事項で対象にできないため除く。
  const EXCLUDED_TYPES = new Set(['STATUS', 'STATUS_ASSIGNEE', 'CATEGORY']);

  const toItem = (def, subtable) => ({
    key: subtable ? `${subtable.code}/${def.code}` : def.code,
    code: def.code,
    label: def.label,
    type: def.type,
    subtableCode: subtable ? subtable.code : '',
    subtableLabel: subtable ? subtable.label : '',
    def,
  });

  const flattenFields = (properties) => {
    const items = [];
    Object.keys(properties || {}).forEach((code) => {
      const def = properties[code];
      if (EXCLUDED_TYPES.has(def.type)) {
        return;
      }
      items.push(toItem(def, null));
      if (def.type === 'SUBTABLE') {
        Object.keys(def.fields || {}).forEach((innerCode) => {
          items.push(toItem(def.fields[innerCode], def));
        });
      }
    });
    return items;
  };

  const displayName = (item) => {
    const base = `${item.label}(${item.code})`;
    return item.subtableCode ? `${item.subtableLabel} > ${base}` : base;
  };

  // フィールドコードはテーブル内も含めてアプリ内で一意(コード変更の重複チェックに使う)。
  const collectCodes = (properties) => {
    const codes = new Set();
    Object.keys(properties || {}).forEach((code) => {
      codes.add(code);
      const def = properties[code];
      if (def.type === 'SUBTABLE') {
        Object.keys(def.fields || {}).forEach((inner) => codes.add(inner));
      }
    });
    return codes;
  };

  const findField = (properties, code, subtableCode) => {
    if (!properties) {
      return null;
    }
    if (!subtableCode) {
      return properties[code] || null;
    }
    const table = properties[subtableCode];
    if (!table || table.type !== 'SUBTABLE') {
      return null;
    }
    return (table.fields || {})[code] || null;
  };

  const TargetFields = { flattenFields, displayName, collectCodes, findField };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TargetFields;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.TargetFields = TargetFields;
  }
})(typeof window !== 'undefined' ? window : globalThis);
