(function (root) {
  'use strict';

  const CharType =
    typeof module !== 'undefined' && module.exports
      ? require('./char-type')
      : root.InputFormatRule.CharType;

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  const hasAnyForbiddenType = (forbid) =>
    !!forbid && CharType.TYPES.some((type) => forbid[type]);

  // 設定画面の保存前チェック。例外を投げず、常に { valid, errors } を返す
  // (呼び出し側でalert等に表示しやすくするため)。
  const validateRules = (rules) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }

    const seenFieldCodes = new Set();

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;

      if (!rule || !isNonEmptyString(rule.fieldCode)) {
        errors.push(`${label}: 対象フィールドが選択されていません。`);
      } else if (seenFieldCodes.has(rule.fieldCode)) {
        errors.push(`${label}: 対象フィールドが他のルールと重複しています。`);
      } else {
        seenFieldCodes.add(rule.fieldCode);
      }

      if (!rule || !hasAnyForbiddenType(rule.forbid)) {
        errors.push(`${label}: 禁止する文字種が1つも選択されていません。`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.InputFormatRule = root.InputFormatRule || {};
    root.InputFormatRule.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
