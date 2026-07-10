(function (root) {
  'use strict';

  // 対象フィールドコードの配列+フォームフィールド定義(kintone.app.getFormFields()の戻り値と
  // 同じ形式、lookupプロパティの有無でルックアップフィールドかどうかを判定できる)から、
  // 実際に.lookup = trueをセットすべき対象の一覧を組み立てる(idea.mdの「ルックアップフィールドの
  // 判定」「サブテーブルを対象にした場合の挙動」参照)。kintoneに依存しない純粋関数。
  const resolveLookupTargets = (targetFieldCodes, formFields) => {
    const codes = Array.isArray(targetFieldCodes) ? targetFieldCodes : [];
    const fields = formFields || {};
    const targets = [];

    codes.forEach((code) => {
      const fieldMeta = fields[code];
      if (!fieldMeta) {
        return;
      }
      if (fieldMeta.type === 'SUBTABLE') {
        const innerFields = fieldMeta.fields || {};
        Object.keys(innerFields).forEach((columnCode) => {
          if (innerFields[columnCode].lookup) {
            targets.push({
              kind: 'SUBTABLE_COLUMN',
              subtableFieldCode: code,
              columnCode,
            });
          }
        });
        return;
      }
      if (fieldMeta.lookup) {
        targets.push({ kind: 'FIELD', fieldCode: code });
      }
    });

    return targets;
  };

  const LookupTargetResolver = { resolveLookupTargets };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LookupTargetResolver;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.LookupTargetResolver = LookupTargetResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
