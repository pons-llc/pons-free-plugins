(function (root) {
  'use strict';

  // レコードオブジェクト+対象の一覧(resolveLookupTargets()の戻り値)から、該当するフィールドに
  // lookup = true をセットする。kintoneのイベントオブジェクトは値の書き換えを前提とした設計のため、
  // レコードオブジェクトを直接書き換える(idea.mdの「技術アプローチ」参照)。kintoneに依存しない
  // 純粋関数(引数に渡されたプレーンオブジェクトを書き換えるだけで、kintone APIを呼び出さない)。
  const applyLookupTriggers = (record, targets) => {
    const list = Array.isArray(targets) ? targets : [];

    list.forEach((target) => {
      if (target.kind === 'FIELD') {
        const field = record[target.fieldCode];
        if (field) {
          field.lookup = true;
        }
        return;
      }
      if (target.kind === 'SUBTABLE_COLUMN') {
        const subtableField = record[target.subtableFieldCode];
        if (subtableField && Array.isArray(subtableField.value)) {
          subtableField.value.forEach((row) => {
            const column = row.value ? row.value[target.columnCode] : undefined;
            if (column) {
              column.lookup = true;
            }
          });
        }
      }
    });

    return record;
  };

  const LookupTrigger = { applyLookupTriggers };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LookupTrigger;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.LookupTrigger = LookupTrigger;
  }
})(typeof window !== 'undefined' ? window : globalThis);
