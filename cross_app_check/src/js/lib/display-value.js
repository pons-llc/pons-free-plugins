(function (root) {
  'use strict';

  // 表示名フィールド(氏名など)の値を、突合結果の1行に載せる文字列へ変換する。
  // ユーザー選択・組織選択のように {code, name} を持つ値、チェックボックスのような
  // 配列値も、画面表示とCSVでそのまま使える文字列に潰しておく。
  const formatDisplayValue = (rawValue) => {
    if (rawValue === null || rawValue === undefined) {
      return '';
    }
    if (Array.isArray(rawValue)) {
      return rawValue
        .map((item) => formatDisplayValue(item))
        .filter((text) => text !== '')
        .join(', ');
    }
    if (typeof rawValue === 'object') {
      if (typeof rawValue.name === 'string') {
        return rawValue.name;
      }
      if (typeof rawValue.code === 'string') {
        return rawValue.code;
      }
      return '';
    }
    return String(rawValue);
  };

  // レコードから表示名を取り出す。フィールド未設定なら空文字。
  const extractDisplayValue = (record, fieldCode) => {
    if (!record || !fieldCode) {
      return '';
    }
    const field = record[fieldCode];
    if (!field) {
      return '';
    }
    return formatDisplayValue(field.value);
  };

  const DisplayValue = {
    formatDisplayValue,
    extractDisplayValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayValue;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.DisplayValue = DisplayValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
