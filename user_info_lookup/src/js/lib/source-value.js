(function (root) {
  'use strict';

  // 元フィールド(文字列1行 または ユーザー選択)の値から、ユーザーコード(ログイン名)を取り出す。
  // ユーザー選択フィールドは複数人選択できるが、idea.mdの方針により1人目のみを使う。
  // 値が無い場合は空文字列を返す(呼び出し側はこれを「未入力」として扱い、出力先をクリアする)。
  const extractUserCode = (sourceField, sourceFieldType) => {
    if (!sourceField) {
      return '';
    }
    if (sourceFieldType === 'USER_SELECT') {
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

  const SourceValue = { extractUserCode };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SourceValue;
  } else {
    root.UserInfoLookup = root.UserInfoLookup || {};
    root.UserInfoLookup.SourceValue = SourceValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
