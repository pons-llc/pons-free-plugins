(function (root) {
  'use strict';

  // 元フィールド(文字列1行 または 組織選択)の値から、組織コードを取り出す。
  // 組織選択フィールドは複数選択できるが、user_info_lookupプラグインと同じ方針により1つ目のみを使う。
  // 値が無い場合は空文字列を返す(呼び出し側はこれを「未入力」として扱い、出力先をクリアする)。
  const extractOrgCode = (sourceField, sourceFieldType) => {
    if (!sourceField) {
      return '';
    }
    if (sourceFieldType === 'ORGANIZATION_SELECT') {
      const first = Array.isArray(sourceField.value)
        ? sourceField.value[0]
        : undefined;
      return first && first.code ? first.code : '';
    }
    // SINGLE_LINE_TEXT想定。他の型が渡ってきた場合も文字列値があればそのまま使う。
    return typeof sourceField.value === 'string'
      ? sourceField.value.trim()
      : '';
  };

  const SourceValue = { extractOrgCode };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SourceValue;
  } else {
    root.OrgLookup = root.OrgLookup || {};
    root.OrgLookup.SourceValue = SourceValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
